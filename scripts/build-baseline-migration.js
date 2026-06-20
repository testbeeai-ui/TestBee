/**
 * Build squashed baseline migration from scratch/baseline-schema-raw.sql
 * (generated via: npx supabase db dump --linked --schema public,storage -f scratch/baseline-schema-raw.sql)
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const rawPath = path.join(root, "scratch", "baseline-schema-raw.sql");
const outPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260915120000_baseline_schema_from_prod.sql"
);

const header = `-- Squashed schema baseline (structure only — NO row data).
-- Generated from production snapshot bytsiknhtcnlxwzgqkrd on 2026-06-15.
--
-- PRODUCTION (bytsiknhtcnlxwzgqkrd): mark applied via migration repair ONLY.
--   Do NOT re-run this file on prod — data (lessons, mocks, past papers, curriculum) stays as-is.
--
-- Fresh local DB: creates empty tables; load reference/content via existing import scripts
--   (curriculum seeds, CBSE MCQ import, past-paper JSON import, play packs, etc.).
--
-- Archived incremental history: scripts/legacy/migrations/pre-squash-2026/

`;

if (!fs.existsSync(rawPath)) {
  console.error("Missing", rawPath, "— run supabase db dump first.");
  process.exit(1);
}

let body = fs.readFileSync(rawPath, "utf8");

// Drop pg_dump session noise that can fail in Supabase migration runner.
body = body
  .split("\n")
  .filter((line) => !line.match(/^\\restrict /) && !line.match(/^\\unrestrict /))
  .join("\n");

const required = [
  "curriculum_subtopics",
  "subtopic_content",
  "mock_papers",
  "mock_questions",
  "past_papers",
  "past_paper_questions",
  "cbse_mcq_chapters",
  "lessons_raw_posts",
];

for (const t of required) {
  if (!body.includes(`"${t}"`) && !body.includes(` ${t} `)) {
    console.error("Baseline missing table:", t);
    process.exit(1);
  }
}

fs.writeFileSync(outPath, header + body, "utf8");
console.log("Wrote", outPath, "bytes", fs.statSync(outPath).size);
