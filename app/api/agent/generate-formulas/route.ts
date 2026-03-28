import { NextResponse } from "next/server";
import { ApiError } from "@google/genai";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import {
  generateArtifactJson,
  formulasResponseSchema,
  isVertexForTopicAgentEnabled,
} from "@/lib/geminiTopicGenerate";
import { isAdminUser } from "@/lib/admin";
import { supabaseForLongJobPersist } from "@/lib/supabaseAdminPersist";
import { resolveGeminiModelId, resolveVertexTopicModelId } from "@/lib/geminiModel";
import { normalizeSubjectKey, normalizeSubtopicContentKey } from "@/lib/subtopicContentKeys";

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);
const MIN_BITS_PER_FORMULA = 5;
const MIN_ACCEPTABLE_VERIFIER_SCORE = 0.85;

function sanitize(value: unknown, maxLen = 400): string {
  if (typeof value !== "string") return "";
  // Keep symbolic chars like ">" in topic/subtopic names; strip only control chars.
  return value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

type FormulaBit = {
  question: string;
  options: string[];
  correctAnswer: string;
  solution: string;
};

type FormulaItem = {
  name: string;
  formulaLatex: string;
  description: string;
  bitsQuestions: FormulaBit[];
};

type FormulaVerificationResult = {
  approved: boolean;
  score: number;
  notes: string;
  items: FormulaItem[];
};

function normalizeLatex(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^\\?\$\\?\$([\s\S]*)\\?\$\\?\$$/, "$1")
    .replace(/^\\\(([\s\S]*)\\\)$/, "$1")
    .replace(/^\\\[([\s\S]*)\\\]$/, "$1")
    .trim();
}

function formulasVerifierSchema() {
  return {
    type: "object",
    properties: {
      approved: { type: "boolean" },
      score: { type: "number" },
      notes: { type: "string" },
      items: formulasResponseSchema().properties.items,
    },
    required: ["approved", "score", "notes", "items"],
  };
}

function normalizeAndValidateFormulaItems(input: unknown): FormulaItem[] {
  const parsed = Array.isArray(input) ? input : [];
  const out: FormulaItem[] = [];
  for (const x of parsed) {
    if (!x || typeof x !== "object") continue;
    const it = x as FormulaItem;
    const name = sanitize(it.name, 140);
    const formulaLatex = normalizeLatex(sanitize(it.formulaLatex, 1200));
    const description = sanitize(it.description, 500);
    const bitsQuestions = Array.isArray(it.bitsQuestions) ? it.bitsQuestions : [];
    const normalizedBits = bitsQuestions
      .map((q) => ({
        question: sanitize(q?.question, 800),
        options: Array.isArray(q?.options)
          ? q.options.map((o) => sanitize(o, 500)).filter(Boolean).slice(0, 4)
          : [],
        correctAnswer: sanitize(q?.correctAnswer, 500),
        solution: sanitize(q?.solution, 1200),
      }))
      .filter((q) => {
        if (!q.question || q.options.length !== 4 || !q.correctAnswer || !q.solution) return false;
        if (!q.options.includes(q.correctAnswer)) return false;
        const uniqueOptions = new Set(q.options.map((o) => o.toLowerCase()));
        return uniqueOptions.size === 4;
      });
    if (!name || !formulaLatex || !description || normalizedBits.length === 0) continue;
    out.push({ name, formulaLatex, description, bitsQuestions: normalizedBits });
  }
  return out;
}

