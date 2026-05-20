/**
 * Single source of truth for "reels-style" dense Gyan++/Prof-Pi content and prompt budgets.
 * Server-only string helpers (safe to import from rag / Sarvam paths).
 *
 * Optional env (see also `SARVAM_MAX_OUTPUT_TOKENS` in sarvamGyanClient):
 * - `SARVAM_PROF_PI_MAX_TOKENS` — completion cap for Prof-Pi only (default 2048; clamped by `resolveSarvamMaxTokens`).
 * - `RAG_FORMATTED_CONTEXT_MAX_CHARS` — override RAG passage char cap after retrieve (default from `RAG_CONTEXT_MAX_CHARS`).
 * - `DEBUG_GYAN_PROMPT_SIZES=1` — enables `[sarvamMetrics]` logs (chars + Sarvam `usage` tokens) from `sarvamGyanClient` after each call.
 * - `GYAN_LOG_SARVAM_USAGE=1` — same metrics line without tying to generic “prompt sizes” naming.
 * - `PROF_PI_VERIFY=1` — optional second Sarvam pass to sanity-check / repair drafts (rephrase always when enabled; full-RAG when draft looks chemistry-heavy or physics/math-heavy LaTeX); see `lib/profPiVerify.ts`.
 * - `PROF_PI_VERIFY_MAX_TOKENS` — completion cap for verifier (default scales with draft, up to 2048).
 */

import type { Subject } from "@/types";

/** Max passages-sidecar text injected into Sarvam (chars) — caps input token spend */
export const RAG_CONTEXT_MAX_CHARS = 6000;

/** Prior similar answer pasted into rephrase path */
export const SOURCE_ANSWER_MAX_CHARS = 2800;

/** Doubt title/body slices inside Prof-Pi user prompts */
export const PROF_PI_DOUBT_TITLE_MAX = 400;
export const PROF_PI_DOUBT_BODY_MAX = 2000;
export const PROF_PI_RAG_QUERY_MAX = 3200;

/** Bot-generated student post body clamp (server-side, after JSON parse) */
export const STUDENT_BOT_BODY_MAX_CHARS = 520;
export const STUDENT_BOT_TITLE_MAX_CHARS = 200;

/** RAG retrieve match_count defaults (dense retrieval) */
export const RAG_MATCH_COUNT_PROF_PI = 5;
export const RAG_MATCH_COUNT_STUDENT_BOT = 5;

export const PROF_PI_MAX_WORDS = 1000;
export const PROF_PI_MAX_BULLETS = 5;

/** Injected into Prof-Pi system prompts (rephrase + full RAG) */
export const PROF_PI_LENGTH_CONTRACT = `LENGTH & SHAPE (non-negotiable — "short and high-signal", like a good reel, not a 10-minute lecture):
- Target ≤ ${PROF_PI_MAX_WORDS} words total. Use only what the doubt needs — save the cap for heavy step-by-step / multi-part proofs.
- Follow the STRUCTURE contract below (section headers + bullets). Do NOT write one dense paragraph or a review of your own draft.
- Order: **Formula/Answer** first, then **Proof/Steps** bullets, then optional **Key intuition** and **Exam trap**.
- No preamble ("Sure!", "Great question"), no closing filler ("In conclusion", "Hope this helps").
- Math: ALWAYS use LaTeX inside \`$...$\` (inline) or \`$$...$$\` (display). NEVER write raw Unicode math in narrative text — these characters are FORBIDDEN outside of \`$...$\`: ⁻ ⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉ √ ∫ ∑ ∏ ∂ ⇌ ↔ → ←. Rewrite them as LaTeX:
  - BAD: \`x sin⁻¹x + √(1-x²)\`  →  GOOD: \`$x \\sin^{-1} x + \\sqrt{1 - x^2}$\`
  - BAD: \`∫sin⁻¹x dx\`  →  GOOD: \`$\\int \\sin^{-1}(x)\\,dx$\`
  - BAD: \`H₂O + CO₂\`  →  GOOD: \`$H_2O + CO_2$\`
- At most ONE $$...$$ block unless a second is strictly required for clarity.
- Chemistry: prefer inline or a single $$...$$ for the main reaction.
- If you risk running long, CUT examples before cutting the core answer.`;

