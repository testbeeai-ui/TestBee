/**
 * Import one PYQ paper JSON (exam object + questions[]) into past_papers + past_paper_questions.
 *
 * Used for BITSAT / JEE Main / KCET PYQ uploads where the source is the
 * `{ examName, examTypeName, examSetName, questions[] }` shape from the question bank.
 *
 *   JSON_PATH="C:/path/to/paper.json" \
 *   npx tsx --env-file-if-exists=.env scripts/import-past-paper-json.ts
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: PAST_PAPER_SLUG, EXAM_NAME_OVERRIDE
 *
 * Idempotent: deletes any existing past_papers row matching the slug (and
 * cascades past_paper_questions) before re-inserting.
 */

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseNumericAnswerHint } from "../lib/parseNumericAnswerHint";
import { relocateOptionImagesToStem } from "../lib/pastPaper/relocateOptionImagesToStem";
import { selfHostImages } from "./pastPaperImageHost";

type JsonQuestion = Record<string, unknown>;

type ExamJson = {
  examId?: string | number;
  examName?: string;
  examTypeName?: string;
  examSetId?: string | number;
  examSetName?: string;
  totalQuestions?: number;
  questions?: JsonQuestion[];
};

type Subject = "physics" | "chemistry" | "math" | "biology";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/** Quote a PostgREST filter value so commas/parens in titles do not break `.or()`. */
function postgrestEqValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function str(q: JsonQuestion, key: string): string {
  const v = q[key];
  return v == null ? "" : String(v).trim();
}

function normalizeSubject(raw: string): Subject | null {
  const s = raw.trim().toLowerCase();
  if (s === "physics") return "physics";
  if (s === "chemistry") return "chemistry";
  if (s === "mathematics" || s === "math") return "math";
  if (s === "biology") return "biology";
  return null;
}

function normalizeSubjectFromIds(
  rawSubjectId: string,
  rawMainSubjectId: string,
  rawSubjectCode: string
): Subject | null {
  const sid = rawSubjectId.trim();
  if (sid === "21") return "physics";
  if (sid === "22") return "chemistry";
  if (sid === "23") return "math";
  if (sid === "24") return "biology";

  const code = rawSubjectCode.trim().toUpperCase();
  if (code === "PHYS" || code === "PHY") return "physics";
  if (code === "CHEM") return "chemistry";
  if (code === "MATH") return "math";
  if (code === "BIOL" || code === "BIO") return "biology";

  const mid = rawMainSubjectId.trim();
  if (mid === "1") return "chemistry";
  if (mid === "2") return "math";
  if (mid === "3") return "physics";

  return null;
}

function resolveSubject(q: JsonQuestion, lastSubject: Subject | null): Subject | null {
  const name = str(q, "subjectName").trim().toLowerCase();
  // If the source explicitly tags this question with an unknown subject,
  // don't inherit the previous question's subject. Only fall back to
  // lastSubject when subjectName is empty / missing.
  if (
    name &&
    name !== "physics" &&
    name !== "chemistry" &&
    name !== "mathematics" &&
    name !== "math" &&
    name !== "biology"
  ) {
    return null;
  }
  const fromName = normalizeSubject(str(q, "subjectName"));
  if (fromName) return fromName;
  const fromIds = normalizeSubjectFromIds(
    str(q, "subjectId"),
    str(q, "mainSubjectId"),
    str(q, "subjectCode")
  );
  if (fromIds) return fromIds;
  return lastSubject;
}

/** `(A)` / `( D)` / `(\text B)` / `(\text{C})` — KaTeX-wrapped labels count as real options. */
const OPTION_LETTER_MARKER_RE =
  /\(\s*(?:\\(?:text|mathrm|textrm|textbf)\s*\{?\s*)?([A-Da-d])\s*\}?\s*\.?\s*\)/g;

function hasCompleteDigitOptionSet(html: string): boolean {
  const first = new Map<1 | 2 | 3 | 4, number>();
  const re = /\(\s*([1-4])\s*\.?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (shouldSkipParenDigitMarker(html, m.index)) continue;
    const n = Number(m[1]) as 1 | 2 | 3 | 4;
    if (!first.has(n)) first.set(n, m.index);
  }
  return ([1, 2, 3, 4] as const).every((k) => first.has(k));
}

function isKatexTextOptionLabel(markerText: string): boolean {
  return /\\(?:text|mathrm|textrm|textbf)/i.test(markerText);
}

/** (A)(B)(C)(D) lettered markers. */
function extractStemAndOptionsAbcd(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  // Build a list of (blockStart, blockEnd) for every <p>...</p> block so we
  // can identify markers that are real option labels (i.e. start of a block)
  // vs. noise like "(c)" embedded in prose.
  type Block = { start: number; end: number };
  const blocks: Block[] = [];
  const pRe = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(html)) !== null) {
    blocks.push({ start: pm.index, end: pm.index + pm[0].length });
  }
  const startsNewBlock = (idx: number): boolean => {
    for (const b of blocks) {
      if (idx >= b.start && idx < b.end) {
        // The marker is at (or near) the start of the block if everything
        // between the <p> tag and the marker is opening inline tags
        // (<strong>, <b>, <em>, <span>, <i>, <u>) and whitespace.
        const inner = html.slice(b.start, idx);
        return /^<p\b[^>]*>(\s*<\/?(?:strong|b|em|span|i|u)\s*>)*\s*$/i.test(inner);
      }
    }
    return false;
  };

  // Side-by-side second column: "(A) …      (B) …" within one <p>.
  // Require the whitespace/nbsp run to be IMMEDIATELY before the marker.
  const isSideBySideChoice = (idx: number): boolean => {
    const before = html.slice(Math.max(0, idx - 100), idx);
    return /(?:(?:&nbsp;\s*){3,}|(?:&nbsp;|\s){8,})$/.test(before);
  };

  // Find EVERY (A)/(B)/(C)/(D) marker in document order.
  // Skip markers inside `\(...\)` unless they are KaTeX text labels like `(\text B)`.
  const markerRe = new RegExp(OPTION_LETTER_MARKER_RE.source, "g");
  const all: Array<{
    letter: "A" | "B" | "C" | "D";
    index: number;
    end: number;
  }> = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(html)) !== null) {
    if (isInsideLatexMath(html, m.index) && !isKatexTextOptionLabel(m[0]!)) continue;
    all.push({
      letter: m[1]!.toUpperCase() as "A" | "B" | "C" | "D",
      index: m.index,
      end: m.index + m[0].length,
    });
  }
  if (all.length < 4) return null;

  const required: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  const pickAbcd = (
    set: typeof all,
    after = -1
  ): typeof all | null => {
    const picked: typeof all = [];
    let minStart = after;
    for (const want of required) {
      const hit = set.find((h) => h.letter === want && h.index > minStart);
      if (!hit) return null;
      picked.push(hit);
      minStart = hit.index;
    }
    return picked;
  };

  // Prefer real choice positions (paragraph start / side-by-side column) over
  // nested statement refs like "(A) (B) and (C)".
  const choiceHits = all.filter(
    (h) => startsNewBlock(h.index) || isSideBySideChoice(h.index)
  );
  const blockStarters = all.filter((h) => startsNewBlock(h.index));

  // When statements (A)–(D) are listed before the real choices (A)–(D),
  // take the last complete A→B→C→D run.
  const pickLastRun = (set: typeof all): typeof all | null => {
    let last: typeof all | null = null;
    let after = -1;
    for (;;) {
      const run = pickAbcd(set, after);
      if (!run) break;
      last = run;
      after = run[3]!.index;
    }
    return last;
  };

  const candidateSets: Array<typeof all> = [];
  if (choiceHits.length >= 4) candidateSets.push(choiceHits);
  if (blockStarters.length >= 4) candidateSets.push(blockStarters);
  candidateSets.push(all);

  for (const set of candidateSets) {
    const picked = pickLastRun(set) ?? pickAbcd(set);
    if (!picked) continue;

    const [aHit, bHit, cHit, dHit] = picked;
    const usesTextLabel = picked.some((h) =>
      isKatexTextOptionLabel(html.slice(h.index, h.end))
    );

    // When B/C live as `(\text B)` inside a KaTeX paragraph, keep each
    // choice as its full <p> block so structure diagrams stay balanced.
    if (usesTextLabel) {
      const paraFor = (idx: number) =>
        blocks.find((bl) => idx >= bl.start && idx < bl.end) ?? null;
      const paras = picked.map((h) => paraFor(h.index));
      const uniqueStarts = new Set(paras.map((p) => p?.start ?? -1));
      if (paras.every(Boolean) && uniqueStarts.size === 4) {
        const stemHtml = html.slice(0, paras[0]!.start).trim();
        const options = paras.map((p) => {
          const full = html.slice(p!.start, p!.end);
          const inner = full
            .replace(/^<p\b[^>]*>/i, "")
            .replace(/<\/p>\s*$/i, "");
          return inner
            .replace(
              /\(\s*(?:\\(?:text|mathrm|textrm|textbf)\s*\{?\s*)?[A-Da-d]\s*\}?\s*\.?\s*\)/g,
              ""
            )
            .replace(/&nbsp;/gi, " ")
            .replace(/\s+/g, " ")
            .trim();
        });
        if (options.every((o) => o.length > 0)) {
          return { stemHtml, options };
        }
      }
    }

    const aBody = html.slice(aHit!.end, bHit!.index).trim();
    const bBody = html.slice(bHit!.end, cHit!.index).trim();
    const cBody = html.slice(cHit!.end, dHit!.index).trim();
    const dBody = html.slice(dHit!.end).trim();
    const stemHtml = html.slice(0, aHit!.index).trim();

    // Reject column-header / nested-label false positives.
    const stripped = [aBody, bBody, cBody].map((b) =>
      b
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
    const tinyOrConj = stripped.filter(
      (t) =>
        t.length <= 4 ||
        /^(and|or|only|,|<|>|&lt;|&gt;|&ndash;|&mdash;|&nbsp;)+$/i.test(t)
    ).length;
    if (tinyOrConj >= 2) {
      continue;
    }

    // (a)–(d) statement lists with real choices as (1)–(4): defer to digit parsers.
    if (
      hasCompleteDigitOptionSet(html) &&
      picked.every((h) => /[a-d]/.test(html.slice(h.index, h.end)))
    ) {
      continue;
    }

    return { stemHtml, options: [aBody, bBody, cBody, dBody] };
  }
  return null;
}

