/**
 * One-off read-only verification that the regenerated Chapter PYQ enrichment
 * rows still map through the student render path.
 *
 * Run: npx tsx scripts/verify-enriched-pyq-chapters.ts <catalogSlug>
 * Makes no DB writes.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fetchPyqRowsForCatalogChapter } from "@/lib/chapter-pyq/fetchPyqQuestionsServer";
import { mapPyqRowsToChapterPyqQuestions } from "@/lib/chapter-pyq/pyqQuestionMap";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials in environment.");
  process.exit(1);
}

const slugs = process.argv.slice(2);
if (slugs.length === 0) {
  console.error("Pass one or more catalog slugs, e.g. trigonometric-ratios-and-identities");
  process.exit(1);
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  let broken = 0;

  for (const slug of slugs) {
    const rows = await fetchPyqRowsForCatalogChapter(supabase, slug);
    const bundle = mapPyqRowsToChapterPyqQuestions(rows, slug);
    const questions = bundle.questions;
    const withSolution = questions.filter((q) => q.question.solutionHtml?.trim()).length;
    const withTips = questions.filter((q) => q.question.coachTips?.trim()).length;
    const withFormulas = questions.filter((q) => q.question.coachFormulas?.trim()).length;
    const rawSolutions = questions.filter((q) =>
      q.question.solution?.trim()?.startsWith("{")
    ).length;

    const samples = questions.slice(0, 3).map((q) => ({
      qNo: q.qNo,
      solutionHtmlChars: q.question.solutionHtml?.length ?? 0,
      tipChars: q.question.coachTips?.length ?? 0,
      formulaChars: q.question.coachFormulas?.length ?? 0,
    }));

    if (withSolution !== questions.length) {
      broken += questions.length - withSolution;
      console.log(
        `${slug}: ${questions.length} questions, ${withSolution} with rendered solution (BROKEN)`
      );
    } else {
      console.log(
        `${slug}: ${questions.length} questions | solution ${withSolution} | tips ${withTips} | formulas ${withFormulas} | raw json solutions ${rawSolutions}`
      );
    }
    console.log("  samples:", JSON.stringify(samples));
  }

  if (broken > 0) {
    console.error(`\n${broken} question(s) failed to render a solution.`);
    process.exit(1);
  }
  console.log("\nAll checked questions render a solution through the student mapper.");
}

void main();
