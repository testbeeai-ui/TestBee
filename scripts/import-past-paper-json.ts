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

  // Find EVERY (A)/(B)/(C)/(D) marker in document order.
  const markerRe = /\(\s*([A-Da-d])\s*\.?\s*\)/g;
  const all: Array<{ letter: "A" | "B" | "C" | "D"; index: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(html)) !== null) {
    all.push({
      letter: m[1]!.toUpperCase() as "A" | "B" | "C" | "D",
      index: m.index,
      end: m.index + m[0].length,
    });
  }
  if (all.length < 4) return null;

  // Prefer markers that start a <p> block; fall back to any marker.
  const blockStarters = all.filter((h) => startsNewBlock(h.index));
  const candidateSets = blockStarters.length >= 4 ? [blockStarters, all] : [all];

  const required: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  for (const set of candidateSets) {
    let runStart = -1;
    for (let i = 0; i + 3 < set.length; i++) {
      let ok = true;
      for (let k = 0; k < 4; k++) {
        if (set[i + k]!.letter !== required[k]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        runStart = i;
        break;
      }
    }
    if (runStart < 0) continue;

    const aHit = set[runStart]!;
    const bHit = set[runStart + 1]!;
    const cHit = set[runStart + 2]!;
    const dHit = set[runStart + 3]!;

    const aBody = html.slice(aHit.end, bHit.index).trim();
    const bBody = html.slice(bHit.end, cHit.index).trim();
    const cBody = html.slice(cHit.end, dHit.index).trim();
    const dBody = html.slice(dHit.end).trim();
    const stemHtml = html.slice(0, aHit.index).trim();

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
  type Hit = { letter: Letter; start: number; end: number };

  // Collect every (A)/(B)/(C)/(D) marker in order — NOT just the first
  // occurrence. The stem may contain a stray "(c)" that would otherwise
  // steal the C slot. Then find the first contiguous A→B→C→D run.
  const all: Hit[] = [];
  const patterns: RegExp[] = [/\(\s*([A-Da-d])\s*\.?\s*\)/g, /(?<![A-Za-z0-9(])([A-Da-d])\s*\)/g];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      all.push({
        letter: m[1]!.toUpperCase() as Letter,
        start: m.index,
        end: m.index + m[0].length,
      });
    }
  }
  if (all.length < 4) return null;
  all.sort((a, b) => a.start - b.start);

  const required: Letter[] = ["A", "B", "C", "D"];
  let runStart = -1;
  for (let i = 0; i + 3 < all.length; i++) {
    let ok = true;
    for (let k = 0; k < 4; k++) {
      if (all[i + k]!.letter !== required[k]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      runStart = i;
      break;
    }
  }
  if (runStart < 0) return null;

  const h1 = all[runStart]!;
  const h2 = all[runStart + 1]!;
  const h3 = all[runStart + 2]!;
  const h4 = all[runStart + 3]!;

  const stemHtml = html.slice(0, h1.start).trim();
  return {
    stemHtml,
    options: [
      html.slice(h1.end, h2.start).trim(),
      html.slice(h2.end, h3.start).trim(),
      html.slice(h3.end, h4.start).trim(),
      html.slice(h4.end).trim(),
    ],
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

/** (1)(2)(3)(4) digit markers — used for integer-choice BITSAT questions. */
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
    if (isParenDigitAfterDerivative(html, m.index)) continue;
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
  const hits: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tok = m[1]!;
    if (/^[1-4]$/.test(tok) && isParenDigitAfterDerivative(html, m.index)) continue;
    hits.push({ start: m.index, end: m.index + m[0].length });
  }
  if (hits.length < 4) return null;
  const four = hits.slice(0, 4);
  const stemHtml = html.slice(0, four[0]!.start).trim();
  const options: string[] = [];
  for (let i = 0; i < 4; i++) {
    const bodyStart = four[i]!.end;
    const bodyEnd = i < 3 ? four[i + 1]!.start : html.length;
    options.push(html.slice(bodyStart, bodyEnd).trim());
  }
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
    hits.push({ start, end: m.index + full.length });
    if (hits.length >= 4) break;
  }

  if (hits.length < 4) {
    hits.length = 0;
    const loose =
      /(?<![A-Za-z0-9])(?:([a-dA-D]|[601])(?:[.,)](?:\s|&nbsp;)|&nbsp;|\s+(?=[\\$<\d\-]))|([eE][lL])\.)/g;
    while ((m = loose.exec(html)) !== null) {
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
  const markerRe = /\(\s*([1-4]|[aA]|[A-Da-d])\s*\.?\s*\)/;
  if (markerRe.test(html)) return null;
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
  return (
    extractStemAndOptionsAbcdFlexible(rawHtml) ??
    extractStemAndOptionsAbcd(rawHtml) ??
    extractStemAndOptionsAbcdDot(rawHtml) ??
    extractStemOptionsAcDMissingBWithImg(rawHtml) ??
    extractStemAndOptionsFourSequential(rawHtml) ??
    extractStemAndOptions124(rawHtml) ??
    extractStemOptionsFirstFourMarkers(rawHtml) ??
    // After stricter (1)–(4) / paren parsers so incidental a./1./0. markers cannot win.
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
    const { data: existingRows, error: existingErr } = await supabase
      .from("past_papers")
      .select("id, slug, title")
      .or(`slug.eq.${slug},title.eq.${title}`);
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
    if (!qHtml) {
      skipped++;
      continue;
    }

    const subj = resolveSubject(q, lastSubject);
    if (!subj) {
      console.warn("Skip questionId", str(q, "questionId"), "(unknown subject)");
      skipped++;
      continue;
    }
    lastSubject = subj;
    coveredSet.add(subj);

    const parsed = extractStemAndOptions(qHtml);
    if (!parsed) {
      // Last-resort: source-typo case where the option labels are corrupted
      // (duplicate letters, OCR typos like "o." or "(n)", missing letters).
      // We can still recover the question body.
      const malformed = extractMalformedLabelMcq(qHtml);
      if (malformed) {
        const letter = resolveMcqLetter(q);
        if (!letter) {
          console.warn("Skip questionId", str(q, "questionId"), "(correct answer not resolved)");
          skipped++;
          continue;
        }
        const sortKey =
          parseInt(str(q, "set_question_number") || str(q, "questionNumber") || "0", 10) ||
          prepared.length + 999;
        const [selfStem, selfSol] = dryRun
          ? [malformed.stemHtml, str(q, "solutionText") || null]
          : await Promise.all([
              selfHostImages(malformed.stemHtml),
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
          question_html: selfStem ?? malformed.stemHtml,
          solution_html: selfSol,
          correct_letter: letter,
          options_json: malformed.options.slice(0, 4),
        });
        malformedQuestions.push({
          paperFile: jsonPath,
          questionId: str(q, "questionId"),
          note: malformed.note,
        });
        continue;
      }
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

    const sortKey =
      parseInt(str(q, "set_question_number") || str(q, "questionNumber") || "0", 10) ||
      prepared.length + 999;

    const [selfStem, selfSol] = dryRun
      ? [parsed.stemHtml, str(q, "solutionText") || null]
      : await Promise.all([
          selfHostImages(parsed.stemHtml),
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
      question_html: selfStem ?? parsed.stemHtml,
      solution_html: selfSol,
      correct_letter: letter,
      options_json: parsed.options.slice(0, 4),
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
