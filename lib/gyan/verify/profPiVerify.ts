/**
 * Optional Prof-Pi draft verification (second Sarvam call).
 * Pure routing helpers are unit-tested; network path lives in `maybeVerifyProfPiDraft`.
 */

import { getProfPiVerifyMaxTokens } from "@/lib/gyanContentPolicy";
import {
  draftHasProfPiStructure,
  formatSarvamAssistantReply,
  looksLikeVerifierMetaReview,
  resolveSarvamMaxTokens,
  sarvamChatCompletion,
} from "@/lib/sarvamGyanClient";

import type { Subject } from "@/types";

export type ProfPiRagKey = Subject;
export type ProfPiAnswerSource = "rephrase" | "rag_sarvam";

export function isProfPiVerifyEnabled(): boolean {
  return process.env.PROF_PI_VERIFY?.trim() === "1";
}

/**
 * Unicode math characters that the model sometimes emits instead of proper LaTeX
 * (superscripts, subscripts, integrals, sqrt, reaction arrows, common Greek). When these
 * appear in a draft, the verifier should run so it can rewrite them as `$...$` LaTeX
 * that KaTeX can render in the UI.
 */
const UNICODE_MATH_CHAR_RE =
  /[∫∑∏∂∇√≤≥≠≈±×÷⇌⇋↔→←⟶⟵⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺₀₁₂₃₄₅₆₇₈₉πΔαβγδεζηθικλμνξορστυφχψω]/;

/**
 * Heuristic: substantial LaTeX (integrals, vectors, display math) — physics / math verify candidate.
 * Also fires when the draft uses Unicode math characters instead of LaTeX, so the verifier gets a
 * chance to rewrite plain-text-math drafts as proper `$...$` LaTeX.
 */
export function draftLooksLikeHeavyStemLatex(draft: string): boolean {
  const t = draft ?? "";
  if (!t.trim()) return false;
  if (/\$\$[\s\S]{8,}\$\$/.test(t)) return true;
  if (/\\(int|sum|lim|frac|sqrt|oint|nabla|partial|prod)/i.test(t)) return true;
  if (/\\vec|\\mathbf|\\hat\{/.test(t)) return true;
  const inlineBlocks = t.match(/\$[^\$\n]{14,}\$/g);
  if ((inlineBlocks?.length ?? 0) >= 2) return true;
  // Catch the "model bypassed LaTeX and wrote raw Unicode math" failure mode.
  if (UNICODE_MATH_CHAR_RE.test(t)) return true;
  return false;
}

/**
 * Heuristic: draft likely contains LaTeX chemistry worth a second pass.
 */
/** Long physics draft with scratch-work narration and no section headers. */
export function draftLooksLikePhysicsRamble(draft: string): boolean {
  const t = (draft ?? "").trim();
  if (!t || t.length < 180 || draftHasProfPiStructure(t)) return false;
  const hits =
    t.match(/\b(?:Wait|Let me|Alternatively|But actually|So plugging)\b/gi)?.length ?? 0;
  return hits >= 2;
}

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
  const draft = params.draft ?? "";
  // Draft already has the wall layout + proper LaTeX — skip verifier (it often returns meta-review text).
  if (draftHasProfPiStructure(draft) && !UNICODE_MATH_CHAR_RE.test(draft)) {
    return false;
  }
  if (params.source === "rephrase") return true;
  switch (params.ragKey) {
    case "chemistry":
      return draftLooksLikeChemLatex(draft);
    case "math":
      return draftLooksLikeHeavyStemLatex(draft);
    case "physics":
      return (
        draftLooksLikeHeavyStemLatex(draft) ||
        draftLooksLikePhysicsRamble(draft) ||
        !draftHasProfPiStructure(draft)
      );
    default:
      return false;
  }
}

