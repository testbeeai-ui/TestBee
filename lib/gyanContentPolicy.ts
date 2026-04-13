/**
 * Single source of truth for "reels-style" dense Gyan++/Prof-Pi content and prompt budgets.
 * Server-only string helpers (safe to import from rag / Sarvam paths).
 *
 * Optional env (see also `SARVAM_MAX_OUTPUT_TOKENS` in sarvamGyanClient):
 * - `SARVAM_PROF_PI_MAX_TOKENS` — completion cap for Prof-Pi only (default 1460, ~+500 vs legacy 960 for longer thread answers; clamped by `resolveSarvamMaxTokens`).
 * - `RAG_FORMATTED_CONTEXT_MAX_CHARS` — override RAG passage char cap after retrieve (default from `RAG_CONTEXT_MAX_CHARS`).
 * - `DEBUG_GYAN_PROMPT_SIZES=1` — enables `[sarvamMetrics]` logs (chars + Sarvam `usage` tokens) from `sarvamGyanClient` after each call.
 * - `GYAN_LOG_SARVAM_USAGE=1` — same metrics line without tying to generic “prompt sizes” naming.
 * - `PROF_PI_VERIFY=1` — optional second Sarvam pass to sanity-check / repair drafts (rephrase always when enabled; full-RAG when draft looks chemistry-heavy, physics/math-heavy LaTeX, or technical biology); see `lib/profPiVerify.ts`.
 * - `PROF_PI_VERIFY_MAX_TOKENS` — completion cap for verifier (default 640).
 */

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

export const PROF_PI_MAX_WORDS = 220;
export const PROF_PI_MAX_BULLETS = 5;

/** Injected into Prof-Pi system prompts (rephrase + full RAG) */
export const PROF_PI_LENGTH_CONTRACT = `LENGTH & SHAPE (non-negotiable — "short and high-signal", like a good reel, not a 10-minute lecture):
- Target ≤ ${PROF_PI_MAX_WORDS} words total. One mobile screen of reading.
- Prefer 3–${PROF_PI_MAX_BULLETS} very short bullets OR two tight paragraphs — not both long.
- Order: (1) Direct answer to THIS doubt first. (2) One line of intuition IF needed. (3) At most ONE exam trap, shortcut, or mnemonic.
- No preamble ("Sure!", "Great question"), no closing filler ("In conclusion", "Hope this helps").
- Math: use $...$ inline where possible; at most ONE $$...$$ block unless a second is strictly required for clarity.
- Chemistry: prefer inline or a single $$...$$ for the main reaction.
- If you risk running long, CUT examples before cutting the core answer.`;

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

Mathematics:
- When using identities or substitutions, state **domain restrictions** where they matter (e.g. log, tan, square roots).
- For calculus: note **differentiability / continuity** when invoking theorems (Rolle’s, MVT, IVT).
- Do not skip algebraic steps that would change an equality; recheck **limits** at boundaries.

Biology:
- Use **precise process and structure names** (mitosis vs meiosis, transcription vs translation, organelles); do not swap similar terms.
- For genetics: keep **Punnett / cross** logic consistent with stated dominance and parental genotypes.
- Avoid overstating **causation** from correlation; stick to NCERT-level mechanism descriptions.

General:
- **Retrieved textbook / RAG passages are reference only** — they can be incomplete or wrong; prefer CBSE/NCERT-correct content even if a passage disagrees.`;

/** Default sampling temperature for Prof-Pi full-RAG answer by tutoring domain (lower = more deterministic). */
export function getProfPiDefaultTemperatureForRagKey(
  ragKey: "physics" | "chemistry" | "math" | "biology"
): number {
  switch (ragKey) {
    case "chemistry":
      return 0.5;
    case "math":
      return 0.52;
    case "biology":
      return 0.52;
    case "physics":
      return 0.54;
    default:
      return 0.54;
  }
}

/** Slightly lower temperature for Prof-Pi rephrase path (similar-answer adaptation), by domain. */
export function getProfPiRephraseTemperatureForRagKey(
  ragKey: "physics" | "chemistry" | "math" | "biology"
): number {
  switch (ragKey) {
    case "chemistry":
      return 0.35;
    case "math":
      return 0.36;
    case "biology":
      return 0.37;
    case "physics":
      return 0.37;
    default:
      return 0.37;
  }
}

/** Second-chance full-RAG call when the first returns empty — keep below default for stability. */
export function getProfPiRetryTemperatureForRagKey(
  ragKey: "physics" | "chemistry" | "math" | "biology"
): number {
  switch (ragKey) {
    case "chemistry":
      return 0.42;
    case "math":
      return 0.44;
    case "biology":
      return 0.44;
    case "physics":
      return 0.45;
    default:
      return 0.45;
  }
}

/** Max completion tokens for optional verify/repair pass (starter-safe default). */
export function getProfPiVerifyMaxTokens(): number {
  const raw = process.env.PROF_PI_VERIFY_MAX_TOKENS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 128 && n <= 2048) return n;
  }
  return 640;
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
 * Env SARVAM_PROF_PI_MAX_TOKENS (default 1460); clamped by resolveSarvamMaxTokens at call site.
 */
/** Default max completion tokens for Prof-Pi (thread answers); feed card preview length is unchanged in UI. */
export const PROF_PI_DESIRED_MAX_TOKENS_DEFAULT = 1460;

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
- No preamble ("Sure!"), no long closing filler.`;

/**
 * Log approximate prompt sizes only (no token usage — that comes from Sarvam after the round-trip).
 * Prefer `GYAN_LOG_SARVAM_USAGE` / `DEBUG_GYAN_PROMPT_SIZES` on `sarvamChatCompletion` for full metrics.
 */
export function logGyanPromptSizes(label: string, systemPrompt: string, userContent: string): void {
  if (process.env.DEBUG_GYAN_PROMPT_SIZES !== "1") return;
  const sysLen = systemPrompt?.length ?? 0;
  const usrLen = userContent?.length ?? 0;
  console.info(`[gyanPromptSizes] ${label} systemChars=${sysLen} userChars=${usrLen} total=${sysLen + usrLen}`);
}
