/**
 * Read-only diagnostic — prints tips/formulas/solution coverage per chapter.
 * Run: npx tsx scripts/check-pyq-enrichment-coverage.ts
 * Makes no DB writes.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PAGE_SIZE = 1000;

function looksLikeValidJson(raw: string | null | undefined): boolean {
  const text = (raw ?? "").trim();
  if (!text) return false;
  if (!text.startsWith("{") && !text.startsWith("[")) return false;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed === null || typeof parsed !== "object") return false;
    const rec = parsed as Record<string, unknown>;
    // App parsers need tips[] or formulas[] non-empty to render a sheet.
    if (Array.isArray(parsed)) return parsed.length > 0;
    return Array.isArray(rec.tips) ? rec.tips.length > 0 : Array.isArray(rec.formulas) ? rec.formulas.length > 0 : false;
  } catch {
    return false;
  }
}

type Row = {
  id: string;
  chapter_slug: string | null;
  chapter_name: string | null;
  has_solution: boolean;
  has_tips: boolean;
  tips_ok: boolean;
  has_formulas: boolean;
  formulas_ok: boolean;
};

const rows: Row[] = [];

async function main() {
for (let page = 0; ; page++) {
  const from = page * PAGE_SIZE;
  const { data, error } = await supabase
    .from("pyq_questions")
    .select(
      "id, solution_md, tips_md, formulas_md, chapters:pyq_chapters(name, catalog_slug)"
    )
    .in("review_status", ["auto_ok", "human_ok"])
    .range(from, from + PAGE_SIZE - 1);
  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }
  const batch = (data ?? []) as unknown as Array<{
    id: string;
    solution_md: string | null;
    tips_md: string | null;
    formulas_md: string | null;
    chapters: { name: string; catalog_slug: string | null } | null;
  }>;
  for (const r of batch) {
    rows.push({
      id: r.id,
      chapter_slug: r.chapters?.catalog_slug ?? null,
      chapter_name: r.chapters?.name ?? null,
      has_solution: Boolean(r.solution_md?.trim()),
      has_tips: Boolean(r.tips_md?.trim()),
      tips_ok: looksLikeValidJson(r.tips_md),
      has_formulas: Boolean(r.formulas_md?.trim()),
      formulas_ok: looksLikeValidJson(r.formulas_md),
    });
  }
  if (batch.length < PAGE_SIZE) break;
}

type Agg = {
  name: string;
  total: number;
  solution: number;
  tips: number;
  formulas: number;
  tipsButInvalid: number;
  formulasButInvalid: number;
};

const byChapter = new Map<string, Agg>();
for (const r of rows) {
  const key = r.chapter_slug ?? "(no catalog slug)";
  let agg = byChapter.get(key);
  if (!agg) {
    agg = {
      name: r.chapter_name ?? key,
      total: 0,
      solution: 0,
      tips: 0,
      formulas: 0,
      tipsButInvalid: 0,
      formulasButInvalid: 0,
    };
    byChapter.set(key, agg);
  }
  agg.total += 1;
  if (r.has_solution) agg.solution += 1;
  if (r.has_tips) {
    if (r.tips_ok) agg.tips += 1;
    else agg.tipsButInvalid += 1;
  }
  if (r.has_formulas) {
    if (r.formulas_ok) agg.formulas += 1;
    else agg.formulasButInvalid += 1;
  }
}

const sorted = [...byChapter.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

console.log(`\nPublishable rows: ${rows.length}\n`);
console.log(
  "chapter".padEnd(42),
  "total".padStart(5),
  "sol%".padStart(6),
  "tips%".padStart(6),
  "frm%".padStart(6),
  "badTips".padStart(8),
  "badFrm".padStart(7)
);
let incomplete = 0;
for (const [slug, a] of sorted) {
  const sol = Math.round((a.solution / a.total) * 100);
  const tips = Math.round((a.tips / a.total) * 100);
  const frm = Math.round((a.formulas / a.total) * 100);
  const ok = sol === 100 && tips === 100 && frm === 100;
  if (!ok) incomplete += 1;
  console.log(
    `${slug.padEnd(42)}${String(a.total).padStart(5)}${String(sol).padStart(5)}%${String(tips).padStart(5)}%${String(frm).padStart(5)}%${String(a.tipsButInvalid).padStart(8)}${String(a.formulasButInvalid).padStart(7)}${ok ? "" : "  <-- INCOMPLETE"}`
  );
}
console.log(`\nChapters fully covered: ${sorted.length - incomplete}/${sorted.length}`);
}

void main();
