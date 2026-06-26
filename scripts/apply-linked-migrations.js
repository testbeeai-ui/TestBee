/**
 * Apply one or more migration SQL files to the linked Supabase project and
 * record them in schema_migrations (does not use db push).
 *
 * Usage:
 *   node scripts/apply-linked-migrations.js 20260811120000_student_engagement_bits_tables.sql
 *   node scripts/apply-linked-migrations.js --phase2
 *
 * Requires: npx supabase linked to main project (bytsiknhtcnlxwzgqkrd).
 */
const { execSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

const PHASE2 = [
  "20260811120000_student_engagement_bits_tables.sql",
  "20260811120100_user_saved_items_review_at.sql",
];

function run(cmd) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, env: process.env });
}

function applyFile(filename) {
  const full = path.join(MIGRATIONS_DIR, path.basename(filename));
  const m = path.basename(full).match(/^(\d{14})_/);
  if (!m) {
    throw new Error(`Expected YYYYMMDDHHMMSS_name.sql, got: ${filename}`);
  }
  const version = m[1];
  run(`npx supabase db query --linked --yes -f "${full.replace(/\\/g, "/")}"`);
  run(`npx supabase migration repair --status applied ${version}`);
  console.log(`Done: ${path.basename(full)} (${version})`);
}

const args = process.argv.slice(2);
const files = args[0] === "--phase2" ? PHASE2 : args;

if (files.length === 0) {
  console.error("Pass migration filenames or --phase2");
  process.exit(1);
}

for (const f of files) {
  applyFile(f);
}
