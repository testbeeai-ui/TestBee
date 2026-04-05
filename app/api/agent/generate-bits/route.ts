import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import {
  generateArtifactJson,
  bitsResponseSchema,
  isVertexForTopicAgentEnabled,
} from "@/lib/geminiTopicGenerate";
import { isAdminUser } from "@/lib/admin";
import { supabaseForLongJobPersist } from "@/lib/supabaseAdminPersist";
import { resolveGeminiModelId, resolveVertexTopicModelId } from "@/lib/geminiModel";
import { fetchRAGContext } from "@/lib/rag";
import { normalizeSubjectKey, normalizeSubtopicContentKey } from "@/lib/subtopicContentKeys";
import { getGeminiApiKeyFromEnv } from "@/lib/geminiEnv";
import { logAiUsage } from "@/lib/aiLogger";
import { sanitizeJsonForDb } from "@/lib/sanitizeJsonForDb";
import { tryParseJsonObjectWithSalvage } from "@/lib/parseModelJson";

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);

const MIN_BITS_BY_LEVEL: Record<string, number> = {
  basics: 10,
  intermediate: 15,
  advanced: 25,
};

function normalizeBits(value: unknown): Array<{
  question: string;
  options: string[];
  correctAnswer: string;
  solution: string;
}> {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const question = typeof o.question === "string" ? o.question.trim() : "";
      const options = Array.isArray(o.options)
        ? o.options.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean)
        : [];
      let correctAnswer = typeof o.correctAnswer === "string" ? o.correctAnswer.trim() : "";
      const solution = typeof o.solution === "string" ? o.solution.trim() : "";
      if (!question || options.length !== 4 || !correctAnswer || !solution) return null;

      if (!options.includes(correctAnswer)) {
        const fuzzyAns = correctAnswer.replace(/\s+/g, "").toLowerCase();
        const matchedOpt = options.find((opt) => opt.replace(/\s+/g, "").toLowerCase() === fuzzyAns);
        if (matchedOpt) {
          correctAnswer = matchedOpt;
        } else {
          return null;
        }
      }

      return { question, options, correctAnswer, solution };
    })
    .filter((x): x is { question: string; options: string[]; correctAnswer: string; solution: string } => Boolean(x));
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

    const minBits = MIN_BITS_BY_LEVEL[level] ?? 10;
    const targetBits = level === "advanced" ? 32 : level === "intermediate" ? 20 : 14;
    const ragMatchCount = level === "advanced" ? 24 : level === "intermediate" ? 16 : 10;
    const ragQuery = `${topic} ${subtopicName} CBSE Class ${classLevel} ${subject} exam MCQ numerical conceptual`;
    const rag = await fetchRAGContext(ragQuery, subject, classLevel, topic, subtopicName, ragMatchCount);
    const ragBlock = rag?.formattedContext
      ? `\n\nRAG CONTEXT (trusted textbook snippets):\n${rag.formattedContext}`
      : "";

    const baseSystemInstruction = `You are an expert ${subject} educator for CBSE Class ${classLevel}. Generate multiple-choice questions (Bits) from the provided subtopic theory.
Each question has:
- question: The MCQ question text
- options: Array of exactly 4 answer choices
- correctAnswer: Must match one of the options exactly
- solution: Step-by-step solution explanation

Rules:
- Generate at least ${minBits} questions (strict minimum). Prefer ${targetBits}+ if content supports.
- Questions should test conceptual understanding, formula application, and exam-style problem solving.
- Include a mix of easy, medium, and hard questions.
- For ${level} level: ${level === "basics" ? "focus on definitions, basic concepts, and simple application." : level === "intermediate" ? "include NCERT-style problems, derivation-based questions, and numerical problems." : "include HOTS questions, multi-concept problems, competitive exam style, and trap questions."}
- Write question, every option, and solution in normal English (or exam-style phrasing). You MUST wrap ANY math expressions, variables, units, or symbols in inline math delimiters: \\( ... \\). Use $$ ... $$ only for true display/block equations when needed. Never put bare LaTeX like \\mu, \\sigma, or exponents such as m^2 in plain text — always delimit them.
- Each option should be plausible — no obviously wrong fillers.
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
    let items: Array<{ question: string; options: string[]; correctAnswer: string; solution: string }> = [];
    let raw = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      const shortfallHint =
        attempt === 1
          ? ""
          : attempt === 2
            ? `\n\nSTRICT REPAIR: previous output had fewer than ${minBits} valid questions. Return at least ${minBits} fully valid questions now.`
            : `\n\nCRITICAL: Your previous reply was not valid JSON (e.g. trailing commas, single quotes, or unescaped backslashes in strings). Output ONE JSON object only: {"items":[...]} with double-quoted keys and strings. Escape every backslash inside strings as \\\\. At least ${minBits} questions.`;
      const out = await generateArtifactJson({
        apiKey,
        modelId,
        userPrompt: `${baseUserPrompt}${shortfallHint}`,
        systemInstruction: baseSystemInstruction,
        temperature: attempt === 1 ? 0.5 : attempt === 2 ? 0.35 : 0.25,
        responseSchema: bitsResponseSchema(),
      });
      raw = out.raw;
      backend = out.backend;
      await logAiUsage({
        supabase,
        userId: user.id,
        actionType: "generate_bits",
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
          minBits,
          targetBits,
          ragChunkCount: rag?.chunkCount ?? 0,
        },
      });
      const parsed = tryParseJsonObjectWithSalvage(raw);
      if (!parsed) {
        console.warn(
          `[generate-bits] JSON parse failed after salvage (attempt ${attempt}) subtopic=${subtopicName.slice(0, 80)}`
        );
        items = [];
        continue;
      }
      items = normalizeBits(parsed.items);
      if (items.length >= minBits) break;
    }

    console.log(`[generate-bits] backend=${backend} model=${modelId} topic=${topic} subtopic=${subtopicName} level=${level}`);
    if (items.length < minBits) {
      return NextResponse.json(
        {
          error: `Generated only ${items.length} Bits; minimum required is ${minBits}. Try regenerate again.`,
          code: "INSUFFICIENT_BITS",
          minRequired: minBits,
          generated: items.length,
        },
        { status: 502 }
      );
    }

    const persistDb = supabaseForLongJobPersist(supabase);
    const safeItems = sanitizeJsonForDb(items);
    const { error: upsertError } = await persistDb.from("subtopic_content").update({
      bits_questions: safeItems,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }).eq("board", board).eq("subject", subject).eq("class_level", classLevel)
      .eq("topic", topic).eq("subtopic_name", subtopicName).eq("level", level);

    if (upsertError) {
      console.error("bits_questions update error", upsertError);
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
          `Call Gemini "${modelId}" with Bits MCQ schema.`,
          `Generated ${items.length} questions. Saved to subtopic_content.bits_questions.`,
        ],
        prompts: { systemInstruction: baseSystemInstruction, userPrompt: baseUserPrompt },
      };
    }

    return NextResponse.json({ ok: true, items, modelId, trace });
  } catch (e) {
    console.error("generate-bits error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