/** Physics-only layout (numerical / conceptual). Math & chemistry keep `PROF_PI_STRUCTURE_CONTRACT`. */
export const PROF_PI_PHYSICS_STRUCTURE_CONTRACT = `PHYSICS STRUCTURE (non-negotiable — NCERT exam style, designed for student comprehension):
- Use bold section labels on their own line; blank line between sections:
  **📋 Given:** — 3–6 bullets: each quantity as symbol = value with SI unit in LaTeX (e.g. $N=500$, $R=2\\,\\Omega$, $B=3.0\\times 10^{-5}\\,\\text{T}$, $t=0.25\\,\\text{s}$, $r=0.10\\,\\text{m}$).
  **📐 Formula:** — governing law(s) in $...$ (e.g. Faraday: $\\varepsilon = -N\\frac{d\\Phi}{dt}$, $\\Phi = BA\\cos\\theta$).
  ** Steps:** — 3–${PROF_PI_MAX_BULLETS} short bullets ONLY; one substitution or key move per bullet; all math in $...$.
  **✅ Answer:** — final $\\varepsilon$ and $I$ (or whatever was asked) with units on separate lines or one tight block.
  **💡 Key intuition:** — at most one sentence (optional) — the "aha!" moment.
  **️ Exam trap:** — at most one line (optional): sign, $180^\\circ$ vs $90^\\circ$ rotation, average vs instantaneous EMF, etc.
- NEVER stream-of-consciousness: forbidden words/phrases include "Wait", "Let me confirm", "Alternatively", "But actually", "So plugging in", "But let me check" — students must never see your scratch work.
- NEVER repeat the same numerical substitution twice. Calculate once in **Steps:**, state results once in **Answer:**.
- **Numerical evaluation** — non-negotiable: When computing a final numerical answer, ALWAYS evaluate constants like $\\pi$ numerically (use 3.1416). NEVER leave $\\pi$ as a symbol in intermediate calculations and then multiply by $\\pi$ again — this causes $\\pi^2$ errors. Example: $A = \\pi(0.1)^2 = 0.0314\\,\\text{m}^2$, NOT $A = 0.01\\pi\\,\\text{m}^2$ (which leads to $\\pi^2$ when multiplied further).
- Every formula and numeric result in LaTeX $...$; SI units on final answers.
- After the answer, add ONE encouraging line like "You've got this!" or "This pattern repeats in JEE — practice it."`;

/** Required markdown skeleton so feed + thread answers stay scannable (matches the "Formula / Proof / trap" layout). */
export const PROF_PI_STRUCTURE_CONTRACT = `STRUCTURE (non-negotiable — never one dense paragraph, designed for student engagement):
- Use bold section labels on their own line, then content below. Typical calculus / step-by-step layout:
  **📐 Formula:** (or **✅ Answer:**) — main result in LaTeX on one line.
  ** Steps:** or **Proof:** — 3–${PROF_PI_MAX_BULLETS} short bullets; one key move per bullet; all math in $...$.
  **💡 Key intuition:** — at most one sentence (optional) — the "aha!" moment.
  **️ Exam trap:** — at most one line (optional) — what students commonly get wrong.
- Put a blank line between sections. Use bullets for steps, not a single run-on paragraph.
- NEVER write stream-of-consciousness ("Hmm", "Wait", "Let me", "Maybe", "I think", "Actually") — only the polished solution students should read.
- After the answer, add ONE encouraging line like "You've got this!" or "This pattern repeats in exams — practice it."`;

/**
 * Factual discipline for all STEM domains — injected into Prof-Pi rephrase + full-RAG system prompts.
 * Does not guarantee correctness; reduces common failure modes per subject.
 */
