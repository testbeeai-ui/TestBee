/**
 * Import one mock paper JSON (exam object + questions[]) into mock_papers + mock_questions.
 *
 * Usage:
 *   JSON_PATH="C:/path/to/paper.json" npx tsx --env-file-if-exists=.env scripts/import-mock-paper-json.ts
 *
 * Set examName in JSON to the canonical catalog value, e.g. "COMEDK", "JEE Main", "BITSAT", "KCET".
 * COMEDK Mock-Papers store in `mock_papers` / `mock_questions` with exam_name = "COMEDK"
 * (same tables as other Mock papers — not past_papers).
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent: deletes existing mock_papers row matching slug (and cascades questions) then re-inserts.
 */

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildMockPaperCatalogTitle } from "../lib/mock/mockPaperCatalogTitle";
import { markingSchemeForExamName } from "../lib/mock/mockPaperMarkingScheme";

type JsonQuestion = Record<string, unknown>;

type ExamJson = {
  examName?: string;
  examTypeName?: string;
  examSetName?: string;
  examSetId?: string;
  totalQuestions?: number;
  questions?: JsonQuestion[];
};

type Subject = "physics" | "chemistry" | "math";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
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
  return null;
}

/** (A)(B)(C)(D) markers — same idea as scripts/import-past-paper-csv.ts */
function extractStemAndOptionsAbcd(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  const markerRe = /\(\s*([A-Da-d])\s*\.?\s*\)/g;
  const firstPos = new Map<"A" | "B" | "C" | "D", number>();
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(html)) !== null) {
    const L = m[1]!.toUpperCase() as "A" | "B" | "C" | "D";
    if (!firstPos.has(L)) firstPos.set(L, m.index);
  }

  const required: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  if (!required.every((L) => firstPos.has(L))) return null;

  const aStart = firstPos.get("A")!;
  const bStart = firstPos.get("B")!;
  const cStart = firstPos.get("C")!;
  const dStart = firstPos.get("D")!;
  if (!(aStart < bStart && bStart < cStart && cStart < dStart)) return null;

  const markerEnd = (start: number): number => {
    const mm = /\(\s*[A-Da-d]\s*\.?\s*\)/g;
    mm.lastIndex = start;
    const hit = mm.exec(html);
    return hit ? hit.index + hit[0].length : start;
  };

  const aBody = html.slice(markerEnd(aStart), bStart).trim();
  const bBody = html.slice(markerEnd(bStart), cStart).trim();
  const cBody = html.slice(markerEnd(cStart), dStart).trim();
  const dBody = html.slice(markerEnd(dStart)).trim();
  const stemHtml = html.slice(0, aStart).trim();

  return { stemHtml, options: [aBody, bBody, cBody, dBody] };
}

function endOfParenMarkerFrom(html: string, idx: number): number {
  const slice = html.slice(idx);
  const hit = slice.match(/^\(\s*(?:[1-4]|[a-dA-D])\s*\.?\s*\)/);
  return hit ? idx + hit[0].length : idx;
}

/** Skip `f'(2)`-style markers: `(2)` right after a prime / apostrophe. */
function isParenDigitAfterDerivative(html: string, parenIdx: number): boolean {
  if (parenIdx <= 0) return false;
  const prev = html[parenIdx - 1]!;
  return prev === "'" || prev === "\u2032" || prev === "\u2019";
}

/**
 * (1)(2)(3)(4) markers — digits only for slots 1–4, optional (1.).
 * If (4) is missing, fourth label may be (a) after (3) (JEE-style typo), not lettered-option (a).
 */
