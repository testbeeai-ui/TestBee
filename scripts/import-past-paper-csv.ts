/**
 * Import one Past Paper CSV into past_papers + past_paper_questions.
 *
 * Usage:
 *   CSV_PATH="C:/path/to/file.csv" npx tsx --env-file-if-exists=.env scripts/import-past-paper-csv.ts
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

type CsvRow = Record<string, string>;
type Subject = "physics" | "chemistry" | "math";

function normalizeSubject(raw: string): Subject | null {
  const s = raw.trim().toLowerCase();
  if (s === "physics") return "physics";
  if (s === "chemistry") return "chemistry";
  if (s === "mathematics" || s === "math") return "math";
  return null;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Robust option extractor:
 * finds (A)/(B)/(C)/(D) markers and slices HTML regions between them.
 * Keeps HTML untouched so image tags and formatting remain intact.
 */
function extractStemAndOptions(rawHtml: string): { stemHtml: string; options: string[] } | null {
  const html = rawHtml.trim();
  if (!html) return null;

  const markerRe = /\(\s*([A-Da-d])\s*\)/g;
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
    const mm = /\(\s*[A-Da-d]\s*\)/g;
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

function fallbackOptionsFromCsv(raw: string): string[] | null {
  const tokens = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (tokens.length < 4) return null;
  const four = tokens.slice(0, 4);
  // Keep exact text if present; otherwise normalize bare A/B/C/D into readable placeholders.
  return four.map((t, i) => (/^[A-D]$/i.test(t) ? `Option ${String.fromCharCode(65 + i)}` : t));
}

function numericOptionToLetter(raw: string | undefined): "A" | "B" | "C" | "D" | null {
  const n = Number((raw ?? "").trim());
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 4) return null;
  return (["A", "B", "C", "D"] as const)[n - 1] ?? null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const csvPath = process.env.CSV_PATH;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!csvPath) {
    throw new Error("Missing CSV_PATH");
  }
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as CsvRow[];

  if (rows.length === 0) throw new Error("No rows in CSV");

  const first = rows[0]!;
  const examName = (first.examName ?? "").trim() || "JEE Main";
  const examSetName = (first.examSetName ?? "").trim() || "Shift";
  const title = `${examName} — ${examSetName}`;
  const slug = slugify(`${examName}-${examSetName}`);

  const supabase = createClient(url, key);

  // Remove any previous broken/current copy by slug or exact title.
  const { data: existingRows, error: existingErr } = await supabase
    .from("past_papers")
    .select("id, slug, title")
    .or(`slug.eq.${slug},title.eq.${title}`);
  if (existingErr) throw existingErr;
  for (const row of existingRows ?? []) {
    const { error: delErr } = await supabase.from("past_papers").delete().eq("id", row.id);
    if (delErr) throw delErr;
  }

  const prepared: Array<Record<string, unknown> & { _sortKey: number }> = [];
  const coveredSet = new Set<Subject>();
  let skipped = 0;

  for (const row of rows) {
    const qHtml = (row.questionText ?? "").trim();
    if (!qHtml) {
      skipped++;
      continue;
    }

    const parsed = extractStemAndOptions(qHtml);
    const fallbackOptions = fallbackOptionsFromCsv(row.options ?? "");
    const questionStem = parsed?.stemHtml ?? qHtml;
    const questionOptions = parsed?.options ?? fallbackOptions;
    if (!questionOptions || questionOptions.length < 4) {
      console.warn("Skip questionId", row.questionId, "(options unavailable)");
      skipped++;
      continue;
    }

    const subj = normalizeSubject(row.subjectName || "");
    if (!subj) {
      skipped++;
      continue;
    }
    coveredSet.add(subj);

    let ans = (row.answer || "").trim().toUpperCase().charAt(0);
    if (!["A", "B", "C", "D"].includes(ans)) {
      const byOptionId =
        numericOptionToLetter(row.optionId) ?? numericOptionToLetter(row.fk_optionId);
      const byWrongAns = numericOptionToLetter(row.wrongAns);
      const byLiteralWrongAns = (row.wrongAns || "").trim().toUpperCase().charAt(0);
      if (byOptionId) ans = byOptionId;
      else if (byWrongAns) ans = byWrongAns;
      else if (["A", "B", "C", "D"].includes(byLiteralWrongAns)) ans = byLiteralWrongAns;
      else {
        ans = "A";
        console.warn("Fallback answer=A for questionId", row.questionId);
      }
    }

    const sortKey =
      parseInt(row.set_question_number || row.questionNumber || "0", 10) || prepared.length + 999;

    prepared.push({
      _sortKey: sortKey,
      sort_order: 0,
      source_question_id: row.questionId ?? null,
      subject: subj,
      topic: (row.topicName ?? "").trim() || null,
      chapter: (row.chapterName ?? "").trim() || null,
      difficulty: (row.dificulty || row.difficulty || "").trim() || null,
      question_html: questionStem,
      solution_html: (row.solutionText ?? "").trim() || null,
      correct_letter: ans,
      options_json: questionOptions.slice(0, 4),
    });
  }

  prepared.sort((a, b) => a._sortKey - b._sortKey);
  const batch = prepared.map((r, idx) => {
    const { _sortKey, ...rest } = r;
    return { ...rest, sort_order: idx + 1 };
  });

  if (batch.length === 0) {
    throw new Error("No valid questions parsed from CSV");
  }

  const subjectOrder: Record<Subject, number> = { physics: 0, chemistry: 1, math: 2 };
  const subjectsCovered = Array.from(coveredSet).sort(
    (a, b) => (subjectOrder[a] ?? 9) - (subjectOrder[b] ?? 9)
  );

  const { data: paper, error: paperErr } = await supabase
    .from("past_papers")
    .insert({
      slug,
      title,
      exam_name: examName,
      exam_set_name: examSetName,
      paper_type: "pyq",
      duration_minutes: 180,
      total_marks: batch.length * 4,
      question_count: batch.length,
      marking_scheme:
        "+4 for each correct response, −1 for each incorrect response, 0 if unattempted (JEE Main pattern).",
      class_level: 11,
      tags: ["JEE Main", "2019", "January", "PYQ", "Shift 1"],
      subjects_covered: subjectsCovered,
      published: true,
    })
    .select("id")
    .single();

  if (paperErr || !paper) throw paperErr ?? new Error("Could not insert paper");
  const paperId = paper.id as string;

  const CHUNK = 80;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const slice = batch.slice(i, i + CHUNK).map((row) => ({ ...row, paper_id: paperId }));
    const { error } = await supabase.from("past_paper_questions").insert(slice);
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