const VERIFIER_SYSTEM = `You are Prof-Pi's silent final-pass editor. Output ONLY the student-facing tutor answer — never a review of the draft.

ABSOLUTELY FORBIDDEN in your output:
- ANY review or checklist tone: "sections look okay", "is correct", "which is correct", "In the formula:", "For the substitution step", "LaTeX formatting", "written as", "becomes $...$", "don't have a".
- Any commentary about your verification process. Never write "Now, checking...", "The draft uses...", "Let me verify...", "Looking at the formatting...".
- Any preamble ("Here is the corrected version", "Sure", "I have reviewed").
- HTML, <think> tags, or chain-of-thought.

REQUIRED OUTPUT SHAPE (same as a good Prof-Pi post):
- First line MUST be a section header: **Formula:** or **Answer:** or **Proof:** or **Steps:** (then content below).
- Then optional **Proof:** / **Steps:** with bullet steps, **Key intuition:**, **Exam trap:**.
- Never start with "The" or "In the" or "For the".

CORRECTNESS — fix factual errors silently:
- Chemistry: wrong or unbalanced formulas; resonance vs tautomerism confusion; wrong reaction conditions.
- Physics: wrong signs, units, broken conservation, inconsistent reference frames.
- Math: wrong algebra/calculus, wrong limits, identity used outside its domain.
- Sign discipline in calculus: in u-substitution or by-parts, the sign of $du$ MUST carry through every step. Mentally differentiate the final antiderivative and confirm it matches the integrand. Fix any mid-chain sign flip.

FORMAT — convert ALL Unicode math to LaTeX inside $...$ (silently, no commentary):
- \`sin⁻¹x\` → \`$\\sin^{-1} x$\`
- \`x²\` / \`x³\` → \`$x^2$\` / \`$x^3$\`
- \`√(1-x²)\` → \`$\\sqrt{1-x^2}$\`
- \`∫f(x) dx\` → \`$\\int f(x)\\,dx$\`
- \`H₂O\`, \`CO₂\` → \`$H_2O$\`, \`$CO_2$\`
- \`⇌\`, \`→\` → \`\\rightleftharpoons\`, \`\\rightarrow\` (inside math mode)
Never leave bare Unicode math (⁻¹ ² ³ ⁴ √ ∫ ∑ ⇌ →) in narrative text. Do NOT wrap chemical species in \\text{...}.

OUTPUT RULES:
- If the draft is already factually correct AND already uses LaTeX everywhere: output the draft VERBATIM.
- Otherwise: output the corrected version with the SAME sections and steps — fix errors/format only; do NOT drop steps or shorten to save space.
- Prefer $inline$ LaTeX; keep $$display$$ only if the draft already used it.
- Start your reply with the first word of the corrected answer. End with the last word. Nothing before, nothing after.`;

const PHYSICS_VERIFIER_APPEND = `

PHYSICS (when the doubt is numerical / EM / mechanics):
- Reformat into **Given:** (bullets with units) → **Formula:** → **Steps:** (3–5 bullets) → **Answer:** (with SI units) → optional **Key intuition:** / **Exam trap:**.
- Delete ALL "Wait", "Let me confirm", "Alternatively", "But actually", "So plugging in" narration — never leave scratch-work in the output.`;

function buildVerifierSystemPrompt(ragKey: ProfPiRagKey): string {
  if (ragKey === "physics") return VERIFIER_SYSTEM + PHYSICS_VERIFIER_APPEND;
  return VERIFIER_SYSTEM;
}

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

DRAFT ANSWER (fix errors/LaTeX only — output the SAME structured answer for students, NOT a review of this draft):
${draft}

Reply with ONLY the final markdown answer students should read. Do not describe or evaluate the draft.`;
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

  const draft = params.draft.trim();
  const verifyMaxTokens = resolveSarvamMaxTokens(getProfPiVerifyMaxTokens(draft.length));

  const r = await sarvamChatCompletion({
    systemPrompt: buildVerifierSystemPrompt(params.ragKey),
    userContent: buildProfPiVerifierUserContent({
      title: params.title,
      body: params.body,
      draft,
    }),
    temperature: 0.15,
    maxTokens: verifyMaxTokens,
    timeoutMs: 45_000,
    metricsLabel: "profPi_verify",
  });

  if (!r.ok) {
    return { text: draft, ran: true, ok: false, error: r.error };
  }
  const out = formatSarvamAssistantReply(r.text);
  if (!out || out.length < 40) {
    return { text: draft, ran: true, ok: false, error: "verifier_empty" };
  }
  if (looksLikeVerifierMetaReview(out)) {
    console.warn("[profPiVerify] verifier returned meta-review text; keeping draft");
    return { text: draft, ran: true, ok: false, error: "verifier_meta_review" };
  }
  if (draftHasProfPiStructure(draft) && !draftHasProfPiStructure(out)) {
    console.warn("[profPiVerify] verifier removed section structure; keeping draft");
    return { text: draft, ran: true, ok: false, error: "verifier_broke_structure" };
  }
  // Verifier capped at max_tokens often stops mid-step (e.g. at "Substitute …") — keep full draft.
  if (out.length < draft.length * 0.72 && draft.length > 500) {
    console.warn(
      `[profPiVerify] verifier output shorter than draft (${out.length} vs ${draft.length} chars); keeping draft`
    );
    return { text: draft, ran: true, ok: false, error: "verifier_truncated" };
  }
  return { text: out, ran: true, ok: true };
}