/** (A)(B)(C)(D) or mixed A)(B)(C)(D) — KCET 2024 often omits open paren on option A. */
function extractStemAndOptionsAbcdFlexible(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  type Letter = "A" | "B" | "C" | "D";
  type Hit = { letter: Letter; start: number; end: number; lower: boolean };

  // Collect every (A)/(B)/(C)/(D) marker in order — NOT just the first
  // occurrence. The stem may contain a stray "(c)" that would otherwise
  // steal the C slot. Then find the first contiguous A→B→C→D run.
  const all: Hit[] = [];
  const patterns: RegExp[] = [
    new RegExp(OPTION_LETTER_MARKER_RE.source, "g"),
    /(?<![A-Za-z0-9(])([A-Da-d])\s*\)/g,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const raw = m[1]!;
      const textLabel = isKatexTextOptionLabel(m[0]!);
      if (isInsideLatexMath(html, m.index) && !textLabel) continue;
      all.push({
        letter: raw.toUpperCase() as Letter,
        start: m.index,
        end: m.index + m[0].length,
        lower: /[a-d]/.test(raw),
      });
    }
  }
  if (all.length < 4) return null;
  all.sort((a, b) => a.start - b.start || b.end - a.end);

  // Dedupe overlapping hits at the same start (paren form wins over bare).
  const deduped: Hit[] = [];
  for (const h of all) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.start === h.start) continue;
    deduped.push(h);
  }

  type Block = { start: number; end: number };
  const blocks: Block[] = [];
  const pRe = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(html)) !== null) {
    blocks.push({ start: pm.index, end: pm.index + pm[0].length });
  }
  const startsNewBlock = (idx: number): boolean => {
    for (const b of blocks) {
      if (idx >= b.start && idx < b.end) {
        const inner = html.slice(b.start, idx);
        return /^<p\b[^>]*>(\s*<\/?(?:strong|b|em|span|i|u)\s*>)*\s*$/i.test(
          inner
        );
      }
    }
    return false;
  };

  const required: Letter[] = ["A", "B", "C", "D"];
  /** First A after `after`, then first B after it, etc. */
  const pickAbcd = (set: Hit[], after = -1): Hit[] | null => {
    const picked: Hit[] = [];
    let minStart = after;
    for (const want of required) {
      const hit = set.find((h) => h.letter === want && h.start > minStart);
      if (!hit) return null;
      picked.push(hit);
      minStart = hit.start;
    }
    return picked;
  };

  /** Last complete A→B→C→D run (statement list first, real choices second). */
  const pickLastRun = (set: Hit[]): Hit[] | null => {
    let last: Hit[] | null = null;
    let after = -1;
    for (;;) {
      const run = pickAbcd(set, after);
      if (!run) break;
      last = run;
      after = run[3]!.start;
    }
    return last;
  };

  const blockStarters = deduped.filter((h) => startsNewBlock(h.start));
  const lowerSet = deduped.filter((h) => h.lower);
  // Prefer lowercase ONLY when those markers start a paragraph (real `a.` /
  // `(a)` choices). Nested "(b) < (a) < (c)" inside an (A)–(D) option must NOT
  // win over the real uppercase choice labels.
  const lowerBlockStarters = lowerSet.filter((h) => startsNewBlock(h.start));
  const upperBlockStarters = blockStarters.filter((h) => !h.lower);
  const picked =
    pickLastRun(lowerBlockStarters) ??
    pickAbcd(lowerBlockStarters) ??
    pickLastRun(upperBlockStarters) ??
    pickAbcd(upperBlockStarters) ??
    pickLastRun(blockStarters) ??
    pickAbcd(blockStarters) ??
    pickLastRun(deduped) ??
    pickAbcd(deduped);
  if (!picked) return null;

  const [h1, h2, h3, h4] = picked;

  // Defer KaTeX `(\text B)` layouts to extractStemAndOptionsAbcd, which keeps
  // each choice as a full <p> so structure diagrams stay delimiter-balanced.
  if (
    picked.some((h) => isKatexTextOptionLabel(html.slice(h.start, h.end)))
  ) {
    return null;
  }

  // Reject tiny option bodies that indicate we sliced nested statement labels
  // like "(A), (B), (C)" inside a real choice.
  const bodies = [
    html.slice(h1!.end, h2!.start).trim(),
    html.slice(h2!.end, h3!.start).trim(),
    html.slice(h3!.end, h4!.start).trim(),
    html.slice(h4!.end).trim(),
  ];
  const stripped = bodies.map((b) =>
    b
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
  // Nested capital labels inside assertion options yield "," / "and" crumbs.
  // Also reject HTML-entity / comparison crumbs from "(b) &lt; (a)" mis-splits.
  if (
    stripped.slice(0, 3).filter(
      (t) =>
        t.length <= 4 ||
        /^(and|or|only|,|<|>|&lt;|&gt;|&ndash;|&mdash;|&nbsp;)+$/i.test(t)
    ).length >= 2
  ) {
    return null;
  }

  // (a)–(d) statement lists with real choices as (1)–(4): defer to digit parsers.
  if (hasCompleteDigitOptionSet(html) && picked.every((h) => h.lower)) {
    return null;
  }

  const stemHtml = html.slice(0, h1!.start).trim();
  return {
    stemHtml,
    options: bodies,
  };
}

function endOfParenMarkerFrom(html: string, idx: number): number {
  const slice = html.slice(idx);
  const parenHit = slice.match(/^\(\s*(?:[1-4]|[a-dA-D])\s*\.?\s*\)/);
  if (parenHit) return idx + parenHit[0].length;
  const bare4Hit = slice.match(/^(?<!\()\b4\s*\)/);
  if (bare4Hit) return idx + bare4Hit[0].length;
  return idx;
}

function isParenDigitAfterDerivative(html: string, parenIdx: number): boolean {
  if (parenIdx <= 0) return false;
  const prev = html[parenIdx - 1]!;
  return prev === "'" || prev === "\u2032" || prev === "\u2019";
}

/** True when `(1)` is the label inside LaTeX like `\((1) \ (0,0)\)` — not a real HTML option marker. */
function isParenDigitInsideLatexOpen(html: string, parenIdx: number): boolean {
  let i = parenIdx - 1;
  while (i >= 0 && /\s/.test(html[i]!)) i--;
  if (i >= 1 && html[i] === "(" && html[i - 1] === "\\") return true;
  return false;
}

/**
 * True when idx sits inside `\(...\)` or `\[...\]` (KaTeX delimiters).
 * Prevents false option markers from math like `+1)`, `Br_2)`, `2(\sqrt{2}+1)`.
 */
function isInsideLatexMath(html: string, idx: number): boolean {
  let i = 0;
  let inline = false;
  let display = false;
  while (i < idx && i < html.length) {
    if (html[i] === "\\" && i + 1 < html.length) {
      const n = html[i + 1]!;
      if (n === "(") {
        inline = true;
        i += 2;
        continue;
      }
      if (n === ")") {
        inline = false;
        i += 2;
        continue;
      }
      if (n === "[") {
        display = true;
        i += 2;
        continue;
      }
      if (n === "]") {
        display = false;
        i += 2;
        continue;
      }
    }
    i++;
  }
  return inline || display;
}