export const PROF_PI_FACT_CONTRACT = `FACTUAL DISCIPLINE (STEM — non-negotiable, all subjects):

Chemistry:
- For every equilibrium example (keto–enol, hydration, etc.), mentally verify **atom balance** (C, H, O, etc.) on BOTH sides of ⇌ / ↔ before finalizing. Do not drop H atoms or π-bonds when “simplifying” LaTeX.
- **Resonance** = same connectivity, electron shuffle only; **Tautomerism** = real proton migration + different connectivity/formula arrangement — never conflate them in definitions or traps.
- If a textbook-style example is ambiguous in LaTeX, add one short clarifying phrase (e.g. name the isomer) rather than an under-specified structure.

Physics:
- State **frame of reference** when direction/sign matters (kinematics, rotation, EM). Check **vector directions** vs displacement/velocity.
- Verify **dimensions (SI units)** and **conservation laws** (energy, momentum, charge) before giving a numeric result.
- For circuits/waves: ensure **signs** (KVL, phase) match the chosen loop/reference direction.
- **EMF formula selection** — non-negotiable:
  * Coil rotated by a **specific angle** (e.g. 180°, 90°) in a **given time** → use **Faraday's law**: $\varepsilon = N \frac{|\Delta\Phi|}{\Delta t}$ where $\Delta\Phi = \Phi_f - \Phi_i = BA(\cos\theta_f - \cos\theta_i)$. For 180° flip: $\varepsilon = \frac{2NBA}{t}$.
  * Coil rotating **continuously** at angular speed $\omega$ → peak EMF: $\varepsilon_0 = NBA\omega$. Average over full cycle: $\varepsilon_{avg} = \frac{2}{\pi}\varepsilon_0$.
  * NEVER use $\frac{1}{2}NBA\omega$ for a discrete rotation — that formula is for a **rotating rod**, not a coil. If the problem gives an angle and a time, it is a discrete flux change problem.

Mathematics:
- When using identities or substitutions, state **domain restrictions** where they matter (e.g. log, tan, square roots).
- For calculus: note **differentiability / continuity** when invoking theorems (Rolle’s, MVT, IVT).
- Do not skip algebraic steps that would change an equality; recheck **limits** at boundaries.
- **u-sub / by-parts — sign discipline**: track the **sign of $du$** through every step. If $du = -f(x)\\,dx$ (e.g. $w = 1-x^2 \\Rightarrow dw = -2x\\,dx$), the minus must carry through to the final antiderivative. Every step's sign MUST be consistent with the previous step — never silently flip a sign between consecutive steps.
- **Self-check antiderivatives**: before stating the final $F(x) + C$, mentally differentiate $F(x)$ and confirm you recover the original integrand. If the derivative does not match, the sign or factor is wrong — fix it instead of presenting an inconsistent chain.

General:
- **Retrieved textbook / RAG passages are reference only** — they can be incomplete or wrong; prefer CBSE/NCERT-correct content even if a passage disagrees.`;

/** Math/chemistry: calculus-style sections; physics: Given/Formula/Steps/Answer layout. */
export function getProfPiStructureContract(ragKey: Subject): string {
  if (ragKey === "physics") return PROF_PI_PHYSICS_STRUCTURE_CONTRACT;
  return PROF_PI_STRUCTURE_CONTRACT;
}

export function getProfPiDefaultTemperatureForRagKey(ragKey: Subject): number {
  switch (ragKey) {
    case "chemistry":
      return 0.5;
    case "math":
      return 0.52;
    case "physics":
      return 0.46;
    default:
      return 0.46;
  }
}

/** Slightly lower temperature for Prof-Pi rephrase path (similar-answer adaptation), by domain. */
export function getProfPiRephraseTemperatureForRagKey(ragKey: Subject): number {
  switch (ragKey) {
    case "chemistry":
      return 0.35;
    case "math":
      return 0.36;
    case "physics":
      return 0.34;
    default:
      return 0.37;
  }
}

/** Second-chance full-RAG call when the first returns empty — keep below default for stability. */
export function getProfPiRetryTemperatureForRagKey(ragKey: Subject): number {
  switch (ragKey) {
    case "chemistry":
      return 0.42;
    case "math":
      return 0.44;
    case "physics":
      return 0.4;
    default:
      return 0.45;
  }
}

/**
 * Desired max completion tokens for the Prof-Pi verifier pass (clamped by `resolveSarvamMaxTokens` at call site).
 * Default scales with draft size — 640 was too low and cut step-by-step answers mid-substitution.
 */
