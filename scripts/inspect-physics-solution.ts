/**
 * Read-only: render one Physics solution through the student mapper and print
 * the HTML a student would see. Diagnoses "solutions look wrong" reports.
 *
 * Run: npx tsx scripts/inspect-physics-solution.ts <chapter-slug> <q_no>
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { PYQ_QUESTION_SELECT, PYQ_PUBLISHABLE_STATUSES, type PyqQuestionRow } from "@/lib/chapter-pyq/pyqQuestionRow";
import { mapPyqRowToChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !KEY) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

async function main() {
  const slug = process.argv[2] ?? "units-and-measurements";
  const qNo = Number(process.argv[3] ?? "1");
  const supabase = createClient(SUPABASE_URL!, KEY!);

  const { data, error } = await supabase
    .from("pyq_questions")
    .select(PYQ_QUESTION_SELECT)
    .eq("chapters.catalog_slug", slug)
    .in("review_status", [...PYQ_PUBLISHABLE_STATUSES]);
  if (error) throw error;

  const rows = (data ?? []) as unknown as PyqQuestionRow[];
  const row = rows.find((r) => Number(r.q_no) === qNo);
  if (!row) {
    console.log(`no q_no ${qNo} on ${slug} (found ${rows.length} rows; q_nos ${rows.slice(0, 12).map((r) => r.q_no).join(",")}...)`);
    return;
  }

  const mapped = mapPyqRowToChapterPyqQuestion(row, slug);
  if (!mapped) {
    console.log("mapper returned null (row filtered as unfilled)");
    return;
  }
  const q = mapped.question;
  console.log(`=== ${slug} q${qNo} ===`);
  console.log("questionHtml  :", (q.questionHtml ?? "").slice(0, 200));
  console.log("plain question:", (q.question ?? "").slice(0, 160));
  console.log("options       :", (q.options ?? []).length);
  console.log("answer        :", q.correctAnswer, "| format:", q.answerFormat);
  console.log("\nsolutionHtml length:", (q.solutionHtml ?? "").length);
  console.log("solutionHtml head:\n", (q.solutionHtml ?? "").slice(0, 1200));
  console.log("\ncoachTips length:", (q.coachTips ?? "").length);
  console.log("coachFormulas length:", (q.coachFormulas ?? "").length);
}

void main();