/** Bare `1)` / `2)` after operators is almost always math, not an option label. */
function isBareDigitParenLikelyMath(html: string, parenIdx: number): boolean {
  // Only applies to bare `N)` (no opening '(' immediately before the digit run).
  const slice = html.slice(parenIdx);
  if (/^\(\s*[1-4]/.test(slice)) return false;
  if (!/^[1-4]\s*\)/.test(slice)) return false;
  let i = parenIdx - 1;
  while (i >= 0 && /\s/.test(html[i]!)) i--;
  if (i < 0) return false;
  const prev = html[i]!;
  // `9(e &ndash; 1)` / `&minus; 2)` — entity-terminated dash/minus, not option `1)`.
  if (prev === ";") {
    const before = html.slice(Math.max(0, i - 16), i + 1);
    if (/&(?:[a-z]+|#\d+|#x[\da-f]+);$/i.test(before)) return true;
  }
  return /[+\-−–=×÷/^_,{]/.test(prev) || /[A-Za-z0-9]/.test(prev);
}

/** `f(1)`, `P(2)`, `g(3)` — function/probability call, not option label `(1)`. */
function isParenDigitFunctionCall(html: string, parenIdx: number): boolean {
  if (parenIdx <= 0) return false;
  if (html[parenIdx] !== "(") return false;
  return /[A-Za-z]/.test(html[parenIdx - 1]!);
}

function shouldSkipParenDigitMarker(html: string, parenIdx: number): boolean {
  return (
    isParenDigitAfterDerivative(html, parenIdx) ||
    isParenDigitInsideLatexOpen(html, parenIdx) ||
    isInsideLatexMath(html, parenIdx) ||
    isBareDigitParenLikelyMath(html, parenIdx) ||
    isParenDigitFunctionCall(html, parenIdx)
  );
}

function trimIncompleteTrailingOpenTags(html: string): string {
  return html
    .replace(/(?:<(?:span|strong|p|em|b|i)(?:\s[^>]*)?>\s*)+$/i, "")
    .replace(/<(?:span|strong|p|em|b|i)(?:\s[^>]*)?$/i, "")
    .trim();
}

/**
 * Options embedded inside KaTeX as `\((1) …\)` `\((2) …\)` (common in older JEE PDFs).
 * Must run before plain `(1)(2)(3)(4)` splitters or they cut mid-math.
 */
function extractStemAndOptionsLatexEmbeddedNumbers(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  const re = /\\\(\s*\(\s*([1-4])\s*\)\s*([\s\S]*?)\\\)/g;
  type Hit = { n: 1 | 2 | 3 | 4; start: number; end: number; body: string };
  const first = new Map<1 | 2 | 3 | 4, Hit>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = Number(m[1]) as 1 | 2 | 3 | 4;
    if (first.has(n)) continue;
    first.set(n, {
      n,
      start: m.index,
      end: m.index + m[0].length,
      body: (m[2] ?? "").trim(),
    });
  }
  if (!([1, 2, 3, 4] as const).every((k) => first.has(k))) return null;

  const ordered = ([1, 2, 3, 4] as const).map((k) => first.get(k)!);
  for (let i = 1; i < 4; i++) {
    if (!(ordered[i - 1]!.start < ordered[i]!.start)) return null;
  }

  const stemHtml = trimIncompleteTrailingOpenTags(html.slice(0, ordered[0]!.start));
  // Also drop a dangling empty math-tex opener left before embedded options.
  const stemClean = trimIncompleteTrailingOpenTags(
    stemHtml.replace(/(?:<span[^>]*class=["']math-tex["'][^>]*>\s*)+$/i, "")
  );
  const options = ordered.map((h) => {
    let inner = h.body
      .replace(/^\\?\s*/, "")
      .replace(/\\cdot/g, ".")
      .trim();
    // Drop a leading bare label remnant if present.
    inner = inner.replace(/^\(\s*[1-4]\s*\)\s*/, "").trim();
    if (!inner) inner = "?";
    if (!inner.includes("\\(")) {
      inner = `\\(${inner}\\)`;
    }
    return `<span class="math-tex">${inner}</span>`;
  });
  if (options.some((o) => !o)) return null;
  return { stemHtml: stemClean, options };
}

/** (1)(2)(3)(4) digit markers — used for integer-choice BITSAT questions. */
function extractStemAndOptions124(rawHtml: string): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  const digitRe = /\(\s*([1-4])\s*\.?\s*\)/g;
  const firstDigit = new Map<1 | 2 | 3 | 4, number>();
  let m: RegExpExecArray | null;
  while ((m = digitRe.exec(html)) !== null) {
    if (shouldSkipParenDigitMarker(html, m.index)) continue;
    const n = Number(m[1]!) as 1 | 2 | 3 | 4;
    if (!firstDigit.has(n)) firstDigit.set(n, m.index);
  }

  if (!([1, 2, 3] as const).every((k) => firstDigit.has(k))) return null;

  const s1 = firstDigit.get(1)!;
  const s2 = firstDigit.get(2)!;
  const s3 = firstDigit.get(3)!;
  if (!(s1 < s2 && s2 < s3)) return null;

  let s4: number;
  if (firstDigit.has(4)) {
    s4 = firstDigit.get(4)!;
    if (!(s3 < s4)) return null;
  } else {
    const after3 = endOfParenMarkerFrom(html, s3);
    const rest = html.slice(after3);
    const bare4 = /(?<!\()\b4\s*\)/.exec(rest);
    if (bare4) {
      s4 = after3 + bare4.index;
    } else {
      const imgPara = /<p\b[^>]*>[\s\S]*?<img\b[\s\S]*?<\/p>/i.exec(rest);
      if (imgPara) {
        s4 = after3 + imgPara.index;
      } else {
        const am = /\(\s*a\s*\)/i.exec(rest);
        if (!am) return null;
        s4 = after3 + am.index;
      }
    }
    if (!(s3 < s4)) return null;
  }

  const o1 = html.slice(endOfParenMarkerFrom(html, s1), s2).trim();
  const o2 = html.slice(endOfParenMarkerFrom(html, s2), s3).trim();
  const o3 = html.slice(endOfParenMarkerFrom(html, s3), s4).trim();
  const o4 = html.slice(endOfParenMarkerFrom(html, s4)).trim();
  const stemHtml = html.slice(0, s1).trim();

  return { stemHtml, options: [o1, o2, o3, o4] };
}

/**
 * First four sequential digit markers — handles duplicate `(3)` instead of `(4)`,
 * bare `1)`/`2)`/`3)`/`4)`, and mixed `(1)` + `(2)(3)(4)`.
 */
function extractStemAndOptionsFourSequential(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  type Hit = { start: number; end: number };
  const hits: Hit[] = [];
  const markerRe = /\(\s*([1-4])\s*\.?\s*\)|(?<!\()\b([1-4])\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(html)) !== null) {
    if (shouldSkipParenDigitMarker(html, m.index)) continue;
    hits.push({ start: m.index, end: m.index + m[0].length });
    if (hits.length >= 4) break;
  }
  if (hits.length < 4) return null;

  const [h1, h2, h3, h4] = hits;
  if (!(h1!.start < h2!.start && h2!.start < h3!.start && h3!.start < h4!.start)) return null;

  const stemHtml = html.slice(0, h1!.start).trim();
  return {
    stemHtml,
    options: [
      html.slice(h1!.end, h2!.start).trim(),
      html.slice(h2!.end, h3!.start).trim(),
      html.slice(h3!.end, h4!.start).trim(),
      html.slice(h4!.end).trim(),
    ],
  };
}

/**
 * BITSAT 2021+ format: options are bare "a." "b." "c." "d." markers (no parens)
 * and live in the last 1–2 <p> blocks of the question HTML. The stem is
 * everything before the first option-marker paragraph.
 *
 * To avoid false positives like "An ideal gas..." we require the marker letter
 * to be the FIRST non-whitespace text in its <p> block, and we require all four
 * markers to appear in document order.
 */
function extractStemAndOptionsAbcdDot(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  // Build a list of (blockStart, blockEnd, innerStart, text) for every <p>...</p>
  // block, plus any trailing tail.
  type Block = { absStart: number; innerStart: number; text: string };
  const blocks: Block[] = [];
  const findRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let fm: RegExpExecArray | null;
  let lastEnd = 0;
  while ((fm = findRe.exec(html)) !== null) {
    const absStart = fm.index;
    const innerStart = fm.index + fm[0].indexOf(">") + 1;
    blocks.push({ absStart, innerStart, text: fm[1] });
    lastEnd = absStart + fm[0].length;
  }
  if (lastEnd < html.length) {
    blocks.push({ absStart: lastEnd, innerStart: lastEnd, text: html.slice(lastEnd) });
  }
  if (blocks.length === 0) return null;

  // Identify the first block whose stripped text begins with a single letter
  // matching [a-d] (case-insensitive) followed by "." (mandatory). That block
  // starts the options region.
  let optionsStartBlock = -1;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const inner = b.text.replace(/^\s+/, "").replace(/^&nbsp;/i, "");
    if (!inner) continue;
    const first = inner.charAt(0);
    if (!/[a-dA-D]/.test(first)) continue;
    if (inner.charAt(1) !== ".") continue;
    optionsStartBlock = i;
    break;
  }
  if (optionsStartBlock < 0) return null;

  // Walk through every block in the options region. Within each block, find
  // every "letter + dot? + whitespace" marker, and accumulate them in order.
  // This handles both shapes:
  //   <p>a. ... b. ... </p>  (multiple markers in one block — BITSAT 2021)
  //   <p>a. ...</p><p>b. ...</p>  (one marker per block — BITSAT 2022+)
  type Hit = { letter: "A" | "B" | "C" | "D"; absStart: number; absEnd: number };
  const hits: Hit[] = [];
  // Marker regex used INSIDE a block: must be a letter [a-d] (case-insensitive)
  // immediately followed by ".". We use a non-letter lookbehind so "ideal" /
  // "atom" / "An" don't match. The dot is mandatory — it discriminates
  // option markers from prose words.
  const inBlockRe = /(?<![A-Za-z0-9])([a-dA-D])\./g;

  for (let i = optionsStartBlock; i < blocks.length; i++) {
    const b = blocks[i]!;
    inBlockRe.lastIndex = 0;
    let mm: RegExpExecArray | null;
    while ((mm = inBlockRe.exec(b.text)) !== null) {
      const letter = mm[1]!.toUpperCase() as "A" | "B" | "C" | "D";
      if (hits.some((h) => h.letter === letter)) continue;
      // Reject markers that are clearly mid-word by checking the char before.
      const startInBlock = mm.index;
      const prev = startInBlock > 0 ? b.text.charAt(startInBlock - 1) : "";
      if (/[A-Za-z0-9]/.test(prev)) continue;
      const absStart = b.innerStart + mm.index;
      const absEnd = absStart + mm[0].length;
      hits.push({ letter, absStart, absEnd });
      if (hits.length >= 4) break;
    }
    if (hits.length >= 4) break;
  }

  if (hits.length < 4) return null;
  // Must be in A,B,C,D order by absolute position.
  hits.sort((x, y) => x.absStart - y.absStart);
  const required: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  for (let i = 0; i < 4; i++) {
    if (hits[i]!.letter !== required[i]) return null;
  }

  const stemHtml = html.slice(0, hits[0]!.absStart).trim();
  const aBody = html.slice(hits[0]!.absEnd, hits[1]!.absStart).trim();
  const bBody = html.slice(hits[1]!.absEnd, hits[2]!.absStart).trim();
  const cBody = html.slice(hits[2]!.absEnd, hits[3]!.absStart).trim();
  const dBody = html.slice(hits[3]!.absEnd).trim();

  return {
    stemHtml,
    options: [
      cleanOptionBody(aBody),
      cleanOptionBody(bBody),
      cleanOptionBody(cBody),
      cleanOptionBody(dBody),
    ],
  };
}

/** Strip paragraph boundaries and stray &nbsp; noise from a sliced option body. */
function cleanOptionBody(raw: string): string {
  return raw
    .replace(/<\/p>\s*<p[^>]*>/gi, " ")
    .replace(/<\/?p\b[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * (a)(b)(c)(d) with (b) omitted but an <img> between (a) and (c) carries option B.
 */
function extractStemOptionsAcDMissingBWithImg(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (/\(\s*b\s*\)/i.test(html)) return null;

  const reA = /\(\s*a\s*\)/i;
  const reC = /\(\s*c\s*\)/i;
  const reD = /\(\s*d\s*\)/i;
  const ma = reA.exec(html);
  const mc = reC.exec(html);
  const md = reD.exec(html);
  if (!ma || !mc || !md) return null;

  const aIdx = ma.index;
  const cIdx = mc.index;
  const dIdx = md.index;
  if (!(aIdx < cIdx && cIdx < dIdx)) return null;

  const afterA = endOfParenMarkerFrom(html, aIdx);
  const mid = html.slice(afterA, cIdx);
  const imgMatch = /<img\b[^>]*\/?>/i.exec(mid);
  if (!imgMatch) return null;

  const optA = mid.slice(0, imgMatch.index).trim();
  const optB = imgMatch[0];
  const afterC = endOfParenMarkerFrom(html, cIdx);
  const optC = html.slice(afterC, dIdx).trim();
  const afterD = endOfParenMarkerFrom(html, dIdx);
  const optD = html.slice(afterD).trim();
  const stemHtml = html.slice(0, aIdx).trim();

  return { stemHtml, options: [optA, optB, optC, optD] };
}

/**
 * First four `(1)–(4)` or `(a)–(d)` markers in order — tolerates duplicate labels
 * and mixed `(4)` / `(d)`. Skips derivative `(n)` after `f'`.
 */
function extractStemOptionsFirstFourMarkers(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  const re = /\(\s*([1-4]|[a-dA-D])\s*\.?\s*\)/g;
  type Hit = { tok: string; start: number; end: number };
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tok = m[1]!;
    if (/^[1-4]$/.test(tok) && shouldSkipParenDigitMarker(html, m.index)) continue;
    if (/^[a-dA-D]$/.test(tok) && isInsideLatexMath(html, m.index)) continue;
    hits.push({ tok, start: m.index, end: m.index + m[0].length });
  }
  if (hits.length < 4) return null;

  // Prefer a real 1→2→3→4 or A→B→C→D sequence (skip nested (d)/(b) crumbs).
  const pickSeq = (order: string[]): Hit[] | null => {
    const picked: Hit[] = [];
    let minStart = -1;
    for (const want of order) {
      const hit = hits.find(
        (h) => h.tok.toUpperCase() === want && h.start > minStart
      );
      if (!hit) return null;
      picked.push(hit);
      minStart = hit.start;
    }
    return picked;
  };
  const four =
    pickSeq(["1", "2", "3", "4"]) ??
    pickSeq(["A", "B", "C", "D"]) ??
    null;
  if (!four) return null;

  const stemHtml = html.slice(0, four[0]!.start).trim();
  const options: string[] = [];
  for (let i = 0; i < 4; i++) {
    const bodyStart = four[i]!.end;
    const bodyEnd = i < 3 ? four[i + 1]!.start : html.length;
    options.push(html.slice(bodyStart, bodyEnd).trim());
  }
  if (options.some((o) => !o.trim())) return null;
  return { stemHtml, options };
}

/**
 * Tolerant COMEDK option parse: first four option markers in document order
 * become A–D regardless of OCR letter order/typos (`b,`, `el.`, `a&nbsp;`, a/c/b/d).
 */
function extractStemAndOptionsLooseDotMarkers(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  // Also accept OCR digit-as-letter: "6." → b, "0." → a/o, "1." → l/i.
  const re = /(?:^|>|\n|\r)\s*(?:&nbsp;\s*)*(?:([a-dA-D]|[601])(?:[.,)]|\s|&nbsp;)|([eE][lL])\.)/g;
  const hits: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const full = m[0]!;
    const markerOffset = full.search(/[a-dA-DeE601]/);
    const start = m.index + (markerOffset >= 0 ? markerOffset : 0);
    // Skip compound labels inside KaTeX (`A \xrightarrow`, `B \frac`, …).
    if (isInsideLatexMath(html, start)) continue;
    hits.push({ start, end: m.index + full.length });
    if (hits.length >= 4) break;
  }

  if (hits.length < 4) {
    hits.length = 0;
    const loose =
      /(?<![A-Za-z0-9(])(?:([a-dA-D]|[601])(?:[.,)](?:\s|&nbsp;)|&nbsp;|\s+(?=[\\$<\d\-]))|([eE][lL])\.)/g;
    while ((m = loose.exec(html)) !== null) {
      if (isInsideLatexMath(html, m.index)) continue;
      // Don't treat the "A)" inside "(A)" as a bare marker.
      if (m.index > 0 && html[m.index - 1] === "(") continue;
      hits.push({ start: m.index, end: m.index + m[0].length });
      if (hits.length >= 4) break;
    }
  }

  if (hits.length < 4) {
    if (hits.length >= 2 && html.includes("<img")) {
      const stemHtml = html.slice(0, hits[0]!.start).trim();
      const optA = cleanOptionBody(html.slice(hits[0]!.end, hits[1]!.start));
      const afterB = html.slice(hits[1]!.end);
      const img = /<img\b[^>]*\/?>/i.exec(afterB);
      const optB = cleanOptionBody(img ? afterB.slice(0, img.index) : afterB);
      const note =
        "<p><em>Remaining choices appear in the figure. Select the matching label.</em></p>";
      return {
        stemHtml: `${stemHtml}\n${note}`.trim(),
        options: [
          optA || "<p><strong>(a)</strong></p>",
          optB || "<p><strong>(b)</strong></p>",
          "<p><strong>(c)</strong> — as labeled in the figure</p>",
          "<p><strong>(d)</strong> — as labeled in the figure</p>",
        ],
      };
    }
    return null;
  }

  const four = hits.slice(0, 4);
  const stemHtml = html.slice(0, four[0]!.start).trim();
  const options = [
    cleanOptionBody(html.slice(four[0]!.end, four[1]!.start)),
    cleanOptionBody(html.slice(four[1]!.end, four[2]!.start)),
    cleanOptionBody(html.slice(four[2]!.end, four[3]!.start)),
    cleanOptionBody(html.slice(four[3]!.end)),
  ];
  if (options.some((o) => !o)) return null;
  return { stemHtml, options };
}

/** MCQ where choices only appear inside a composite figure (no (1)–(4) text). */
function extractImageOnlyMcq(rawHtml: string): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html.includes("<img")) return null;

  // Only inspect text AFTER the last figure — incidental (A)/(t)/(x) in the stem
  // must not block image-choice papers where options live in the figure.
  const imgs = [...html.matchAll(/<img\b[^>]*\/?>/gi)];
  const last = imgs[imgs.length - 1];
  if (!last || last.index == null) return null;
  const after = html.slice(last.index + last[0].length);
  const markerRe = /\(\s*([1-4]|[a-dA-D])\s*\.?\s*\)/;
  if (markerRe.test(after)) return null;
  if (/(?<![A-Za-z0-9])[aA]\.\s*&nbsp;|(?<![A-Za-z0-9])[aA]\.\s+\S/.test(after)) return null;

  const note =
    "<p><em>Choices are labeled (1)–(4) in the figure above. Select the matching label.</em></p>";
  const options = [
    "<p><strong>(1)</strong> — as labeled in the figure</p>",
    "<p><strong>(2)</strong> — as labeled in the figure</p>",
    "<p><strong>(3)</strong> — as labeled in the figure</p>",
    "<p><strong>(4)</strong> — as labeled in the figure</p>",
  ];
  return { stemHtml: `${html}\n${note}`.trim(), options };
}

