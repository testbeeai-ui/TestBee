/**
 * Read-only verification that Physics rows carry PRINTED (paper-OCR) solutions,
 * not glm-generated sheets. Used to check the "follow the paper" runs.
 *
 * Run: npx tsx scripts/verify-physics-paper-solutions.ts [chapter-slug ...]
 * Makes no DB writes.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { subjectForCatalogSlug } from "@/lib/chapter-pyq/catalog";
import { PYQ_QUESTION_SELECT, PYQ_PUBLISHABLE_STATUSES, type PyqQuestionRow } from "@/lib/chapter-pyq/pyqQuestionRow";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !KEY) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const PAPER_MARKER = "<!-- paper-ocr -->";
const DEFAULT_SLUGS = ["units-and-measurements", "motion-in-a-straight-line"];

/**
 * Page furniture that must never reach a student. MathonGo prints these in the
 * footer/header of every page, so a sloppy crop or an un-stripped OCR line drags
 * them into `solution_md`.
 */
const WATERMARK_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "MathonGo", re: /mathongo/i },
  { label: "#MathBoleTohMathonGo", re: /mathboletomathongo/i },
  { label: "MARKS app", re: /\bmarks\s*app\b/i },
  { label: "chapter-wise Qs Bank", re: /chapter-?wise\s+qs\s+bank/i },
  { label: "chapter-wise Question Bank", re: /chapter-?wise\s+question\s+bank/i },
  { label: "JEE Main <year> <month>", re: /jee\s+main\s+20\d\d\s+(january|april|jan|apr)/i },
  { label: "space for your notes", re: /space\s+for\s+your\s+notes/i },
  { label: "questions with solutions", re: /questions\s+with\s+solutions/i },
  { label: "questions with answer keys", re: /questions\s+with\s+answer\s+keys/i },
  { label: "answers and solutions heading", re: /^\s*answers\s+and\s+solutions\s*$/im },
  { label: "answer key heading", re: /^\s*answer\s+key\s*$/im },
  { label: "as per official NTA key", re: /as\s+per\s+official\s+nta\s+key/i },
  { label: "download the MARKS app", re: /download\s+the\s+marks\s+app/i },
  { label: "practice these PYQs", re: /practice\s+these\s+pyqs/i },
  { label: "click here", re: /click\s+here/i },
];

function watermarksIn(text: string): string[] {
  return WATERMARK_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
}

const FIG_TOKEN = /\[\[fig:([^\]]+)\]\]/g;

function unresolvedTokens(text: string, known: Set<string>): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(FIG_TOKEN)) {
    const key = m[1]!.trim();
    if (!known.has(key)) out.push(key);
  }
  return out;
}

type Row = PyqQuestionRow & {
  source_bbox?: unknown;
  figure_links?: Array<{ figures?: { figure_key?: string; px_width?: number | null } | null }>;
};

/** A page-clip render is far wider than the PDF's native embedded image. */
const PAGE_CLIP_MIN_WIDTH = 500;

function sourceOf(row: Row): string {
  const b = row.source_bbox;
  if (Array.isArray(b) && b.length > 0 && typeof b[0] === "string") {
    return (b[0] as string).split(":")[0];
  }
  return "legacy";
}

function isPaper(row: Row): boolean {
  return (row.solution_md ?? "").trimStart().startsWith(PAPER_MARKER);
}