function extractStemAndOptions124(rawHtml: string): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  const digitRe = /\(\s*([1-4])\s*\.?\s*\)/g;
  const firstDigit = new Map<1 | 2 | 3 | 4, number>();
  let m: RegExpExecArray | null;
  while ((m = digitRe.exec(html)) !== null) {
    if (isParenDigitAfterDerivative(html, m.index)) continue;
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
    const am = /\(\s*a\s*\)/i.exec(rest);
    if (!am) return null;
    s4 = after3 + am.index;
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
 * (a)(b)(c)(d) with (b) omitted but an <img> between (a) and (c) carries option B (source data quirk).
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
 * First four `(1)–(4)` or `(a)–(d)` markers in order — tolerates duplicate labels (e.g. two `(b)`)
 * and mixed `(4)` / `(d)`. Skips derivative `(n)` after `f'`.
 */
function extractStemOptionsFirstFourMarkers(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  const re = /\(\s*([1-4]|[a-dA-D])\s*\.?\s*\)/g;
  const hits: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tok = m[1]!;
    if (/^[1-4]$/.test(tok) && isParenDigitAfterDerivative(html, m.index)) continue;
    hits.push({ start: m.index, end: m.index + m[0].length });
  }
  if (hits.length < 4) return null;
  const four = hits.slice(0, 4);
  const stemHtml = html.slice(0, four[0].start).trim();
  const options: string[] = [];
  for (let i = 0; i < 4; i++) {
    const bodyStart = four[i].end;
    const bodyEnd = i < 3 ? four[i + 1].start : html.length;
    options.push(html.slice(bodyStart, bodyEnd).trim());
  }
  return { stemHtml, options };
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
 * Bare `a.` `b.` `c.` `d.` markers (COMEDK / BITSAT style), often one per <p>.
 * Dot is required so prose like "An ideal…" does not match.
 */
function extractStemAndOptionsAbcdDot(
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

  type Hit = { letter: "A" | "B" | "C" | "D"; absStart: number; absEnd: number };
  const hits: Hit[] = [];
  const inBlockRe = /(?<![A-Za-z0-9])([a-dA-D])\./g;

  for (let i = optionsStartBlock; i < blocks.length; i++) {
    const b = blocks[i]!;
    inBlockRe.lastIndex = 0;
    let mm: RegExpExecArray | null;
    while ((mm = inBlockRe.exec(b.text)) !== null) {
      const letter = mm[1]!.toUpperCase() as "A" | "B" | "C" | "D";
      if (hits.some((h) => h.letter === letter)) continue;
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
  hits.sort((x, y) => x.absStart - y.absStart);
  const required: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  for (let i = 0; i < 4; i++) {
    if (hits[i]!.letter !== required[i]) return null;
  }

  const stemHtml = html.slice(0, hits[0]!.absStart).trim();
  return {
    stemHtml,
    options: [
      cleanOptionBody(html.slice(hits[0]!.absEnd, hits[1]!.absStart)),
      cleanOptionBody(html.slice(hits[1]!.absEnd, hits[2]!.absStart)),
      cleanOptionBody(html.slice(hits[2]!.absEnd, hits[3]!.absStart)),
      cleanOptionBody(html.slice(hits[3]!.absEnd)),
    ],
  };
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

  // Markers at paragraph starts: a. / b, / c) / d&nbsp; / el. / bare `b&nbsp;` (OCR).
  const re = /(?:^|>|\n|\r)\s*(?:&nbsp;\s*)*(?:([a-dA-D])(?:[.,)]|\s|&nbsp;)|([eE][lL])\.)/g;
  const hits: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const full = m[0]!;
    const markerOffset = full.search(/[a-dA-DeE]/);
    const start = m.index + (markerOffset >= 0 ? markerOffset : 0);
    hits.push({ start, end: m.index + full.length });
    if (hits.length >= 4) break;
  }

  // Fallback: letter + punctuation/nbsp inside blocks (no line-start requirement).
  if (hits.length < 4) {
    hits.length = 0;
    const loose =
      /(?<![A-Za-z0-9])(?:([a-dA-D])(?:[.,)](?:\s|&nbsp;)|&nbsp;|\s+(?=[\\$<\d\-]))|([eE][lL])\.)/g;
    while ((m = loose.exec(html)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length });
      if (hits.length >= 4) break;
    }
  }

  if (hits.length < 4) {
    // Two labeled options + figure (remaining choices in image).
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
  const markerRe = /\(\s*([1-4]|[aA]|[A-Da-d])\s*\.?\s*\)/;
  if (markerRe.test(html)) return null;
  // Bare a./b. options live elsewhere — don't treat as image-only.
  if (/(?<![A-Za-z0-9])[aA]\.\s*&nbsp;|(?<![A-Za-z0-9])[aA]\.\s+\S/.test(html)) return null;

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

function extractStemAndOptions(rawHtml: string): { stemHtml: string; options: string[] } | null {
  // Prefer structured (a)/(1) markers before the OCR-tolerant loose pass so
  // incidental "a." / "1." hits in the stem cannot steal numbered MCQs.
  return (
    extractStemAndOptionsAbcd(rawHtml) ??
    extractStemAndOptionsAbcdDot(rawHtml) ??
    extractStemOptionsAcDMissingBWithImg(rawHtml) ??
    extractStemAndOptions124(rawHtml) ??
    extractStemOptionsFirstFourMarkers(rawHtml) ??
    extractStemAndOptionsLooseDotMarkers(rawHtml) ??
    extractImageOnlyMcq(rawHtml)
  );
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
  // Prefer numeric option ids when answer is a sentinel like "wrongAns".
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
  const fromAnswer = numericChoiceToLetter(str(q, "answer"));
  if (fromAnswer) return fromAnswer;
  const fromOpt =
    numericChoiceToLetter(str(q, "fk_optionId")) ?? numericChoiceToLetter(str(q, "optionId"));
  if (fromOpt) return fromOpt;
  return null;
}

/** Parse numeric answer from prose, brackets, or spaced decimals (e.g. `[1107]`, `- 2.7`). */
function parseNumericAnswerHint(answerRaw: string): number | null {
  const s = String(answerRaw).trim().replace(/−/g, "-");
  const bracket = s.match(/\[(\d+)\]/);
  if (bracket) {
    const n = Number(bracket[1]);
    return Number.isFinite(n) ? n : null;
  }
  const compact = s.replace(/,/g, "").replace(/\s+/g, " ");
  const m = compact.match(/-?\s*\d+(?:\.\d+)?/);
  if (m) {
    const n = Number.parseFloat(m[0].replace(/\s/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Numerical (integer) questions: synthesize 4 integer choices so NtaExamShell MCQ UI works.
 * Correct answer uses JEE-style rounding of the source `answer` field.
 */
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

function isNumericalQuestion(q: JsonQuestion): boolean {
  const t = str(q, "queAnsType").toLowerCase();
  return t !== "mcq" && t.length > 0;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jsonPath = process.env.JSON_PATH;
  const dryRunEarly = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

  if (!dryRunEarly && (!url || !key)) {
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

  const examName = (exam.examName ?? "JEE Main").trim();
  const examTypeName = (exam.examTypeName ?? "Mock").trim();
  const examSetName = (exam.examSetName ?? "Mock Paper").trim();
  const title = buildMockPaperCatalogTitle(examName, examTypeName, examSetName);
  const slug =
    process.env.MOCK_PAPER_SLUG?.trim() ||
    slugify(`${examTypeName}-${examSetName}-${exam.examSetId ?? ""}`).replace(/-+$/, "") ||
    slugify(title);

  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const supabase = dryRun ? null : createClient(url!, key!);

  if (!dryRun && supabase) {
    const { data: existingRows, error: existingErr } = await supabase
      .from("mock_papers")
      .select("id, slug, title")
      .or(`slug.eq.${slug},title.eq.${title}`);
    if (existingErr) throw existingErr;
    for (const row of existingRows ?? []) {
      const { error: delErr } = await supabase.from("mock_papers").delete().eq("id", row.id);
      if (delErr) throw delErr;
    }
  }

  type Prepared = Record<string, unknown> & { _sortKey: number };
  const prepared: Prepared[] = [];
  const coveredSet = new Set<Subject>();
  let skipped = 0;

  for (const q of questions) {
    const qHtml = str(q, "questionText");
    if (!qHtml) {
      skipped++;
      continue;
    }

    const subj = normalizeSubject(str(q, "subjectName"));
    if (!subj) {
      skipped++;
      continue;
    }
    coveredSet.add(subj);

    let questionHtml: string;
    let options: string[];
    let correctLetter: "A" | "B" | "C" | "D";

    if (isNumericalQuestion(q)) {
      const syn = buildNumericMcq(str(q, "answer"));
      if (!syn) {
        console.warn("Skip questionId", str(q, "questionId"), "(numeric answer not parsed)");
        skipped++;
        continue;
      }
      const note =
        '<p class="text-sm opacity-80"><em>Numerical (integer). Choose the option that matches the correct value rounded to the nearest integer.</em></p>';
      questionHtml = `${note}\n${qHtml}`.trim();
      options = syn.options;
      correctLetter = syn.correctLetter;
    } else {
      const parsed = extractStemAndOptions(qHtml);
      if (!parsed) {
        console.warn("Skip questionId", str(q, "questionId"), "(options not parsed)");
        skipped++;
        continue;
      }
      const letter = resolveMcqLetter(q);
      if (!letter) {
        console.warn("Skip questionId", str(q, "questionId"), "(correct answer not resolved)");
        skipped++;
        continue;
      }
      questionHtml = parsed.stemHtml;
      options = parsed.options;
      correctLetter = letter;
    }

    const sortKey =
      parseInt(str(q, "set_question_number") || str(q, "questionNumber") || "0", 10) ||
      prepared.length + 999;

    prepared.push({
      _sortKey: sortKey,
      sort_order: 0,
      source_question_id: str(q, "questionId") || null,
      subject: subj,
      topic: str(q, "topicName") || null,
      chapter: str(q, "chapterName") || null,
      difficulty: str(q, "dificulty") || str(q, "difficulty") || null,
      question_html: questionHtml,
      solution_html: str(q, "solutionText") || null,
      correct_letter: correctLetter,
      options_json: options.slice(0, 4),
    });
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

  const subjectOrder: Record<Subject, number> = { physics: 0, chemistry: 1, math: 2 };
  const subjectsCovered = Array.from(coveredSet).sort(
    (a, b) => (subjectOrder[a] ?? 9) - (subjectOrder[b] ?? 9)
  );

  const examKey = examName.toLowerCase();
  const marksPerQ = examKey === "comedk" || examKey === "kcet" ? 1 : examKey === "bitsat" ? 3 : 4;
  const durationMinutes = examKey === "kcet" ? 240 : 180;
  const totalMarks = batch.length * marksPerQ;
  const classLevel = examKey === "comedk" ? 12 : 11;
  const markingScheme = markingSchemeForExamName(examName);

  if (dryRun) {
    console.log(
      JSON.stringify({
        dryRun: true,
        slug,
        title,
        examName,
        totalSource: questions.length,
        imported: batch.length,
        skipped,
        subjectsCovered,
      })
    );
    if (skipped > 0) {
      throw new Error(
        `DRY_RUN: skipped ${skipped} of ${questions.length} — refusing incomplete import`
      );
    }
    return;
  }

  if (!supabase) throw new Error("Supabase client missing");

  const { data: paper, error: paperErr } = await supabase
    .from("mock_papers")
    .insert({
      slug,
      title,
      exam_name: examName,
      exam_set_name: examSetName,
      paper_type: "mock",
      duration_minutes: durationMinutes,
      total_marks: totalMarks,
      question_count: batch.length,
      marking_scheme: markingScheme,
      class_level: classLevel,
      tags: [examTypeName, examSetName, examName, "Mock"].filter(Boolean),
      subjects_covered: subjectsCovered,
      published: true,
    })
    .select("id")
    .single();

  if (paperErr || !paper) throw paperErr ?? new Error("Could not insert mock_papers row");
  const paperId = paper.id as string;

  const CHUNK = 80;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const slice = batch.slice(i, i + CHUNK).map((row) => ({ ...row, paper_id: paperId }));
    const { error } = await supabase.from("mock_questions").insert(slice);
    if (error) throw error;
  }

  console.log(
    JSON.stringify(
      {
        imported_slug: slug,
        imported_title: title,
        paper_id: paperId,
        questions_inserted: batch.length,
        rows_skipped: skipped,
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