/** Normalize `(4</strong>)` / `(1<em>)</em>` so option markers survive broken wraps. */
function normalizeBrokenOptionMarkers(html: string): string {
  return html.replace(
    /\(\s*([1-4a-dA-D])\s*(?:<\/?(?:strong|em|b|i|span)\b[^>]*>\s*)+\)/gi,
    "($1)"
  );
}

/**
 * (a)(b)(c) with (d) omitted — remainder after (c) is option D
 * (side-by-side layout common in older JEE papers).
 */
function extractStemOptionsAbcMissingD(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = normalizeBrokenOptionMarkers(rawHtml.trim());
  if (/\(\s*d\s*\)/i.test(html)) return null;

  const reA = /\(\s*a\s*\)/i;
  const reB = /\(\s*b\s*\)/i;
  const reC = /\(\s*c\s*\)/i;
  const ma = reA.exec(html);
  const mb = reB.exec(html);
  const mc = reC.exec(html);
  if (!ma || !mb || !mc) return null;
  if (!(ma.index < mb.index && mb.index < mc.index)) return null;

  const afterA = endOfParenMarkerFrom(html, ma.index);
  const afterB = endOfParenMarkerFrom(html, mb.index);
  const afterC = endOfParenMarkerFrom(html, mc.index);
  const optA = html.slice(afterA, mb.index).trim();
  const optB = html.slice(afterB, mc.index).trim();
  const optC = html.slice(afterC).trim();
  // Need some D body (math / text / image), not empty.
  if (!optC) return null;
  const stemHtml = html.slice(0, ma.index).trim();

  // Trailing unlabeled figure after (A)(B)(C) text/math → option D.
  const imgHit = /<img\b[^>]*\/?>/i.exec(optC);
  if (imgHit && imgHit.index != null && imgHit.index > 0) {
    const beforeImg = optC.slice(0, imgHit.index).trim();
    const afterImg = optC.slice(imgHit.index + imgHit[0].length);
    const beforeText = beforeImg
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const afterText = afterImg
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (beforeText && !afterText) {
      return {
        stemHtml,
        options: [
          cleanOptionBody(optA),
          cleanOptionBody(optB),
          cleanOptionBody(beforeImg),
          imgHit[0],
        ],
      };
    }
  }

  // If (c) body contains another unlabeled chunk after heavy nbsp, split mid.
  const split = /(?:&nbsp;\s*){4,}|\s{6,}/.exec(optC);
  if (split && split.index != null && split.index > 0) {
    const cBody = optC.slice(0, split.index).trim();
    const dBody = optC.slice(split.index + split[0].length).trim();
    if (cBody && dBody) {
      return {
        stemHtml,
        options: [
          cleanOptionBody(optA),
          cleanOptionBody(optB),
          cleanOptionBody(cBody),
          cleanOptionBody(dBody),
        ],
      };
    }
  }
  // Fallback: treat whole after-(c) as D and leave C empty-ish — reject.
  return null;
}