async function main() {
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const targets = slugs.length > 0 ? slugs : DEFAULT_SLUGS;
  const supabase = createClient(SUPABASE_URL!, KEY!);

  let paper = 0;
  let nonPaper = 0;
  let missing = 0;
  const watermarked: Array<{ slug: string; qNo: number; labels: string[] }> = [];
  const unpartitioned: Array<{ slug: string; qNo: number }> = [];
  const brokenTokens: Array<{ slug: string; qNo: number; token: string }> = [];
  const pageClips: Array<{ slug: string; qNo: number; key: string; width: number }> = [];

  const { data: figRows, error: figError } = await supabase
    .from("pyq_figures")
    .select("figure_key,px_width");
  if (figError) throw figError;
  const allFigureKeys = new Set((figRows ?? []).map((f) => f.figure_key as string));
  const figureWidth = new Map(
    (figRows ?? []).map((f) => [f.figure_key as string, (f.px_width as number | null) ?? 0])
  );

  for (const slug of targets) {
    const subject = subjectForCatalogSlug(slug);
    if (subject !== "physics") {
      console.log(`${slug}: not a physics catalog slug — skipped`);
      continue;
    }
    const { data, error } = await supabase
      .from("pyq_questions")
      .select(`${PYQ_QUESTION_SELECT},source_bbox`)
      .eq("chapters.catalog_slug", slug)
      .in("review_status", [...PYQ_PUBLISHABLE_STATUSES]);
    if (error) throw error;

    const rows = (data ?? []) as unknown as Row[];
    const bySource = new Map<string, { paper: number; other: number; none: number }>();
    for (const row of rows) {
      const src = sourceOf(row);
      const bucket = bySource.get(src) ?? { paper: 0, other: 0, none: 0 };
      const sol = (row.solution_md ?? "").trim();
      if (!sol) {
        bucket.none += 1;
        missing += 1;
      } else if (isPaper(row)) {
        bucket.paper += 1;
        paper += 1;
        const labels = watermarksIn(sol);
        if (labels.length > 0) {
          watermarked.push({ slug, qNo: Number(row.q_no), labels });
        }
        if (!sol.includes("## Step")) {
          unpartitioned.push({ slug, qNo: Number(row.q_no) });
        }
        for (const t of unresolvedTokens(sol, allFigureKeys)) {
          brokenTokens.push({ slug, qNo: Number(row.q_no), token: t });
        }
        for (const link of row.figure_links ?? []) {
          const key = link.figures?.figure_key ?? "";
          const w = figureWidth.get(key) ?? 0;
          if (w >= PAGE_CLIP_MIN_WIDTH) {
            pageClips.push({ slug, qNo: Number(row.q_no), key: key || "?", width: w });
          }
        }
      } else {
        bucket.other += 1;
        nonPaper += 1;
      }
      bySource.set(src, bucket);
    }

    const parts = [...bySource.entries()]
      .sort()
      .map(([src, b]) => `${src}: paper=${b.paper} non-paper=${b.other} none=${b.none}`);
    console.log(`${slug}: ${rows.length} live rows | ${parts.join(" | ")}`);
  }

  console.log(`\nTOTAL paper-ocr=${paper}  non-paper=${nonPaper}  missing=${missing}`);
  console.log(`unpartitioned (no "## Step"): ${unpartitioned.length}`);
  for (const u of unpartitioned.slice(0, 12)) console.log(`  NO-STEPS ${u.slug} q${u.qNo}`);
  console.log(`broken figure tokens: ${brokenTokens.length}`);
  for (const b of brokenTokens.slice(0, 12)) console.log(`  BROKEN ${b.slug} q${b.qNo}: ${b.token}`);
  console.log(`page-clip candidates (>=${PAGE_CLIP_MIN_WIDTH}px): ${pageClips.length}  [informational]`);
  for (const p of pageClips.slice(0, 12)) {
    console.log(`  WIDE ${p.slug} q${p.qNo}: ${p.key} (${p.width}px)`);
  }
  console.log(`watermark leaks in solution text: ${watermarked.length}`);
  for (const w of watermarked.slice(0, 12)) {
    console.log(`  LEAK ${w.slug} q${w.qNo}: ${w.labels.join(", ")}`);
  }
  if (nonPaper > 0) {
    console.error(`${nonPaper} row(s) carry a NON-paper solution — those are glm-generated.`);
    process.exit(1);
  }
  if (watermarked.length > 0) {
    console.error(`${watermarked.length} row(s) leak a printed watermark/footer into the solution.`);
    process.exit(1);
  }
  if (brokenTokens.length > 0) {
    console.error(`${brokenTokens.length} broken figure token(s) — students would see a broken image.`);
    process.exit(1);
  }
  if (pageClips.length > 0) {
    console.log(
      `${pageClips.length} wide figure(s). Width is NOT evidence of a watermark — ` +
        `run check_figure_watermarks.py (pixel test) for the authoritative answer.`
    );
  }
  if (unpartitioned.length > 0) {
    console.error(`${unpartitioned.length} row(s) are not partitioned into step cards.`);
    process.exit(1);
  }
  console.log("All present solutions are printed, partitioned, watermark-free and resolve every figure.");
}

void main().catch((err: unknown) => {
  const e = err as { message?: string; details?: string; hint?: string; code?: string };
  console.error("verify failed:", e?.message ?? String(err));
  if (e?.details) console.error("  details:", e.details);
  if (e?.hint) console.error("  hint:", e.hint);
  if (e?.code) console.error("  code:", e.code);
  process.exit(1);
});