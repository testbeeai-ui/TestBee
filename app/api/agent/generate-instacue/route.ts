import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import {
  generateArtifactJson,
  instaCueResponseSchema,
  isVertexForTopicAgentEnabled,
} from "@/lib/geminiTopicGenerate";
import { isAdminUser } from "@/lib/admin";
import { supabaseForLongJobPersist } from "@/lib/supabaseAdminPersist";
import { resolveGeminiModelId, resolveVertexTopicModelId } from "@/lib/geminiModel";
import { fetchRAGContext } from "@/lib/rag";
import { normalizeSubjectKey, normalizeSubtopicContentKey } from "@/lib/subtopicContentKeys";
import { getGeminiApiKeyFromEnv } from "@/lib/geminiEnv";
import { logAiUsage } from "@/lib/aiLogger";
import { tryParseJsonObjectWithSalvage } from "@/lib/parseModelJson";
import { sanitizeJsonForDb } from "@/lib/sanitizeJsonForDb";

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);

const MIN_INSTACUE_BY_LEVEL: Record<string, number> = {
  basics: 10,
  intermediate: 15,
  advanced: 25,
};

function normalizeInstaCue(value: unknown): Array<{
  type: "concept" | "formula" | "common_mistake" | "trap";
  frontContent: string;
  backContent: string;
}> {
  const allowed = new Set(["concept", "formula", "common_mistake", "trap"]);
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const type = typeof o.type === "string" ? o.type.trim() : "";
      const frontContent = typeof o.frontContent === "string" ? o.frontContent.trim() : "";
      const backContent = typeof o.backContent === "string" ? o.backContent.trim() : "";
      if (!allowed.has(type) || !frontContent || !backContent) return null;
      return {
        type: type as "concept" | "formula" | "common_mistake" | "trap",
        frontContent,
        backContent,
      };
    })
    .filter((x): x is { type: "concept" | "formula" | "common_mistake" | "trap"; frontContent: string; backContent: string } => Boolean(x));
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!isVertexForTopicAgentEnabled() && !apiKey?.trim()) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is not configured." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const board = normalizeSubtopicContentKey(body?.board);
    const subject = normalizeSubjectKey(body?.subject);
    const classLevel = Number(body?.classLevel);
    const topic = normalizeSubtopicContentKey(body?.topic);
    const subtopicName = normalizeSubtopicContentKey(body?.subtopicName);
    const level = normalizeSubtopicContentKey(body?.level);
    const includeTrace = body?.includeTrace === true;

    if (
      !board || !subject || !topic || !subtopicName ||
      !ALLOWED_LEVELS.has(level) || Number.isNaN(classLevel) || ![11, 12].includes(classLevel)
    ) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    // Fetch existing theory
    const { data: existing, error: fetchErr } = await supabase
      .from("subtopic_content")
      .select("theory")
      .eq("board", board).eq("subject", subject).eq("class_level", classLevel)
      .eq("topic", topic).eq("subtopic_name", subtopicName).eq("level", level)
      .maybeSingle();

    if (fetchErr || !existing?.theory?.trim()) {
      return NextResponse.json(
        { error: "No theory found for this subtopic. Generate the Deep Dive first." },
        { status: 400 }
      );
    }

    const minCards = MIN_INSTACUE_BY_LEVEL[level] ?? 10;
    const targetCards = level === "advanced" ? 32 : level === "intermediate" ? 20 : 14;
    const ragMatchCount = level === "advanced" ? 24 : level === "intermediate" ? 16 : 10;
    const ragQuery = `${topic} ${subtopicName} CBSE Class ${classLevel} ${subject} revision key points formula traps mistakes`;
    const rag = await fetchRAGContext(ragQuery, subject, classLevel, topic, subtopicName, ragMatchCount);
    const ragBlock = rag?.formattedContext
      ? `\n\nRAG CONTEXT (trusted textbook snippets):\n${rag.formattedContext}`
      : "";

    const baseSystemInstruction = `You are an expert ${subject} educator for CBSE Class ${classLevel}. Generate quick-revision flashcards (InstaCue) from the provided subtopic theory.
Each card has:
- type: one of "concept", "formula", "common_mistake", "trap"
- frontContent: A question or concept prompt
- backContent: A crisp, accurate answer or definition

Rules:
- Generate at least ${minCards} cards (strict minimum). Prefer ${targetCards}+ if content supports.
- Cards must be self-contained and useful for quick revision.
- For frontContent and backContent, write normal text and you MUST wrap ANY math expressions, variables, units, or symbols in \\( ... \\). Use $$ ... $$ only for true display/block math when needed. Never output bare LaTeX (e.g. \\lambda, \\pi, m^2) in undelimited plain text.
- For "formula" type cards: front = formula name/context, back = the formula in LaTeX.
- For "common_mistake" type: front = the mistake students make, back = the correct approach.
- For "trap" type: front = the tricky scenario, back = why the obvious answer is wrong + correct answer.
- Output valid JSON only.`;

    const baseUserPrompt = `Topic: ${topic}
Subtopic: ${subtopicName}
Level: ${level}
Theory:
${existing.theory.slice(0, 16000)}${ragBlock}`;

    const { modelId: studioModelId } = resolveGeminiModelId(process.env.GEMINI_MODEL);
    const vertexEnabled = isVertexForTopicAgentEnabled();
    const { modelId: vertexResolvedId } = resolveVertexTopicModelId(studioModelId);
    const modelId = vertexEnabled ? vertexResolvedId : studioModelId;

    let backend = vertexEnabled ? "vertex" : "api_key";
    let items: Array<{ type: "concept" | "formula" | "common_mistake" | "trap"; frontContent: string; backContent: string }> = [];

    for (let attempt = 1; attempt <= 3; attempt++) {
      const shortfallHint =
        attempt === 1
          ? ""
          : attempt === 2
            ? `\n\nSTRICT REPAIR: previous output had fewer than ${minCards} valid cards. Return at least ${minCards} fully valid cards now.`
            : `\n\nCRITICAL: Your previous reply was not valid JSON. Output ONE JSON object only: {"items":[...]} with double-quoted keys/strings. Escape backslashes inside strings as \\\\. At least ${minCards} cards.`;
      const out = await generateArtifactJson({
        apiKey,
        modelId,
        userPrompt: `${baseUserPrompt}${shortfallHint}`,
        systemInstruction: baseSystemInstruction,
        temperature: attempt === 1 ? 0.5 : attempt === 2 ? 0.35 : 0.25,
        responseSchema: instaCueResponseSchema(),
      });
      backend = out.backend;
      await logAiUsage({
        supabase,
        userId: user.id,
        actionType: "generate_instacue",
        modelId,
        backend: out.backend,
        usage: out.usage,
        metadata: {
          board,
          subject,
          classLevel,
          topic,
          subtopicName,
          level,
          attempt,
          minCards,
          targetCards,
          ragChunkCount: rag?.chunkCount ?? 0,
        },
      });
      const parsed = tryParseJsonObjectWithSalvage(out.raw);
      if (!parsed) {
        console.warn(
          `[generate-instacue] JSON parse failed after salvage (attempt ${attempt}) subtopic=${subtopicName.slice(0, 80)}`
        );
        items = [];
        continue;
      }
      items = normalizeInstaCue(parsed.items);
      if (items.length >= minCards) break;
    }

    console.log(`[generate-instacue] backend=${backend} model=${modelId} topic=${topic} subtopic=${subtopicName} level=${level}`);
    if (items.length < minCards) {
      return NextResponse.json(
        {
          error: `Generated only ${items.length} InstaCue cards; minimum required is ${minCards}. Try regenerate again.`,
          code: "INSUFFICIENT_INSTACUE",
          minRequired: minCards,
          generated: items.length,
        },
        { status: 502 }
      );
    }

    const persistDb = supabaseForLongJobPersist(supabase);
    const safeItems = sanitizeJsonForDb(items);
    const { error: upsertError } = await persistDb.from("subtopic_content").update({
      instacue_cards: safeItems,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }).eq("board", board).eq("subject", subject).eq("class_level", classLevel)
      .eq("topic", topic).eq("subtopic_name", subtopicName).eq("level", level);

    if (upsertError) {
      console.error("instacue_cards update error", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    let trace: Record<string, unknown> | undefined;
    if (includeTrace) {
      trace = {
        generatedAt: new Date().toISOString(),
        pipelineSteps: [
          "Verify admin user.",
          "Fetch existing theory from subtopic_content.",
          rag?.formattedContext ? `Fetch RAG context (${rag?.chunkCount ?? 0} chunks).` : "RAG returned no context.",
          `Call Gemini "${modelId}" with InstaCue schema.`,
          `Generated ${items.length} cards. Saved to subtopic_content.instacue_cards.`,
        ],
        prompts: { systemInstruction: baseSystemInstruction, userPrompt: baseUserPrompt },
      };
    }

    return NextResponse.json({ ok: true, items, modelId, trace });
  } catch (e) {
    console.error("generate-instacue error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