/**
 * (a) … OCR-junk … (c)(d) where (b) is typed as `G)` / `o)` / `(6)`.
 */
function extractStemOptionsAcDMissingBText(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = normalizeBrokenOptionMarkers(rawHtml.trim());
  if (/\(\s*b\s*\)/i.test(html)) return null;

  const reA = /\(\s*a\s*\)/i;
  const reC = /\(\s*c\s*\)/i;
  const reD = /\(\s*d\s*\)/i;
  const ma = reA.exec(html);
  const mc = reC.exec(html);
  const md = reD.exec(html);
  if (!ma || !mc || !md) return null;
  if (!(ma.index < mc.index && mc.index < md.index)) return null;

  const afterA = endOfParenMarkerFrom(html, ma.index);
  const mid = html.slice(afterA, mc.index);
  const junkRe = /(?:[GoO6]\)|\(\s*[GoO6]\s*\))/i;
  const jm = junkRe.exec(mid);
  if (!jm || jm.index == null) return null;

  const optA = cleanOptionBody(mid.slice(0, jm.index));
  const optB = cleanOptionBody(mid.slice(jm.index + jm[0].length));
  const afterC = endOfParenMarkerFrom(html, mc.index);
  const optC = cleanOptionBody(html.slice(afterC, md.index));
  const afterD = endOfParenMarkerFrom(html, md.index);
  const optD = cleanOptionBody(html.slice(afterD));
  if (!optA || !optB || !optC || !optD) return null;

  return {
    stemHtml: html.slice(0, ma.index).trim(),
    options: [optA, optB, optC, optD],
  };
}

function buildAnswerKeyPlaceholderMcq(
  stemHtml: string,
  letter: "A" | "B" | "C" | "D"
): { stemHtml: string; options: string[]; correctLetter: "A" | "B" | "C" | "D" } {
  const note =
    '<p class="text-sm opacity-80"><em>Source options missing or unreadable; answer key preserved as (1)–(4).</em></p>';
  const body = stemHtml.trim()
    ? stemHtml
    : "<p><em>Source stem missing in catalog.</em></p>";
  return {
    stemHtml: `${note}\n${body}`.trim(),
    options: [
      "<p><strong>(1)</strong></p>",
      "<p><strong>(2)</strong></p>",
      "<p><strong>(3)</strong></p>",
      "<p><strong>(4)</strong></p>",
    ],
    correctLetter: letter,
  };
}

function isGarbageStem(qHtml: string): boolean {
  // Image-only questions (figure is the stem) are valid — never treat as garbage.
  if (/<img\b/i.test(qHtml)) return false;
  const plain = stripHtmlToText(qHtml).toLowerCase();
  if (!plain) return true;
  if (plain.length <= 2) return true;
  return plain === "l" || plain === "h" || plain === "m" || plain === "n";
}

function collectImgTags(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\/?>/gi)].map((m) => m[0]!);
}

