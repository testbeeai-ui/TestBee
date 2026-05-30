/**
 * Shared MCQ JSON parsing for mock_papers imports (JEE + CBSE NCERT).
 */

export type JsonQuestion = Record<string, unknown>;

export type ExamJson = {
  examName?: string;
  examTypeName?: string;
  examSetName?: string;
  examSetId?: string;
  totalQuestions?: number;
  questions?: JsonQuestion[];
};

export type Subject = "physics" | "chemistry" | "math";

export type PreparedQuestionRow = {
  sort_order: number;
  source_question_id: string | null;
  subject: Subject;
  topic: string | null;
  chapter: string | null;
  difficulty: string | null;
  question_html: string;
  solution_html: string | null;
  correct_letter: "A" | "B" | "C" | "D";
  options_json: string[];
};

export function str(q: JsonQuestion, key: string): string {
  const v = q[key];
  return v == null ? "" : String(v).trim();
}

export function normalizeSubject(raw: string): Subject | null {
  const s = raw.trim().toLowerCase();
  if (s === "physics") return "physics";
  if (s === "chemistry") return "chemistry";
  if (s === "mathematics" || s === "math") return "math";
  return null;
}

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

function isParenDigitAfterDerivative(html: string, parenIdx: number): boolean {
  if (parenIdx <= 0) return false;
  const prev = html[parenIdx - 1]!;
  return prev === "'" || prev === "\u2032" || prev === "\u2019";
}

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

function extractImageOnlyMcq(rawHtml: string): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html.includes("<img")) return null;
  const markerRe = /\(\s*([1-4]|[aA]|[A-Da-d])\s*\.?\s*\)/;
  if (markerRe.test(html)) return null;

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

export function extractStemAndOptions(
  rawHtml: string
): { stemHtml: string; options: string[] } | null {
  return (
    extractStemAndOptionsAbcd(rawHtml) ??
    extractStemOptionsAcDMissingBWithImg(rawHtml) ??
    extractStemAndOptions124(rawHtml) ??
    extractStemOptionsFirstFourMarkers(rawHtml) ??
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
  const c0 = ans.charAt(0);
  if (["A", "B", "C", "D"].includes(c0)) return c0 as "A" | "B" | "C" | "D";
  const lower0 = ansRaw.charAt(0).toLowerCase();
  if (["a", "b", "c", "d"].includes(lower0)) {
    return lower0.toUpperCase() as "A" | "B" | "C" | "D";
  }
  const fromAnswer = numericChoiceToLetter(str(q, "answer"));
  if (fromAnswer) return fromAnswer;
  const fromOpt =
    numericChoiceToLetter(str(q, "fk_optionId")) ?? numericChoiceToLetter(str(q, "optionId"));
  if (fromOpt) return fromOpt;
  return null;
}

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

export type PrepareQuestionsOptions = {
  /** When set (e.g. from folder name), overrides JSON subjectName when missing/wrong. */
  forcedSubject?: Subject;
  /** Default chapter label when JSON has no chapterName. */
  defaultChapter?: string;
  onSkip?: (reason: string, questionId: string) => void;
};

export type PrepareQuestionsResult = {
  batch: PreparedQuestionRow[];
  skipped: number;
  subjectsCovered: Subject[];
};

export function prepareQuestionsFromExamJson(
  questions: JsonQuestion[],
  opts: PrepareQuestionsOptions = {}
): PrepareQuestionsResult {
  type Prepared = PreparedQuestionRow & { _sortKey: number };
  const prepared: Prepared[] = [];
  const coveredSet = new Set<Subject>();
  let skipped = 0;

  for (const q of questions) {
    const qHtml = str(q, "questionText");
    if (!qHtml) {
      skipped++;
      opts.onSkip?.("empty_question_text", str(q, "questionId"));
      continue;
    }

    const subj = opts.forcedSubject ?? normalizeSubject(str(q, "subjectName"));
    if (!subj) {
      skipped++;
      opts.onSkip?.("bad_subject", str(q, "questionId"));
      continue;
    }
    coveredSet.add(subj);

    let questionHtml: string;
    let options: string[];
    let correctLetter: "A" | "B" | "C" | "D";

    if (isNumericalQuestion(q)) {
      const syn = buildNumericMcq(str(q, "answer"));
      if (!syn) {
        skipped++;
        opts.onSkip?.("numeric_not_parsed", str(q, "questionId"));
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
        skipped++;
        opts.onSkip?.("options_not_parsed", str(q, "questionId"));
        continue;
      }
      const letter = resolveMcqLetter(q);
      if (!letter) {
        skipped++;
        opts.onSkip?.("correct_not_resolved", str(q, "questionId"));
        continue;
      }
      questionHtml = parsed.stemHtml;
      options = parsed.options;
      correctLetter = letter;
    }

    const sortKey =
      parseInt(str(q, "set_question_number") || str(q, "questionNumber") || "0", 10) ||
      prepared.length + 999;

    const chapter = str(q, "chapterName") || opts.defaultChapter || null;

    prepared.push({
      _sortKey: sortKey,
      sort_order: 0,
      source_question_id: str(q, "questionId") || null,
      subject: subj,
      topic: str(q, "topicName") || null,
      chapter,
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

  const subjectOrder: Record<Subject, number> = { physics: 0, chemistry: 1, math: 2 };
  const subjectsCovered = Array.from(coveredSet).sort(
    (a, b) => (subjectOrder[a] ?? 9) - (subjectOrder[b] ?? 9)
  );

  return { batch, skipped, subjectsCovered };
}
