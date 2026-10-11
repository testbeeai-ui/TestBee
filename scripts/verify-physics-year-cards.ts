/**
 * Read-only check that Physics chapters render year cards (2023-2026) like
 * Mathematics, never "Set 1 / Set 2 / Set 3", and that the card total matches
 * the sum of the year cards.
 *
 * Run: npx tsx scripts/verify-physics-year-cards.ts
 * Makes no DB writes.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { CHAPTER_PYQ_CHAPTERS } from "@/lib/chapter-pyq/catalog";
import { fetchPyqRowsForCatalogChapter } from "@/lib/chapter-pyq/fetchPyqQuestionsServer";
import { mapPyqRowsToChapterPyqQuestions } from "@/lib/chapter-pyq/pyqQuestionMap";
import { buildPyqSubjectPracticeSets, isPyqYearGroupedSubject } from "@/lib/chapter-pyq/pyqSets";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !KEY) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, KEY!);
  const physics = CHAPTER_PYQ_CHAPTERS.filter((c) => c.subject === "physics");
  let failures = 0;

  for (const entry of physics) {
    const rows = await fetchPyqRowsForCatalogChapter(supabase, entry.slug);
    const bundle = mapPyqRowsToChapterPyqQuestions(rows, entry.slug);
    const sets = buildPyqSubjectPracticeSets(bundle.questions, entry.subject);
    const labels = sets.map((s) => s.label);
    const total = sets.reduce((n, s) => n + s.items.length, 0);
    const badLabel = labels.find((l) => l.startsWith("Set "));
    const outOfRange = labels.filter((l) => l !== "Undated" && Number(l) < 2023);
    const undated = labels.includes("Undated");

    const problems: string[] = [];
    if (badLabel) problems.push(`even-split label "${badLabel}"`);
    if (outOfRange.length) problems.push(`year below 2023: ${outOfRange.join(",")}`);
    if (undated) problems.push("undated bucket present");
    if (total !== bundle.questions.length) {
      problems.push(`card total ${bundle.questions.length} != sum of year cards ${total}`);
    }
    if (!isPyqYearGroupedSubject(entry.subject)) problems.push("subject not year-grouped");

    if (problems.length) failures += 1;
    console.log(
      `${entry.slug}: ${bundle.questions.length} questions -> [${labels
        .map((l, i) => `${l}:${sets[i]?.items.length ?? 0}`)
        .join(", ")}]${problems.length ? "  << " + problems.join("; ") : ""}`
    );
  }

  if (failures > 0) {
    console.error(`\n${failures} physics chapter(s) not on year cards.`);
    process.exit(1);
  }
  console.log(`\nAll ${physics.length} Physics chapters use year cards for 2023-2026.`);
}

void main();