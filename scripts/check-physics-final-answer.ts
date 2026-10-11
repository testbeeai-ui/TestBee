/**
 * Read-only: what the FINAL ANSWER banner will show for one Physics row.
 * Run: npx tsx scripts/check-physics-final-answer.ts <slug> <q_no>
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { PYQ_QUESTION_SELECT, PYQ_PUBLISHABLE_STATUSES } from "@/lib/chapter-pyq/pyqQuestionRow";
import { mapPyqRowToChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";
import { parsePyqWorkedSolution } from "@/lib/chapter-pyq/pyqWorkedSolution";

dotenv.config({ path: ".env.local" });
dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const slug = process.argv[2] ?? "motion-in-a-straight-line";
const qNo = Number(process.argv[3] ?? "172");

async function main() {
  const { data } = await sb
    .from("pyq_questions")
    .select(PYQ_QUESTION_SELECT)
    .eq("chapters.catalog_slug", slug)
    .in("review_status", [...PYQ_PUBLISHABLE_STATUSES]);
  const row = (data ?? []).find((r: { q_no: number }) => Number(r.q_no) === qNo) as never;
  if (!row) {
    console.log("row not found");
    return;
  }
  const mapped = mapPyqRowToChapterPyqQuestion(row, slug);
  if (!mapped) {
    console.log("mapper dropped the row");
    return;
  }
  const sol = mapped.question.solution ?? "";
  console.log("answerFormat :", mapped.question.answerFormat);
  console.log("correctAnswer:", mapped.question.correctAnswer, "(0-based index)");
  console.log("solution ends:", JSON.stringify(sol.trimEnd().slice(-60)));
  const worked = parsePyqWorkedSolution(sol);
  console.log("\nFINAL ANSWER banner:");
  console.log("  note (left) :", JSON.stringify(worked?.answer_note ?? null));
  console.log("  chip (right):", JSON.stringify(worked?.answer_tex ?? null));
}

void main().catch((e: unknown) => {
  console.error("check failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});