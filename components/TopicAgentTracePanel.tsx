"use client";

import { useMemo, useState } from "react";
import type { TopicAgentTrace } from "@/lib/topicContentService";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ChevronDown, ClipboardCopy, Trash2 } from "lucide-react";

function PreBlock({ text, truncated }: { text: string; truncated?: boolean }) {
  return (
    <div className="relative rounded-lg border border-border bg-muted/40">
      {truncated ? (
        <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 px-2 pt-2">
          Truncated in API response — see server logs or increase limits in generate-topic route if needed.
        </p>
      ) : null}
      <pre className="text-[11px] leading-relaxed p-3 max-h-[min(55vh,420px)] overflow-auto whitespace-pre-wrap break-words font-mono text-foreground/90">
        {text || "—"}
      </pre>
    </div>
  );
}

export default function TopicAgentTracePanel({
  trace,
  onClear,
}: {
  trace: TopicAgentTrace | null;
  onClear?: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const fullDump = useMemo(() => (trace ? JSON.stringify(trace, null, 2) : ""), [trace]);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  if (!trace) return null;

  const steps = trace.pipelineSteps ?? [];
  const rag = trace.rag;
  const prompts = trace.prompts;
  const gemini = trace.gemini;

  return (
    <div className="mt-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="text-xs font-extrabold text-primary uppercase tracking-wide">
          Admin · agent trace (behind the scenes)
        </h4>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px] gap-1 rounded-lg"
            onClick={() => copy("json", fullDump)}
          >
            <ClipboardCopy className="w-3 h-3" />
            {copied === "json" ? "Copied" : "Copy full JSON"}
          </Button>
          {onClear ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] gap-1 rounded-lg text-muted-foreground"
              onClick={onClear}
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">
        This is exactly what the server used for this run: RAG request shape, whether the sidecar returned chunks,
        and the system + user text sent to Gemini (possibly truncated for size).
      </p>

      <Accordion type="multiple" className="w-full space-y-1">
        <AccordionItem value="steps" className="border rounded-lg px-2 bg-background/80">
          <AccordionTrigger className="text-xs font-bold py-2 hover:no-underline">
            <span className="flex items-center gap-1">
              <ChevronDown className="w-3 h-3 shrink-0" />
              Pipeline order ({steps.length} steps)
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-muted-foreground pb-2">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="gemini" className="border rounded-lg px-2 bg-background/80">
          <AccordionTrigger className="text-xs font-bold py-2 hover:no-underline">
            Gemini call
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto">
              {JSON.stringify(gemini ?? {}, null, 2)}
            </pre>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rag" className="border rounded-lg px-2 bg-background/80">
          <AccordionTrigger className="text-xs font-bold py-2 hover:no-underline">
            RAG (Testbee sidecar) · {rag?.chunksReturned ?? 0} chunks
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-2">
            <p className="text-[11px] font-semibold text-foreground">{rag?.outcomeSummary}</p>
            <div className="grid gap-1 text-[11px]">
              <span>
                <span className="font-bold">Intent:</span> {rag?.intent}
              </span>
              <span>
                <span className="font-bold">HTTP:</span> {rag?.http}
              </span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground">Request JSON (body)</p>
            <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(rag?.requestJson ?? {}, null, 2)}
            </pre>
            <p className="text-[10px] font-bold text-muted-foreground">Base query (before augmentation)</p>
            <PreBlock text={rag?.baseQuery ?? ""} />
            <p className="text-[10px] font-bold text-muted-foreground">Augmented query (sent to sidecar)</p>
            <PreBlock text={rag?.augmentedQuery ?? ""} />
            <p className="text-[10px] font-bold text-muted-foreground">Formatted context embedded in prompt</p>
            <PreBlock
              text={rag?.formattedContextEmbeddedInPrompt ?? ""}
              truncated={rag?.formattedContextTruncated}
            />
          </AccordionContent>
        </AccordionItem>

        {trace.feedbackCaptured ? (
          <AccordionItem value="feedback" className="border rounded-lg px-2 bg-background/80">
            <AccordionTrigger className="text-xs font-bold py-2 hover:no-underline">
              User feedback (regenerate)
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(trace.feedbackCaptured, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        <AccordionItem value="system" className="border rounded-lg px-2 bg-background/80">
          <AccordionTrigger className="text-xs font-bold py-2 hover:no-underline">
            System instruction → Gemini
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px] mb-2"
              onClick={() => copy("sys", prompts?.systemInstruction ?? "")}
            >
              {copied === "sys" ? "Copied" : "Copy system prompt"}
            </Button>
            <PreBlock
              text={prompts?.systemInstruction ?? ""}
              truncated={prompts?.systemInstructionTruncated}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="user" className="border rounded-lg px-2 bg-background/80">
          <AccordionTrigger className="text-xs font-bold py-2 hover:no-underline">
            User prompt → Gemini
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px] mb-2"
              onClick={() => copy("user", prompts?.userPrompt ?? "")}
            >
              {copied === "user" ? "Copied" : "Copy user prompt"}
            </Button>
            <PreBlock text={prompts?.userPrompt ?? ""} truncated={prompts?.userPromptTruncated} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
