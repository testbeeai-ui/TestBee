/**
 * One-off / repeatable import: JEE Main shift CSV -> mock_papers + mock_questions.
 *
 * Requires: migrations for mock_papers + past_papers applied (PYQ rows go to past_papers).
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Default CSV: data/seeds/jee-main-2019-01-10-shift1.csv
 *   Override: CSV_PATH=/path/to/file.csv npx tsx scripts/import-jee-main-mock-csv.ts
 *
 * Idempotent: deletes existing rows for SLUG then re-inserts.
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const SLUG = "jee-main-2019-01-10-shift-1";

const DEFAULT_CSV = path.join(process.cwd(), "data", "seeds", "jee-main-2019-01-10-shift1.csv");

type CsvRow = Record<string, string>;

const OPT_RE = /<p><strong>\(\s*([A-Da-d])\s*\)\s*([\s\S]*?)<\/strong><\/p>/gi;

function extractStemAndOptions(html: string): { stemHtml: string; options: string[] } | null {
  const matches: { letter: string; body: string; index: number }[] = [];
  OPT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPT_RE.exec(html)) !== null) {
    const letter = m[1]!.toUpperCase();
    const body = m[2]!.trim();
    matches.push({ letter, body, index: m.index });
  }
  if (matches.length < 4) return null;
  const byLetter = new Map<string, string>();
  for (const x of matches) {
    if (!byLetter.has(x.letter)) byLetter.set(x.letter, x.body);
  }
  const ordered = ["A", "B", "C", "D"].map((L) => byLetter.get(L));
  if (ordered.some((o) => o == null)) return null;
  const firstIdx = Math.min(...matches.map((x) => x.index));
  const stemHtml = html.slice(0, firstIdx).trim();
  return { stemHtml, options: ordered as string[] };
}

function normalizeSubject(raw: string): "physics" | "chemistry" | "math" | null {
  const s = raw.trim().toLowerCase();
  if (s === "physics") return "physics";
  if (s === "chemistry") return "chemistry";
  if (s === "mathematics" || s === "math") return "math";
  if (s === "biology") return null;
  return null;
}

function letterToIndex(letter: string): number {
  const L = letter.trim().toUpperCase();
  const i = L.charCodeAt(0) - 65;
  return i >= 0 && i <= 3 ? i : 0;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const csvPath = process.env.CSV_PATH ?? DEFAULT_CSV;
  if (!fs.existsSync(csvPath)) {
    console.error("CSV not found:", csvPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as CsvRow[];

  const supabase = createClient(url, key);

  const { data: existingMock } = await supabase
    .from("mock_papers")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (existingMock?.id) {
    const { error: delErr } = await supabase.from("mock_papers").delete().eq("slug", SLUG);
    if (delErr) {
      console.error("Delete existing mock paper:", delErr);
      process.exit(1);
    }
    console.log("Removed existing mock paper", SLUG);
  }

  const { data: existingPast } = await supabase
    .from("past_papers")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (existingPast?.id) {
    const { error: delPastErr } = await supabase.from("past_papers").delete().eq("slug", SLUG);
    if (delPastErr) {
      console.error("Delete existing past paper:", delPastErr);
      process.exit(1);
    }
    console.log("Removed existing past paper", SLUG);
  }

  const first = rows[0];
  if (!first) {
    console.error("No rows in CSV");
    process.exit(1);
  }

  const examName = first.examName?.trim() || "JEE Main";
  const examSetName = first.examSetName?.trim() || "Shift";
  const title = `${examName} — ${examSetName}`;

  type Prepared = Record<string, unknown> & { _sortKey: number };
  const prepared: Prepared[] = [];
  const coveredSet = new Set<"physics" | "chemistry" | "math">();
  let skipped = 0;

  for (const row of rows) {
    const qHtml = row.questionText?.trim();
    if (!qHtml) {
      skipped++;
      continue;
    }
    const parsed = extractStemAndOptions(qHtml);
    if (!parsed) {
      console.warn("Skip questionId", row.questionId, "(could not parse 4 options)");
      skipped++;
      continue;
    }

    const subj = normalizeSubject(row.subjectName || "");
    if (!subj) {
      console.warn("Skip questionId", row.questionId, "unknown subject", row.subjectName);
      skipped++;
      continue;
    }
    coveredSet.add(subj);

    const ans = (row.answer || "A").trim().toUpperCase().charAt(0);
    if (!["A", "B", "C", "D"].includes(ans)) {
      skipped++;
      continue;
    }

    const sortKey =
      parseInt(row.set_question_number || row.questionNumber || "0", 10) || prepared.length + 999;

    prepared.push({
      _sortKey: sortKey,
      sort_order: 0,
      source_question_id: row.questionId ?? null,
      subject: subj,
      topic: row.topicName?.trim() || null,
      chapter: row.chapterName?.trim() || null,
      difficulty: (row.dificulty || row.difficulty || "").trim() || null,
      question_html: parsed.stemHtml,
      solution_html: row.solutionText?.trim() || null,
      correct_letter: ans,
      options_json: parsed.options,
    });
  }

  prepared.sort((a, b) => a._sortKey - b._sortKey);
  const batch = prepared.map((r, idx) => {
    const { _sortKey, ...rest } = r;
    return { ...rest, sort_order: idx + 1 };
  });

  const subjectOrder: Record<string, number> = { physics: 0, chemistry: 1, math: 2 };
  const subjectsCovered = Array.from(coveredSet).sort(
    (a, b) => (subjectOrder[a] ?? 9) - (subjectOrder[b] ?? 9)
  );

  const { data: paper, error: paperErr } = await supabase
    .from("past_papers")
    .insert({
      slug: SLUG,
      title,
      exam_name: examName,
      exam_set_name: examSetName,
      paper_type: "pyq",
      duration_minutes: 180,
      total_marks: batch.length * 4,
      question_count: batch.length,
      marking_scheme:
        "+4 for each correct response, −1 for each incorrect response, 0 if unattempted (JEE Main pattern).",
      /* 11 so class-11 and class-12 learners both pass mock page filter (paper.classLevel <= userLevel). */
      class_level: 11,
      tags: ["JEE Main", "2019", "January", "PYQ", "Shift 1"],
      subjects_covered: subjectsCovered,
      published: true,
    })
    .select("id")
    .single();

  if (paperErr || !paper) {
    console.error("Insert past_papers:", paperErr);
    process.exit(1);
  }

  const paperId = paper.id as string;

  const CHUNK = 80;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const slice = batch.slice(i, i + CHUNK).map((row) => ({ ...row, paper_id: paperId }));
    const { error } = await supabase.from("past_paper_questions").insert(slice);
    if (error) {
      console.error("Insert past_paper_questions chunk", i, error);
      process.exit(1);
    }
  }

  console.log(
    "Imported paper",
    SLUG,
    "paper_id=",
    paperId,
    "questions=",
    batch.length,
    "skipped=",
    skipped
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