async function verifyFormulaItems(params: {
  apiKey: string | undefined;
  modelId: string;
  subject: string;
  classLevel: number;
  topic: string;
  subtopicName: string;
  level: string;
  items: FormulaItem[];
}): Promise<FormulaVerificationResult> {
  const verificationSystemInstruction = `You are a strict senior exam reviewer.
Verify formula practice sets for correctness, not style.
Hard rules:
- Every MCQ must have exactly 4 options.
- correctAnswer must be exactly one of the options.
- Solution must logically justify the correctAnswer.
- Fix wrong keys or mathematically incorrect items.
- If confidence is low after fixing, set approved=false.
Return JSON only.`;

  const verificationPrompt = `Subject: ${params.subject}
Class: ${params.classLevel}
Topic: ${params.topic}
Subtopic: ${params.subtopicName}
Level: ${params.level}
Candidate items:
${JSON.stringify({ items: params.items })}`;

  const out = await generateArtifactJson({
    apiKey: params.apiKey,
    modelId: params.modelId,
    userPrompt: verificationPrompt,
    systemInstruction: verificationSystemInstruction,
    temperature: 0.1,
    responseSchema: formulasVerifierSchema(),
  });
  const parsed = JSON.parse(out.raw) as Partial<FormulaVerificationResult>;
  const verifiedItems = normalizeAndValidateFormulaItems(parsed.items);
  const score =
    typeof parsed.score === "number" && Number.isFinite(parsed.score)
      ? Math.max(0, Math.min(1, parsed.score))
      : 0;
  return {
    approved: parsed.approved === true && score >= MIN_ACCEPTABLE_VERIFIER_SCORE,
    score,
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
    items: verifiedItems,
  };
}

