/**
 * Optional Prof-Pi draft verification (second Sarvam call).
 * Pure routing helpers are unit-tested; network path lives in `maybeVerifyProfPiDraft`.
 */

import { getProfPiVerifyMaxTokens } from "@/lib/gyanContentPolicy";
import { formatSarvamAssistantReply, sarvamChatCompletion } from "@/lib/sarvamGyanClient";

export type ProfPiRagKey = "physics" | "chemistry" | "math" | "biology";
export type ProfPiAnswerSource = "rephrase" | "rag_sarvam";

export function isProfPiVerifyEnabled(): boolean {
  return process.env.PROF_PI_VERIFY?.trim() === "1";
}

/**
 * Heuristic: substantial LaTeX (integrals, vectors, display math) — physics / math verify candidate.
 */
export function draftLooksLikeHeavyStemLatex(draft: string): boolean {
  const t = draft ?? "";
  if (!t.trim()) return false;
  if (/\$\$[\s\S]{8,}\$\$/.test(t)) return true;
  if (/\\(int|sum|lim|frac|sqrt|oint|nabla|partial|prod)/i.test(t)) return true;
  if (/\\vec|\\mathbf|\\hat\{/.test(t)) return true;
  const inlineBlocks = t.match(/\$[^\$\n]{14,}\$/g);
  return (inlineBlocks?.length ?? 0) >= 2;
}

/**
 * Heuristic: longer biology answer with exam-heavy vocabulary — verify candidate.
 */
export function draftLooksLikeBioTechnical(draft: string): boolean {
  const t = draft ?? "";
  /** Avoid one-liner false positives; typical NCERT-style explanations exceed this. */
  if (t.length < 300) return false;
  return /\b(mitosis|meiosis|photosynthesis|cellular respiration|glycolysis|Krebs|citric acid cycle|calvin|transcription|translation|replication|cross(?:ing)? ?over|allele|genotype|phenotype|homeostasis|synap(?:se|tic)|neuron|hormone|enzyme|ATP|NADH|DNA|RNA|mRNA|tRNA|ribosome|nucleotide|mutation|ecosystem|food chain|nitrogen fixation)\b/i.test(
    t
  );
}

/**
 * Heuristic: draft likely contains LaTeX chemistry worth a second pass.
 */
export function draftLooksLikeChemLatex(draft: string): boolean {
  const t = draft ?? "";
  if (!t.trim()) return false;
  const lower = t.toLowerCase();
  const strongChemLatex =
    /\\rightleftharpoons|\\leftrightarrow|\\longrightarrow|\\rightarrow|\\ce\{|\bchem\b/i.test(t);
  const latexish = /\$[^$]{6,}\$|\$\$[\s\S]{6,}\$\$/.test(t);
  const subscripts = /_[0-9]|COCH|C\(OH\)|H_3|CH_3|CH_2/i.test(t);
  const orgKeyword = /keto|enol|tautomer/i.test(t);
  return (
    strongChemLatex ||
    (latexish && subscripts) ||
    (latexish && orgKeyword) ||
    (lower.includes("chemistry") && latexish)
  );
}

export function shouldRunProfPiVerifier(params: {
  draft: string;
  ragKey: ProfPiRagKey;
  source: ProfPiAnswerSource;
}): boolean {
  if (params.source === "rephrase") return true;
  switch (params.ragKey) {
    case "chemistry":
      return draftLooksLikeChemLatex(params.draft);
    case "math":
    case "physics":
      return draftLooksLikeHeavyStemLatex(params.draft);
    case "biology":
      return draftLooksLikeBioTechnical(params.draft);
    default:
      return false;
  }
}

const VERIFIER_SYSTEM = `You are a strict fact-checker for a CBSE/NCERT-level tutor answer (Prof-Pi), across **physics, chemistry, math, and biology**.

TASK:
1) Read the STUDENT QUESTION and the DRAFT ANSWER below.
2) Fix ONLY clear factual errors, for example:
   - Chemistry: wrong or unbalanced formulas; mixing resonance vs tautomerism; incorrect reaction conditions.
   - Physics: wrong signs, units, or energy/conservation reasoning; inconsistent reference frames.
   - Math: incorrect algebra/calculus; wrong limits; identity used outside its domain.
   - Biology: wrong process names (mitosis vs meiosis, etc.); inconsistent genetics logic; overstated causation.
3) If the draft is already correct, output it **unchanged** (same markdown).
4) Output **markdown only** — no preamble, no "Here is the corrected version".
5) Preserve length and tone: do not expand into a long essay; keep the same structure when possible.
6) LaTeX: prefer $inline$; keep $$...$$ only if the draft used it. No HTML. Do NOT wrap chemical species in \\text{...}.`;

export function buildProfPiVerifierUserContent(params: {
  title: string;
  body: string;
  draft: string;
}): string {
  const title = (params.title ?? "").slice(0, 500);
  const body = (params.body ?? "").slice(0, 2000);
  const draft = (params.draft ?? "").slice(0, 8000);
  return `STUDENT QUESTION TITLE:
${title}

STUDENT QUESTION BODY:
${body}

DRAFT ANSWER (markdown — correct if needed, else repeat verbatim):
${draft}`;
}

/**
 * Second Sarvam call; on any failure returns the original draft (caller must not block publish).
 */
export async function maybeVerifyProfPiDraft(params: {
  draft: string;
  title: string;
  body: string;
  ragKey: ProfPiRagKey;
  source: ProfPiAnswerSource;
}): Promise<{ text: string; ran: boolean; ok: boolean; error?: string }> {
  if (!isProfPiVerifyEnabled()) {
    return { text: params.draft, ran: false, ok: true };
  }
  if (!shouldRunProfPiVerifier(params)) {
    return { text: params.draft, ran: false, ok: true };
  }

  const r = await sarvamChatCompletion({
    systemPrompt: VERIFIER_SYSTEM,
    userContent: buildProfPiVerifierUserContent({
      title: params.title,
      body: params.body,
      draft: params.draft,
    }),
    temperature: 0.15,
    maxTokens: getProfPiVerifyMaxTokens(),
    timeoutMs: 45_000,
    metricsLabel: "profPi_verify",
  });

  if (!r.ok) {
    return { text: params.draft, ran: true, ok: false, error: r.error };
  }
  const out = formatSarvamAssistantReply(r.text);
  if (!out || out.length < 40) {
    return { text: params.draft, ran: true, ok: false, error: "verifier_empty" };
  }
  return { text: out, ran: true, ok: true };
}