export function getProfPiVerifyMaxTokens(draftChars = 0): number {
  const raw = process.env.PROF_PI_VERIFY_MAX_TOKENS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 128) return n;
  }
  const scaled = Math.min(2048, Math.max(960, Math.ceil(Math.max(draftChars, 400) / 2.2)));
  return scaled;
}

/** Bot student JSON generator — keeps titles/bodies snackable */
export const STUDENT_DOUBT_LENGTH_CONTRACT = `LENGTH (student post — snackable, not an essay):
- "title": 12–120 characters; one clear hook; no URLs.
- "body": 0–${STUDENT_BOT_BODY_MAX_CHARS} characters; where you're stuck in ONE breath; optional; may be "" if the title is self-contained.
- No multi-paragraph essays; no pasted textbook walls.`;

/**
 * Truncate for LLM prompts — prefers breaking at newline or space to avoid ugly mid-token cuts.
 */
export function truncateForPrompt(text: string, maxChars: number): string {
  const t = text ?? "";
  if (t.length <= maxChars) return t;
  const sliceEnd = maxChars - 1;
  const windowStart = Math.max(0, sliceEnd - 120);
  const window = t.slice(windowStart, sliceEnd + 1);
  const lastNl = window.lastIndexOf("\n");
  const lastSp = window.lastIndexOf(" ");
  const relBreak = Math.max(lastNl, lastSp);
  if (relBreak > 20) {
    return t.slice(0, windowStart + relBreak).trimEnd() + "…";
  }
  return t.slice(0, sliceEnd).trimEnd() + "…";
}

/**
 * Optional Sarvam completion cap for Prof-Pi only (dense answers).
 * Env SARVAM_PROF_PI_MAX_TOKENS (default 2048); clamped by resolveSarvamMaxTokens at call site.
 */
/** Default max completion tokens for Prof-Pi (thread answers); feed card preview length is unchanged in UI. */
export const PROF_PI_DESIRED_MAX_TOKENS_DEFAULT = 8192;

export function getProfPiDesiredMaxTokens(): number {
  const raw = process.env.SARVAM_PROF_PI_MAX_TOKENS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 128) return n;
  }
  return PROF_PI_DESIRED_MAX_TOKENS_DEFAULT;
}

/** Subject chat bots — same density brand as Gyan++/Prof-Pi */
export const SUBJECT_CHAT_LENGTH_CONTRACT = `Answer density (reel-style, not a lecture):
- Aim for ≤ ~220 words unless the user explicitly asks for more depth.
- Lead with the direct answer; then at most a few short bullets or one tight follow-up paragraph.
- Prefer $...$ inline; use $$...$$ only when a display block is clearly needed (at most one unless essential).
- Math: ALWAYS use LaTeX inside \`$...$\`. NEVER write raw Unicode math in plain text — FORBIDDEN outside \`$...$\`: ⁻ ⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉ √ ∫ ∑ ∏ ⇌ ↔ → ←. Examples:
  - BAD: \`sin⁻¹x + √(1-x²)\`  →  GOOD: \`$\\sin^{-1} x + \\sqrt{1-x^2}$\`
  - BAD: \`∫f(x) dx\`  →  GOOD: \`$\\int f(x)\\,dx$\`
- No preamble ("Sure!"), no long closing filler.`;

/**
 * Log approximate prompt sizes only (no token usage — that comes from Sarvam after the round-trip).
 * Prefer `GYAN_LOG_SARVAM_USAGE` / `DEBUG_GYAN_PROMPT_SIZES` on `sarvamChatCompletion` for full metrics.
 */
export function logGyanPromptSizes(label: string, systemPrompt: string, userContent: string): void {
  if (process.env.DEBUG_GYAN_PROMPT_SIZES !== "1") return;
  const sysLen = systemPrompt?.length ?? 0;
  const usrLen = userContent?.length ?? 0;
  console.info(
    `[gyanPromptSizes] ${label} systemChars=${sysLen} userChars=${usrLen} total=${sysLen + usrLen}`
  );
}