function enrichFormulaBits(item: FormulaItem): FormulaItem {
  const base = Array.isArray(item.bitsQuestions) ? item.bitsQuestions : [];
  const normalized = base
    .filter((q) => q && typeof q.question === "string" && Array.isArray(q.options))
    .map((q) => ({
      question: q.question.trim(),
      options: q.options.slice(0, 4).map((o) => String(o ?? "").trim()),
      correctAnswer: String(q.correctAnswer ?? "").trim(),
      solution: String(q.solution ?? "").trim(),
    }))
    .filter((q) => q.question && q.options.length === 4 && q.options.every(Boolean));

  if (normalized.length === 0) return { ...item, bitsQuestions: [] };

  const out = [...normalized];
  let i = 0;
  while (out.length < MIN_BITS_PER_FORMULA) {
    const seed = normalized[i % normalized.length]!;
    out.push({
      // Accuracy-first: duplicate validated items instead of random mutation.
      question: seed.question,
      options: seed.options,
      correctAnswer: seed.correctAnswer,
      solution: seed.solution,
    });
    i += 1;
  }

  return {
    ...item,
    formulaLatex: normalizeLatex(item.formulaLatex),
    bitsQuestions: out,
  };
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
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
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

    const systemInstruction = `You are an expert ${subject} educator for CBSE Class ${classLevel}. Extract all important formulas from the provided subtopic theory, and for each formula generate practice MCQs.
Each formula object has:
- name: Name of the formula (e.g. "Newton's Second Law", "Ideal Gas Equation")
- formulaLatex: The formula in LaTeX notation (e.g. "F = ma", "PV = nRT")
- description: Short description of what the formula represents and when to use it
- bitsQuestions: Array of MINIMUM 5 practice MCQs that test calculation or conceptual application of this formula. Each has: question, options (4 choices), correctAnswer (must match an option), solution.

Rules:
- Extract ALL formulas present in the theory. If the subtopic is conceptual with no formulas, return an empty items array.
- Subject-specific framing:
  - Math: include algebraic manipulation, parameter constraints, and coordinate/geometry traps.
  - Physics: include units, sign convention traps, and multi-step numericals.
  - Chemistry: include stoichiometric/molar reasoning, unit consistency, and conceptual traps.
- For ${level} level: ${level === "basics" ? "keep base numericals direct but still include at least one conceptual trap." : level === "intermediate" ? "include NCERT-style numericals with sign conventions and at least one multi-step question." : "include multi-step problems, edge cases, parameter perturbations, and exam-style traps."}
- Output formulaLatex WITHOUT wrapping delimiters (no $$, no \\( \\), no \\[ \\]). Return pure latex expression only.
- Each MCQ must have exactly 4 plausible options.
- Output valid JSON only.`;

    const userPrompt = `Topic: ${topic}
Subtopic: ${subtopicName}
Level: ${level}
Theory:
${existing.theory.slice(0, 12000)}`;

    const formulasModelRaw =
      process.env.FORMULAS_GEMINI_MODEL?.trim() ||
      process.env.FORMULAS_CHEAP_MODEL?.trim() ||
      "gemini-2.5-flash";
    const { modelId: studioModelId } = resolveGeminiModelId(formulasModelRaw);
    const vertexEnabled = isVertexForTopicAgentEnabled();
    const { modelId: vertexResolvedId } = resolveVertexTopicModelId(studioModelId);
    const modelId = vertexEnabled ? vertexResolvedId : studioModelId;
    const verifierModelRaw =
      process.env.FORMULAS_VERIFIER_MODEL?.trim() || modelId;
    const { modelId: verifierStudioModelId } = resolveGeminiModelId(verifierModelRaw);
    const { modelId: verifierVertexResolvedId } = resolveVertexTopicModelId(verifierStudioModelId);
    const verifierModelId = vertexEnabled ? verifierVertexResolvedId : verifierStudioModelId;

    const { raw, backend } = await generateArtifactJson({
      apiKey,
      modelId,
      userPrompt,
      systemInstruction,
      temperature: 0.25,
      responseSchema: formulasResponseSchema(),
    });

    console.log(`[generate-formulas] backend=${backend} model=${modelId} topic=${topic} subtopic=${subtopicName} level=${level}`);

    // Second Gemini call (verifier) follows immediately — brief pause reduces 429 bursts on Vertex.
    await new Promise((r) => setTimeout(r, 5000));

    const parsed = JSON.parse(raw) as { items?: unknown[] };
    const seedItems = normalizeAndValidateFormulaItems(parsed.items);
    const reviewed = await verifyFormulaItems({
      apiKey,
      modelId: verifierModelId,
      subject,
      classLevel,
      topic,
      subtopicName,
      level,
      items: seedItems,
    });
    const verifiedItems = reviewed.items.map((it) => enrichFormulaBits(it));
    if (!reviewed.approved || verifiedItems.length === 0) {
      return NextResponse.json(
        {
          error:
            "Formula regenerate did not pass quality validation. Please retry regenerate.",
          code: "FORMULA_VALIDATION_FAILED",
          score: reviewed.score,
          notes: reviewed.notes,
        },
        { status: 422 }
      );
    }
    const items = verifiedItems;

    // Persist after long Gemini + verifier — user JWT may be expired; use service role if configured.
    const persistDb = supabaseForLongJobPersist(supabase);
    const { error: upsertError } = await persistDb.from("subtopic_content").update({
      practice_formulas: JSON.parse(JSON.stringify(items)),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }).eq("board", board).eq("subject", subject).eq("class_level", classLevel)
      .eq("topic", topic).eq("subtopic_name", subtopicName).eq("level", level);

    if (upsertError) {
      console.error("practice_formulas update error", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    let trace: Record<string, unknown> | undefined;
    if (includeTrace) {
      trace = {
        generatedAt: new Date().toISOString(),
        pipelineSteps: [
          "Verify admin user.",
          "Fetch existing theory from subtopic_content.",
          `Call Gemini "${modelId}" with Formulas schema (cheap model path).`,
          `Call verifier model "${verifierModelId}" for correctness review.`,
          `Validation score: ${reviewed.score.toFixed(2)} (${reviewed.approved ? "approved" : "rejected"}).`,
          `Saved ${items.length} verified formulas with practice questions to subtopic_content.practice_formulas.`,
        ],
        prompts: { systemInstruction, userPrompt },
      };
    }

    return NextResponse.json({
      ok: true,
      items,
      modelId,
      verifier: {
        modelId: verifierModelId,
        score: reviewed.score,
        approved: reviewed.approved,
        notes: reviewed.notes,
      },
      trace,
    });
  } catch (e) {
    console.error("generate-formulas error", e);
    if (e instanceof ApiError && e.status === 429) {
      return NextResponse.json(
        {
          error:
            "Gemini/Vertex quota or rate limit (429) after automatic retries. Wait 1–2 minutes and click Regenerate AI Cards, or stagger Deep Dive + artifacts.",
          code: "RATE_LIMIT",
        },
        { status: 503 }
      );
    }
    const msg = e instanceof Error ? e.message : "Server error";
    if (/429|RESOURCE_EXHAUSTED|resource exhausted/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Gemini rate limit (429). Automatic retries were used; wait briefly and run Regenerate AI Cards again.",
          code: "RATE_LIMIT",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
