/**
 * Read-only verification that the new Physics By_Chapter booklet rows map through
 * the student render path with solution + Tips + Formula's, and lists every row
 * the mapper's fill check drops with the reason.
 *
 * Run: npx tsx scripts/verify-physics-booklet-enrichment.ts
 * Makes no DB writes.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import {
  PYQ_QUESTION_SELECT,
  PYQ_PUBLISHABLE_STATUSES,
  isPyqPaperFilled,
  type PyqQuestionRow,
} from "@/lib/chapter-pyq/pyqQuestionRow";
import { mapPyqRowToChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials in environment.");
  process.exit(1);
}

const SLUGS = [
  "units-and-measurements",
  "motion-in-a-straight-line",
  "motion-in-a-plane",
];

function isBooklet(row: { source_bbox?: unknown }): boolean {
  const bbox = row.source_bbox as unknown;
  return (
    Array.isArray(bbox) &&
    bbox.length > 0 &&
    typeof bbox[0] === "string" &&
    (bbox[0] as string).startsWith("booklet:")
  );
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  let total = 0;
  let renderOk = 0;
  const dropped: Array<{ slug: string; id: string; format: string | null; body: string }> = [];

  for (const slug of SLUGS) {
    const { data, error } = await supabase
      .from("pyq_questions")
      .select(`${PYQ_QUESTION_SELECT},source_bbox`)
      .eq("chapters.catalog_slug", slug)
      .in("review_status", [...PYQ_PUBLISHABLE_STATUSES]);
    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<PyqQuestionRow & { source_bbox?: unknown }>;
    for (const row of rows.filter(isBooklet)) {
      total += 1;
      const filled = isPyqPaperFilled(row);
      const mapped = filled ? mapPyqRowToChapterPyqQuestion(row, slug) : null;
      const renders =
        mapped !== null &&
        Boolean(mapped.question.solutionHtml?.trim()) &&
        Boolean(mapped.question.coachTips?.trim()) &&
        Boolean(mapped.question.coachFormulas?.trim());
      if (renders) {
        renderOk += 1;
      } else {
        dropped.push({
          slug,
          id: row.id,
          format: row.format ?? null,
          body: (row.body ?? "").slice(0, 110).replace(/\n/g, " "),
        });
      }
    }
  }

  console.log(`booklet rows=${total} render_ok=${renderOk} dropped=${dropped.length}`);
  for (const d of dropped) {
    console.log(`  DROPPED ${d.slug} id=${d.id} format=${d.format} body="${d.body}"`);
  }
  process.exit(dropped.length > 0 ? 1 : 0);
}

void main();
