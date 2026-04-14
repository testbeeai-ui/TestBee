"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronLeft, RotateCcw } from "lucide-react";
import { DOUBT_FLAIRS, type ProfileRow } from "./doubtTypes";
import { applyNormalizedPasteToField, normalizePastedMathForDoubt } from "@/lib/normalizePastedDoubtMath";

interface AskDoubtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileRow | null;
  /** Called after a successful post; `doubtId` is set when the RPC returns an id (for Prof-Pi pending UI). */
  onDoubtPosted?: (doubtId?: string | null) => void;
}

const DRAFT_KEY = "doubts-ask-draft";

export default function AskDoubtDialog({ open, onOpenChange, profile, onDoubtPosted }: AskDoubtDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [askStep, setAskStep] = useState(1);
  const [duplicateMatches, setDuplicateMatches] = useState<{ id: string; title: string; similarity_score: number }[]>([]);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [costRdm, setCostRdm] = useState(0);
  const [bountyRdm, setBountyRdm] = useState(0);
  const [customBountyInput, setCustomBountyInput] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const handleStartAsNew = useCallback(() => {
    clearDraft();
    setAskStep(1);
    setTitle("");
    setBody("");
    setSubject("");
    setDuplicateMatches([]);
    setCostRdm(0);
    setBountyRdm(0);
    setCustomBountyInput("");
  }, [clearDraft]);

  const hydrateFromSessionOrReset = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) {
        handleStartAsNew();
        return;
      }
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (d.title != null) setTitle(String(d.title));
      if (d.body != null) setBody(String(d.body));
      if (d.subject != null) setSubject(String(d.subject));
      if (typeof d.askStep === "number" && d.askStep >= 1 && d.askStep <= 4) setAskStep(d.askStep);
      if (typeof d.costRdm === "number") setCostRdm(d.costRdm);
      if (typeof d.bountyRdm === "number") setBountyRdm(d.bountyRdm);
      if (d.customBountyInput != null) setCustomBountyInput(String(d.customBountyInput));
      if (Array.isArray(d.duplicateMatches)) setDuplicateMatches(d.duplicateMatches as { id: string; title: string; similarity_score: number }[]);
    } catch {
      handleStartAsNew();
    }
  }, [handleStartAsNew]);

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          title,
          body,
          subject,
          askStep,
          costRdm,
          bountyRdm,
          customBountyInput,
          duplicateMatches,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [title, body, subject, askStep, costRdm, bountyRdm, customBountyInput, duplicateMatches]);

  // Load draft when dialog opens — defer updates so we don't setState synchronously inside the effect body.
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      hydrateFromSessionOrReset();
    });
  }, [open, hydrateFromSessionOrReset]);

  useEffect(() => {
    if (open) saveDraft();
  }, [open, saveDraft]);

  const handleStep1Next = () => {
    if (!title.trim() || !subject || !DOUBT_FLAIRS.includes(subject as (typeof DOUBT_FLAIRS)[number])) {
      toast({ title: "Title and subject required", variant: "destructive" });
      return;
    }
    const nt = normalizePastedMathForDoubt(title.trim());
    const nb = normalizePastedMathForDoubt(body.trim());
    setTitle(nt);
    setBody(nb);
    setDuplicateChecking(true);
    setAskStep(2);
    supabase.rpc("search_doubt_duplicates", { p_title: nt }).then(({ data, error }) => {
      setDuplicateChecking(false);
      if (error) { setDuplicateMatches([]); setAskStep(4); return; }
      const rows = (data || []) as { id: string; title: string; similarity_score: number }[];
      const similar = rows.filter((r) => r.similarity_score >= 0.35);
      if (similar.length > 0) { setDuplicateMatches(similar); setAskStep(3); }
      else { setDuplicateMatches([]); setAskStep(4); }
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitLoading(true);
    const nt = normalizePastedMathForDoubt(title.trim());
    const nb = normalizePastedMathForDoubt(body.trim());
    setTitle(nt);
    setBody(nb);
    const { data, error } = await supabase.rpc("create_doubt_with_escrow", {
      p_title: nt,
      p_body: nb || "",
      p_subject: subject.trim(),
      p_cost_rdm: costRdm, p_bounty_rdm: bountyRdm,
    });
    setSubmitLoading(false);
    const res = data as { ok: boolean; id?: unknown; error?: string };
    if (error) { toast({ title: "Could not post doubt", description: error.message, variant: "destructive" }); return; }
    if (res?.ok) {
      clearDraft();
      toast({ title: "Doubt posted!" });
      onOpenChange(false);
      const rawId = res.id;
      const doubtId =
        typeof rawId === "string"
          ? rawId.trim()
          : rawId != null && String(rawId) !== ""
            ? String(rawId).trim()
            : null;
      onDoubtPosted?.(doubtId ?? null);
      if (doubtId) {
        let accessToken = (await supabase.auth.getSession()).data.session?.access_token ?? null;
        if (!accessToken) {
          await supabase.auth.refreshSession();
          accessToken = (await supabase.auth.getSession()).data.session?.access_token ?? null;
        }
        if (!accessToken) {
          toast({
            title: "Prof-Pi was not triggered",
            description: "No session token after posting. Refresh the page and try again, or check you are signed in.",
            variant: "destructive",
          });
        } else {
          await new Promise((r) => setTimeout(r, 400));
          const apiUrl = `${window.location.origin}/api/gyan-bot-answer`;
          void fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ doubtId }),
          })
            .then(async (res) => {
              if (res.ok) return;
              const err = (await res.json().catch(() => ({}))) as {
                error?: string;
                hint?: string;
                supabaseError?: string;
                envDiagSummary?: string;
              };
              const hintHasKeyMsg = err.hint?.toLowerCase().includes("invalid api key");
              const supa =
                err.supabaseError && !hintHasKeyMsg ? `\n\n${err.supabaseError}` : "";
              const extra = err.hint ? `\n\n${err.hint}` : "";
              const diag = err.envDiagSummary ? `\n\n${err.envDiagSummary}` : "";
              toast({
                title: "Prof-Pi could not answer yet",
                description: `${err.error ?? `Server returned ${res.status}`}${supa}${extra}${diag}`,
                variant: "destructive",
              });
            })
            .catch(() => {
              toast({
                title: "Prof-Pi request failed",
                description: "Network error calling /api/gyan-bot-answer. Check connection and deployment.",
                variant: "destructive",
              });
            });
        }
      }
    }
    else { toast({ title: res?.error ?? "Failed to post", variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask a Doubt</DialogTitle>
          <DialogDescription>
            {askStep === 1 &&
              "Ask anything you want — type it in your own words or paste from notes, a textbook, or the web. We tidy common math formats for you. Then pick a subject."}
            {askStep === 2 && "Checking for similar questions..."}
            {askStep === 3 && "We found similar questions. Is yours here?"}
            {askStep === 4 && "Cost and optional bounty (during beta cost is 0)."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {askStep === 1 && (
            <>
              <div>
                <Label className="text-sm font-bold">Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData("text/plain");
                    const el = e.currentTarget;
                    const { value, caret } = applyNormalizedPasteToField(
                      title,
                      el.selectionStart ?? 0,
                      el.selectionEnd ?? 0,
                      pasted,
                    );
                    setTitle(value);
                    queueMicrotask(() => el.setSelectionRange(caret, caret));
                  }}
                  placeholder={"Write your question however you like — one clear line"}
                  className="rounded-xl mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Longer working or big equations fit best in Details. Math is cleaned up when you paste; you can also use{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">$…$</code> if you want.
                </p>
              </div>
              <div>
                <Label className="text-sm font-bold">Details (optional)</Label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData("text/plain");
                    const el = e.currentTarget;
                    const { value, caret } = applyNormalizedPasteToField(
                      body,
                      el.selectionStart ?? 0,
                      el.selectionEnd ?? 0,
                      pasted,
                    );
                    setBody(value);
                    queueMicrotask(() => el.setSelectionRange(caret, caret));
                  }}
                  placeholder={
                    "Optional: more context"
                  }
                  className="w-full min-h-[100px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm mt-1 resize-y font-mono"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Formats like <code className="rounded bg-muted px-1 py-0.5 text-[11px]">\[ … \]</code> or fenced{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">```latex</code> are converted when you paste or post.
                </p>
              </div>
              <div>
                <Label className="text-sm font-bold">Subject <span className="text-destructive">*</span></Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DOUBT_FLAIRS.map((flair) => (
                    <Button key={flair} type="button" variant={subject === flair ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setSubject(flair)}>{flair}</Button>
                  ))}
                </div>
              </div>
            </>
          )}
          {askStep === 2 && (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          )}
          {askStep === 3 && duplicateMatches.length > 0 && (
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
              <p className="font-semibold text-foreground">Similar questions we found:</p>
              <ul className="space-y-2">
                {duplicateMatches.map((m) => (
                  <li key={m.id}><Link href={`/doubts/${m.id}`} className="text-sm text-primary hover:underline line-clamp-2 block py-1" onClick={() => onOpenChange(false)}>{m.title}</Link></li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Open any link above if it answers your question, or continue to post yours.</p>
            </div>
          )}
          {askStep === 4 && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Base cost: {costRdm} RDM <span className="text-muted-foreground font-normal">(0 during beta)</span></p>
              <p className="text-xs text-muted-foreground">Your balance: <span className="font-semibold text-edu-orange">{profile?.rdm ?? 0} RDM</span></p>
              <p className="text-sm font-medium text-foreground mt-2">Optional bounty</p>
              <p className="text-xs text-muted-foreground">Adding a bounty increases visibility and incentivizes quick, quality answers.</p>
              <div className="flex flex-wrap gap-2 items-center mt-2">
                {[0, 10, 50, 100].map((n) => (
                  <Button key={n} type="button" variant={bountyRdm === n && !customBountyInput ? "default" : "outline"} size="sm" className="rounded-xl"
                    onClick={() => { setBountyRdm(n); setCustomBountyInput(""); }}>+{n} RDM</Button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label className="text-sm font-medium text-muted-foreground shrink-0">Custom:</Label>
                <Input type="number" min={0} max={Math.max(999, profile?.rdm ?? 0)} placeholder="e.g. 25" className="rounded-xl w-24 h-8"
                  value={customBountyInput !== "" ? customBountyInput : ([0, 10, 50, 100].includes(bountyRdm) ? "" : String(bountyRdm))}
                  onChange={(e) => { const v = e.target.value; setCustomBountyInput(v); const n = parseInt(v, 10); if (!Number.isNaN(n) && n >= 0) setBountyRdm(n); else if (v === "") setBountyRdm(0); }} />
                <span className="text-xs text-muted-foreground">RDM</span>
              </div>
              <p className="text-sm font-semibold text-foreground pt-2 border-t border-border mt-2">
                Total: {costRdm + bountyRdm} RDM {profile != null && costRdm + bountyRdm > (profile.rdm ?? 0) && <span className="text-destructive text-xs font-normal">(insufficient balance)</span>}
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:gap-2">
          {askStep === 1 && (
            <>
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={handleStartAsNew}><RotateCcw className="w-4 h-4 mr-1" /> Start as new</Button>
              <Button className="rounded-xl" onClick={handleStep1Next} disabled={!title.trim() || !subject || duplicateChecking}>
                {duplicateChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Continue
              </Button>
            </>
          )}
          {askStep === 3 && (
            <>
              <Button variant="outline" className="rounded-xl" onClick={() => setAskStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button className="rounded-xl" onClick={() => { setDuplicateMatches([]); setAskStep(4); }}>My question is different — continue</Button>
            </>
          )}
          {askStep === 4 && (
            <>
              <Button variant="outline" className="rounded-xl" onClick={() => setAskStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={handleStartAsNew}><RotateCcw className="w-4 h-4 mr-1" /> Start as new</Button>
              <Button className="rounded-xl" onClick={handleSubmit} disabled={submitLoading || (profile != null && costRdm + bountyRdm > (profile.rdm ?? 0))}>
                {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Post
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
