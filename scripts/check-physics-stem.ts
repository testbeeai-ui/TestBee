/**
 * Read-only check of one Physics row's rendered stem + solution.
 * Run: npx tsx scripts/check-physics-stem.ts <slug> <q_no>
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { PYQ_QUESTION_SELECT, PYQ_PUBLISHABLE_STATUSES } from "@/lib/chapter-pyq/pyqQuestionRow";
import { mapPyqRowToChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";

dotenv.config({ path: ".env.local" });
dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const slug = process.argv[2] ?? "motion-in-a-straight-line";
const qNo = Number(process.argv[3] ?? "166");

async function main() {
  const { data } = await sb
    .from("pyq_questions")
    .select(PYQ_QUESTION_SELECT)
    .eq("chapters.catalog_slug", slug)
    .in("review_status", [...PYQ_PUBLISHABLE_STATUSES]);

  const row = (data ?? []).find((r: { q_no: number }) => Number(r.q_no) === qNo) as never;
  if (!row) {
    console.log("row not found");
    process.exit(1);
  }
  const mapped = mapPyqRowToChapterPyqQuestion(row, slug);
  if (!mapped) {
    console.log("mapper dropped the row");
    process.exit(1);
  }
  const stem = mapped.question.questionHtml ?? "";
  const sol = mapped.question.solutionHtml ?? "";

  console.log("stem length:", stem.length);
  console.log("stem has <img>:", stem.includes("<img"));
  console.log("stem has bare <p>:", /<p>/.test(stem));
  console.log("stem has escaped &lt;p&gt;:", stem.includes("&lt;p&gt;"));
  console.log("stem tail:", stem.slice(-160));

  console.log("\nsolution <img> count:", (sol.match(/<img/g) ?? []).length);
  console.log(
    "solution img files:",
    [...sol.matchAll(/src="([^"]+)"/g)].map((m) => m[1]!.split("/").pop())
  );
  console.log("solution length:", sol.length);
}

void main().catch((e: unknown) => {
  console.error("check failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});