function imgFingerprint(tag: string): string {
  const m =
    /show_qimage\/([^"'>\s]+)/i.exec(tag) ??
    /src=["']?\s*([^"'\s>]+)/i.exec(tag);
  return (m?.[1] ?? tag).trim().toLowerCase();
}

/** Re-attach any <img> from the source that option-splitting dropped from the stem. */
function attachMissingImages(
  originalHtml: string,
  stemHtml: string,
  options: string[]
): string {
  const kept = new Set(
    [...collectImgTags(stemHtml), ...options.flatMap((o) => collectImgTags(o))].map(
      imgFingerprint
    )
  );
  const missing = collectImgTags(originalHtml).filter(
    (t) => !kept.has(imgFingerprint(t))
  );
  if (missing.length === 0) return stemHtml;
  return `${stemHtml}\n${missing.join("\n")}`.trim();
}

/**
 * Last-resort fallback for source-typo cases where option labels are
 * corrupted — duplicate letters ("(a)(b)(b)(b)"), missing letters
 * ("(a)(b)(d)(d)"), OCR typos ("o." or "(n)" instead of "a." or "(c)"),
 * etc. The question text still has the canonical BITSAT layout
 * (1 stem + 1–4 option blocks), so we split on <p> blocks, then on
 * letter/dot markers within those blocks, and re-number the first 4
 * markers A/B/C/D in document order.
 */
function extractMalformedLabelMcq(
  rawHtml: string
): { stemHtml: string; options: string[]; note: string } | null {
  const html = rawHtml.trim();
  if (!html) return null;
  if (html.includes("<table")) return null; // match-the-columns, not a corrupted MCQ

  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const blocks: Array<{ inner: string }> = [];
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(html)) !== null) {
    blocks.push({ inner: pm[1] ?? "" });
  }
  if (blocks.length < 3) return null;
  const nonEmpty = blocks.filter((b) => b.inner.replace(/<[^>]*>/g, "").trim() !== "");
  if (nonEmpty.length < 3) return null;

  // Stem = first non-empty block. Options = everything after.
  const stemBlock = nonEmpty[0]!;
  const optionBlocks = nonEmpty.slice(1);

  // Find every "letter + dot/paren" marker in the option blocks, in
  // document order. Accepts "a.", "A)", "(a)", "(c)" etc. — anything
  // letter-then-punctuation, optionally wrapped in parens. We also
  // include two well-known OCR typos:
  //   "o." / "O." — visually mistaken for "a."
  //   "n)" / "N)" — visually mistaken for "c)" (especially in BITSAT)
  // Both shapes show up in BITSAT source JSONs.
  type Hit = { absStart: number; end: number };
  const allMarkers: Hit[] = [];
  let offset = 0;
  for (const b of optionBlocks) {
    // Open paren is optional so we match both "(a)" and bare "a.".
    const re = /(?<![A-Za-z0-9])\(?([a-dA-D]|[oO]|[nN])\s*[\.\)]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b.inner)) !== null) {
      allMarkers.push({ absStart: offset + m.index, end: offset + m.index + m[0].length });
    }
    offset += b.inner.length + 1; // +1 for the join sentinel (see below)
  }
  if (allMarkers.length < 4) return null;

  // Stitch the option blocks together with a 1-char sentinel so the
  // absolute offsets in `allMarkers` resolve to the same characters.
  const optionText = optionBlocks.map((b) => b.inner).join("\u0000");
  const totalChars = optionText.replace(/\u0000/g, "").length;
  if (totalChars > 1200) return null;

  const first4 = allMarkers.slice(0, 4);
  const bodies: string[] = [];
  for (let i = 0; i < 4; i++) {
    const cur = first4[i]!;
    const nextStart = i + 1 < first4.length ? first4[i + 1]!.absStart : optionText.length;
    bodies.push(
      optionText
        .slice(cur.end, nextStart)
        .replace(/\u0000/g, " ")
        .trim()
    );
  }

  const wrap = (label: "A" | "B" | "C" | "D", body: string): string =>
    `<p><strong>(${label})</strong> ${body}`.trimEnd() + "</p>";

  return {
    stemHtml: stemBlock.inner.trim(),
    options: [
      wrap("A", bodies[0]!),
      wrap("B", bodies[1]!),
      wrap("C", bodies[2]!),
      wrap("D", bodies[3]!),
    ],
    note: "Option labels in source were corrupted (duplicates / missing letters / OCR typos). Options were re-numbered A–D in document order.",
  };
}

function extractStemAndOptions(rawHtml: string): { stemHtml: string; options: string[] } | null {
  const html = normalizeBrokenOptionMarkers(rawHtml);

  // When choices live only in a figure (no standalone (A)–(D)/(1)–(4) text
  // markers), prefer image-only before letter/digit splitters — those often
  // false-hit mid-sentence tokens like "area A," and slice the figure away.
  const withoutLatex = html.replace(/\\\([\s\S]*?\\\)/g, " ");
  const hasStandaloneOptionMarkers =
    /\(\s*[A-Da-d1-4]\s*\)/.test(withoutLatex) ||
    /(?:^|>)\s*[A-Da-d]\s*[\.\)]/.test(withoutLatex);
  if (html.includes("<img") && !hasStandaloneOptionMarkers) {
    const imageOnly = extractImageOnlyMcq(html);
    if (imageOnly) return imageOnly;
  }

  // Prefer structured (A)/(1) markers before the OCR-tolerant loose pass so
  // incidental "a." / "1." / "0." / "6." hits cannot steal numbered MCQs.
  return (
    extractStemAndOptionsLatexEmbeddedNumbers(html) ??
    extractStemAndOptionsAbcdFlexible(html) ??
    extractStemAndOptionsAbcd(html) ??
    extractStemAndOptionsAbcdDot(html) ??
    extractStemOptionsAcDMissingBWithImg(html) ??
    extractStemOptionsAcDMissingBText(html) ??
    extractStemOptionsAbcMissingD(html) ??
    extractStemAndOptionsFourSequential(html) ??
    extractStemAndOptions124(html) ??
    extractStemAndOptions1234Dot(html) ??
    extractStemOptionsFirstFourMarkers(html) ??
    extractStemAndOptionsLooseDotMarkers(html) ??
    extractImageOnlyMcq(html)
  );
}

/** Bare `1.` / `1)` / `4,` option markers (JEE style), one per <p>. */
function extractStemAndOptions1234Dot(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  type Block = { absStart: number; innerStart: number; text: string };
  const blocks: Block[] = [];
  const findRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let fm: RegExpExecArray | null;
  let lastEnd = 0;
  while ((fm = findRe.exec(html)) !== null) {
    const absStart = fm.index;
    const innerStart = fm.index + fm[0].indexOf(">") + 1;
    blocks.push({ absStart, innerStart, text: fm[1]! });
    lastEnd = absStart + fm[0].length;
  }
  if (lastEnd < html.length) {
    blocks.push({ absStart: lastEnd, innerStart: lastEnd, text: html.slice(lastEnd) });
  }
  if (blocks.length === 0) return null;

  const startMarker = /^\s*(?:&nbsp;\s*)*([1-4])\s*[\.,\)]/;
  type Hit = { digit: 1 | 2 | 3 | 4; absStart: number; absEnd: number };
  const hits: Hit[] = [];

  for (const b of blocks) {
    const m = startMarker.exec(b.text);
    if (!m) continue;
    const digit = Number(m[1]) as 1 | 2 | 3 | 4;
    if (hits.some((h) => h.digit === digit)) continue;
    const absStart = b.innerStart + (m.index ?? 0);
    const absEnd = absStart + m[0].length;
    hits.push({ digit, absStart, absEnd });
    if (hits.length >= 4) break;
  }

  if (hits.length < 4) return null;
  hits.sort((x, y) => x.absStart - y.absStart);
  for (let i = 0; i < 4; i++) {
    if (hits[i]!.digit !== ((i + 1) as 1 | 2 | 3 | 4)) return null;
  }

  const stemHtml = html.slice(0, hits[0]!.absStart).trim();
  const options = [
    cleanOptionBody(html.slice(hits[0]!.absEnd, hits[1]!.absStart)),
    cleanOptionBody(html.slice(hits[1]!.absEnd, hits[2]!.absStart)),
    cleanOptionBody(html.slice(hits[2]!.absEnd, hits[3]!.absStart)),
    cleanOptionBody(html.slice(hits[3]!.absEnd)),
  ];
  if (options.some((o) => !o)) return null;
  return { stemHtml, options };
}

function numericChoiceToLetter(raw: string | undefined): "A" | "B" | "C" | "D" | null {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 4) return null;
  return (["A", "B", "C", "D"] as const)[n - 1] ?? null;
}

function resolveMcqLetter(q: JsonQuestion): "A" | "B" | "C" | "D" | null {
  const ansRaw = str(q, "answer");
  const ans = ansRaw.toUpperCase();
  if (ans === "WRONGANS" || ans === "WRONG" || ans === "N/A" || ans === "NA") {
    const fromBad =
      numericChoiceToLetter(str(q, "fk_optionId")) ?? numericChoiceToLetter(str(q, "optionId"));
    if (fromBad) return fromBad;
  }
  const c0 = ans.charAt(0);
  if (["A", "B", "C", "D"].includes(c0) && ansRaw.length <= 2) {
    return c0 as "A" | "B" | "C" | "D";
  }
  const lower0 = ansRaw.charAt(0).toLowerCase();
  if (["a", "b", "c", "d"].includes(lower0) && ansRaw.length <= 2) {
    return lower0.toUpperCase() as "A" | "B" | "C" | "D";
  }
  const fromAnswer = numericChoiceToLetter(ansRaw);
  if (fromAnswer) return fromAnswer;
  const fromOpt =
    numericChoiceToLetter(str(q, "fk_optionId")) ?? numericChoiceToLetter(str(q, "optionId"));
  if (fromOpt) return fromOpt;
  return null;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveNumericAnswerRaw(q: JsonQuestion): string | null {
  const ans = str(q, "answer");
  if (parseNumericAnswerHint(ans) != null) return ans;

  const sol = stripHtmlToText(str(q, "solutionText"));
  if (!sol) return null;

  const explicit =
    sol.match(
      /(?:answer|basicity|ratio|number|total|sum|value|equals?|is)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i
    ) ??
    sol.match(
      /(?:answer|basicity|ratio|number|total|sum|value|equals?|is)\s*[:=]?\s*(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i
    );
  if (explicit) return explicit[1]!;

  const qPlain = stripHtmlToText(str(q, "questionText")).toLowerCase();
  if (/\bsum\b/.test(qPlain)) {
    const nums = [...sol.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    if (nums.length >= 2 && nums.every((n) => Number.isFinite(n))) {
      return String(nums[0]! + nums[1]!);
    }
  }

  if (parseNumericAnswerHint(sol) != null) return sol;
  return null;
}

function buildNumericMcq(
  answerRaw: string
): { options: string[]; correctLetter: "A" | "B" | "C" | "D" } | null {
  const num = parseNumericAnswerHint(answerRaw);
  if (num == null) return null;
  const n = Math.round(num);

  const pool = [n, n + 1, n - 1, n + 2].map((x) => Math.round(x));
  const seen = new Set<number>();
  const four: number[] = [];
  for (const x of pool) {
    if (!seen.has(x)) {
      seen.add(x);
      four.push(x);
    }
    if (four.length >= 4) break;
  }
  for (let d = 3; four.length < 4 && d < 100; d++) {
    for (const cand of [n + d, n - d]) {
      if (four.length >= 4) break;
      if (!seen.has(cand)) {
        seen.add(cand);
        four.push(cand);
      }
    }
  }
  four.sort((a, b) => a - b);
  let correctIdx = four.indexOf(n);
  if (correctIdx < 0) {
    four[0] = n;
    four.sort((a, b) => a - b);
    correctIdx = four.indexOf(n);
  }
  const letter = (["A", "B", "C", "D"] as const)[correctIdx >= 0 ? correctIdx : 0];
  return { options: four.map(String), correctLetter: letter };
}

function buildPlaceholderNumericMcq(): {
  options: string[];
  correctLetter: "A" | "B" | "C" | "D";
} {
  return { options: ["0", "1", "2", "3"], correctLetter: "A" };
}

function isNumericalQuestion(q: JsonQuestion): boolean {
  const t = str(q, "queAnsType").toLowerCase();
  return t !== "mcq" && t.length > 0;
}

function isPlaceholderStem(qHtml: string): boolean {
  const plain = stripHtmlToText(qHtml).toLowerCase();
  return plain === "no question" || plain === "no solushion" || plain === "no solution";
}

type ExamImportConfig = {
  durationMinutes: number;
  markingScheme: string;
  classLevel: number;
  totalMarksMultiplier: number;
};

const EXAM_CONFIG: Record<string, ExamImportConfig> = {
  BITSAT: {
    durationMinutes: 180,
    markingScheme:
      "+3 for each correct response, −1 for each incorrect response, 0 if unattempted (BITSAT pattern).",
    classLevel: 11,
    totalMarksMultiplier: 3,
  },
  "JEE Main": {
    durationMinutes: 180,
    markingScheme:
      "+4 for each correct response, −1 for each incorrect response, 0 if unattempted (JEE Main pattern).",
    classLevel: 11,
    totalMarksMultiplier: 4,
  },
  KCET: {
    durationMinutes: 240,
    markingScheme: "+1 per correct response, 0 for incorrect or unattempted (KCET pattern).",
    classLevel: 11,
    totalMarksMultiplier: 1,
  },
  COMEDK: {
    durationMinutes: 180,
    markingScheme: "+1 per correct response, 0 for incorrect or unattempted (COMEDK UGET pattern).",
    classLevel: 12,
    totalMarksMultiplier: 1,
  },
  "JEE Advanced": {
    durationMinutes: 180,
    markingScheme:
      "+3 for each correct response, −1 for each incorrect response, 0 if unattempted (JEE Advanced pattern).",
    classLevel: 11,
    totalMarksMultiplier: 3,
  },
};

function resolveExamConfig(examName: string): ExamImportConfig {
  return EXAM_CONFIG[examName] ?? EXAM_CONFIG.BITSAT!;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jsonPath = process.env.JSON_PATH;
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

  if (!dryRun && (!url || !key)) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!jsonPath) {
    throw new Error("Missing JSON_PATH");
  }
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON not found: ${jsonPath}`);
  }

  const rawJson = fs.readFileSync(jsonPath, "utf8");
  const exam = JSON.parse(rawJson) as ExamJson;
  const questions = exam.questions ?? [];
  if (questions.length === 0) throw new Error("No questions in JSON");

  const examName = (process.env.EXAM_NAME_OVERRIDE?.trim() || exam.examName || "BITSAT").trim();
  const examTypeName = (exam.examTypeName ?? "Previous Question Paper Set").trim();
  const examConfig = resolveExamConfig(examName);
  const examSetName = (exam.examSetName ?? "Paper Set").trim();
  const title = `${examName} — ${examSetName}`;
  const slug =
    process.env.PAST_PAPER_SLUG?.trim() ||
    slugify(`${examName}-${examSetName}-${exam.examSetId ?? ""}`).replace(/-+$/, "") ||
    slugify(title);

  const supabase = !dryRun && url && key ? createClient(url, key) : null;

  if (supabase) {
    // Match by slug only — title can collide across sets / legacy rows and
    // cascading deletes would null out mock_test_attempts.past_paper_id.
    const { data: existingRows, error: existingErr } = await supabase
      .from("past_papers")
      .select("id, slug, title")
      .eq("slug", slug);
    if (existingErr) throw existingErr;
    for (const row of existingRows ?? []) {
      const { error: delErr } = await supabase.from("past_papers").delete().eq("id", row.id);
      if (delErr) throw delErr;
    }
  }

  type Prepared = Record<string, unknown> & { _sortKey: number };
  const prepared: Prepared[] = [];
  const coveredSet = new Set<Subject>();
  const malformedQuestions: Array<{ paperFile: string; questionId: string; note: string }> = [];
  let skipped = 0;
  let lastSubject: Subject | null = null;

  for (const q of questions) {
    const qHtml = str(q, "questionText");

    const subj = resolveSubject(q, lastSubject);
    if (!subj) {
      console.warn("Skip questionId", str(q, "questionId"), "(unknown subject)");
      skipped++;
      continue;
    }
    lastSubject = subj;
    coveredSet.add(subj);

    let stemHtml: string;
    let options: string[];
    let correctLetter: "A" | "B" | "C" | "D";
    let malformedNote: string | null = null;

    if (isNumericalQuestion(q)) {
      const rawAns = resolveNumericAnswerRaw(q);
      const syn = rawAns ? buildNumericMcq(rawAns) : null;
      const used = syn ?? buildPlaceholderNumericMcq();
      const note = syn
        ? '<p class="text-sm opacity-80"><em>Numerical (integer). Choose the option that matches the correct value rounded to the nearest integer.</em></p>'
        : '<p class="text-sm opacity-80"><em>Numerical — source answer was missing or incomplete; verify against the solution / figure.</em></p>';
      stemHtml = `${note}\n${qHtml || "<p><em>Source stem missing.</em></p>"}`.trim();
      options = used.options;
      correctLetter = used.correctLetter;
    } else if (isPlaceholderStem(qHtml) || isGarbageStem(qHtml)) {
      correctLetter =
        resolveMcqLetter(q) ??
        numericChoiceToLetter(str(q, "fk_optionId")) ??
        numericChoiceToLetter(str(q, "optionId")) ??
        "A";
      const ph = buildAnswerKeyPlaceholderMcq(
        isGarbageStem(qHtml) && stripHtmlToText(qHtml).length > 0 ? qHtml : "",
        correctLetter
      );
      stemHtml = ph.stemHtml;
      options = ph.options;
    } else {
      const parsed = extractStemAndOptions(qHtml);
      if (!parsed) {
        // Last-resort: source-typo case where the option labels are corrupted
        // (duplicate letters, OCR typos like "o." or "(n)", missing letters).
        const malformed = extractMalformedLabelMcq(qHtml);
        if (malformed) {
          const letter = resolveMcqLetter(q);
          if (!letter) {
            console.warn("Skip questionId", str(q, "questionId"), "(correct answer not resolved)");
            skipped++;
            continue;
          }
          stemHtml = malformed.stemHtml;
          options = malformed.options;
          correctLetter = letter;
          malformedNote = malformed.note;
        } else {
          const letter = resolveMcqLetter(q);
          if (!letter) {
            const rawAns = resolveNumericAnswerRaw(q);
            const syn = rawAns ? buildNumericMcq(rawAns) : null;
            if (syn || /_{3,}|\.{3,}|…{2,}|_{2,}/.test(stripHtmlToText(qHtml))) {
              const used = syn ?? buildPlaceholderNumericMcq();
              const note = syn
                ? '<p class="text-sm opacity-80"><em>Numerical (integer). Choose the option that matches the correct value rounded to the nearest integer.</em></p>'
                : '<p class="text-sm opacity-80"><em>Numerical — source answer was missing or incomplete; verify against the solution / figure.</em></p>';
              stemHtml = `${note}\n${qHtml}`.trim();
              options = used.options;
              correctLetter = used.correctLetter;
              malformedNote = "numerical fallback (MCQ answer key missing)";
            } else {
              console.warn("Skip questionId", str(q, "questionId"), "(options not parsed)");
              skipped++;
              continue;
            }
          } else {
            const ph = buildAnswerKeyPlaceholderMcq(qHtml, letter);
            stemHtml = ph.stemHtml;
            options = ph.options;
            correctLetter = ph.correctLetter;
            malformedNote = "answer-key placeholder (options missing in source)";
          }
        }
      } else {
        const letter = resolveMcqLetter(q);
        if (!letter) {
          // Fill-blank / integer value stored as MCQ with wrongAns — synthesize numeric choices.
          const rawAns = resolveNumericAnswerRaw(q);
          const syn = rawAns ? buildNumericMcq(rawAns) : null;
          if (syn || /_{3,}|\.{3,}|…{2,}|_{2,}/.test(stripHtmlToText(qHtml))) {
            const used = syn ?? buildPlaceholderNumericMcq();
            const note = syn
              ? '<p class="text-sm opacity-80"><em>Numerical (integer). Choose the option that matches the correct value rounded to the nearest integer.</em></p>'
              : '<p class="text-sm opacity-80"><em>Numerical — source answer was missing or incomplete; verify against the solution / figure.</em></p>';
            stemHtml = `${note}\n${qHtml}`.trim();
            options = used.options;
            correctLetter = used.correctLetter;
          } else {
            console.warn("Skip questionId", str(q, "questionId"), "(correct answer not resolved)");
            skipped++;
            continue;
          }
        } else {
          stemHtml = parsed.stemHtml;
          options = parsed.options;
          correctLetter = letter;
        }
      }
    }

    // Never drop figures that option-splitting left behind (common for fig-I/II MCQs).
    if (qHtml && !isNumericalQuestion(q)) {
      stemHtml = attachMissingImages(qHtml, stemHtml, options);
      const relocated = relocateOptionImagesToStem(stemHtml, options);
      stemHtml = relocated.stemHtml;
      options = relocated.options;
    }

    const sortKey =
      parseInt(str(q, "set_question_number") || str(q, "questionNumber") || "0", 10) ||
      prepared.length + 999;

    const [selfStem, selfSol] = dryRun
      ? [stemHtml, str(q, "solutionText") || null]
      : await Promise.all([
          selfHostImages(stemHtml),
          selfHostImages(str(q, "solutionText") || null),
        ]);

    prepared.push({
      _sortKey: sortKey,
      sort_order: 0,
      source_question_id: str(q, "questionId") || null,
      subject: subj,
      topic: str(q, "topicName") || null,
      chapter: str(q, "chapterName") || null,
      difficulty: str(q, "dificulty") || str(q, "difficulty") || null,
      question_html: selfStem ?? stemHtml,
      solution_html: selfSol,
      correct_letter: correctLetter,
      options_json: options.slice(0, 4),
    });
    if (malformedNote) {
      malformedQuestions.push({
        paperFile: jsonPath,
        questionId: str(q, "questionId"),
        note: malformedNote,
      });
    }
  }

  prepared.sort((a, b) => a._sortKey - b._sortKey);
  const batch = prepared.map((r, idx) => {
    const { _sortKey: _order, ...rest } = r;
    void _order;
    return { ...rest, sort_order: idx + 1 };
  });

  if (batch.length === 0) {
    throw new Error("No valid questions parsed from JSON");
  }

  if (dryRun) {
    if (skipped > 0) {
      throw new Error(
        `DRY_RUN: skipped ${skipped} of ${questions.length} — refusing incomplete import`
      );
    }
    console.log(
      JSON.stringify(
        {
          dry_run: true,
          exam_name: examName,
          exam_set_name: examSetName,
          imported_slug: slug,
          questions_in_json: questions.length,
          questions_ok: batch.length,
          rows_skipped: skipped,
          malformed_recovered: malformedQuestions.length,
          subjects_covered: Array.from(coveredSet),
        },
        null,
        2
      )
    );
    return;
  }

  if (!supabase) throw new Error("Supabase client missing");

  const subjectOrder: Record<Subject, number> = {
    physics: 0,
    chemistry: 1,
    math: 2,
    biology: 3,
  };
  const subjectsCovered = Array.from(coveredSet).sort(
    (a, b) => (subjectOrder[a] ?? 9) - (subjectOrder[b] ?? 9)
  );

  const durationMinutes = examConfig.durationMinutes;
  // The `question_count` and `total_marks` on the paper row should reflect
  // the REAL exam size as given to students on test day — not just the
  // subset of PCM questions we import into our app. BITSAT papers, for
  // example, have 150 questions pre-2022 and 130 questions from 2022
  // onwards, of which only ~100-125 are Physics/Chemistry/Math (the
  // remainder are English / Logical Reasoning, which our taxonomy does
  // not cover). Storing the real exam total here keeps the library UI
  // honest about paper size and duration-to-question ratio.
  const examQuestionCount = questions.length;
  const examTotalMarks = examQuestionCount * examConfig.totalMarksMultiplier;
  const markingScheme = examConfig.markingScheme;

  // Tag with year (extracted from "KCET 2024" / "BITSAT - 2009" → year) and exam type.
  const yearMatch = examSetName.match(/\b(20\d{2})\b/);
  const yearTag = yearMatch ? yearMatch[1] : null;
  const tags = [examName, yearTag, "PYQ", examTypeName].filter((t): t is string => Boolean(t));

  const { data: paper, error: paperErr } = await supabase
    .from("past_papers")
    .insert({
      slug,
      title,
      exam_name: examName,
      exam_set_name: examSetName,
      paper_type: "pyq",
      duration_minutes: durationMinutes,
      total_marks: examTotalMarks,
      question_count: examQuestionCount,
      marking_scheme: markingScheme,
      class_level: examConfig.classLevel,
      tags,
      subjects_covered: subjectsCovered,
      published: true,
    })
    .select("id")
    .single();

  if (paperErr || !paper) throw paperErr ?? new Error("Could not insert past_papers row");
  const paperId = paper.id as string;

  const CHUNK = 80;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const slice = batch.slice(i, i + CHUNK).map((row) => ({ ...row, paper_id: paperId }));
    const { error } = await supabase.from("past_paper_questions").insert(slice);
    if (error) throw error;
  }

  if (malformedQuestions.length > 0) {
    console.warn(
      `\n⚠️  ${malformedQuestions.length} question(s) had corrupted option labels in source — recovered via last-resort extractor (options re-numbered A–D in document order):`
    );
    for (const m of malformedQuestions) {
      console.warn(`   • ${m.questionId}  →  ${m.note}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        exam_name: examName,
        exam_set_name: examSetName,
        imported_slug: slug,
        imported_title: title,
        paper_id: paperId,
        exam_question_count: examQuestionCount,
        questions_in_json: questions.length,
        questions_inserted: batch.length,
        rows_skipped: skipped,
        malformed_recovered: malformedQuestions.length,
        subjects_covered: subjectsCovered,
        duration_minutes: durationMinutes,
        exam_total_marks: examTotalMarks,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
