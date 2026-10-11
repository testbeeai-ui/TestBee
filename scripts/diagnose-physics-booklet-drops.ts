/**
 * Read-only diagnosis: which isPyqPaperFilled check drops each booklet row.
 * Run: npx tsx scripts/diagnose-physics-booklet-drops.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import {
  PYQ_QUESTION_SELECT,
  PYQ_PUBLISHABLE_STATUSES,
  isPyqPaperFilled,
  type PyqQuestionRow,
} from "@/lib/chapter-pyq/pyqQuestionRow";
import { cleanPyqOcrText, isPyqSolverDumpBody, pyqStudentTextIsSafe } from "@/lib/chapter-pyq/pyqOcrHtml";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SLUGS = ["units-and-measurements", "motion-in-a-straight-line", "motion-in-a-plane"];

function isBooklet(row: { source_bbox?: unknown }): boolean {
  const bbox = row.source_bbox as unknown;
  return (
    Array.isArray(bbox) &&
    bbox.length > 0 &&
    typeof bbox[0] === "string" &&
    (bbox[0] as string).startsWith("booklet:")
  );
}

function diagnose(row: PyqQuestionRow): string {
  const raw = (row.body ?? "").trim();
  if (!raw || raw.startsWith("(OCR missed")) return "empty-body";
  if (isPyqSolverDumpBody(raw)) return "solver-dump-raw";
  const body = cleanPyqOcrText(raw);
  if (!body.trim()) return "cleaned-empty";
  if (isPyqSolverDumpBody(body)) return "solver-dump-cleaned";
  if (!pyqStudentTextIsSafe(body)) return "student-text-unsafe";
  if (/\$[A-Za-z](?:_\{[^}]+\})?\s*=\s*\{[A-Za-z$]/.test(body)) return "truncated-set-builder";
  if (/\{[A-Za-z]\$$/.test(body)) return "brace-tail";
  if (/(?:\\sqrt|√)\s*$/.test(body)) return "sqrt-tail";
  const prose = body.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " M ").replace(/\s+/g, " ").trim();
  if (
    /:\s*$/.test(prose) &&
    !/\b(is|are|equal|equals|then|which|find|follows|has|represents|below|equation|intersect|lies|on|line|curve|belongs?|to|satisfies|in|if|only)\b|\bM\s*:\s*$/i.test(
      prose.slice(-40)
    )
  ) {
    return "colon-tail";
  }
  if (
    prose.length < 80 &&
    /,\s*[^,]{0,12}$/.test(prose) &&
    !/(?:\b(?:then|equals?|equal to|is|are|has|represents)|\bM)\s*(?:::-?|[—–-]+|_+|[.,:])*\s*$/i.test(prose)
  ) {
    return "comma-tail";
  }
  if (body.length < 50 && /[₀-₉ⁿ¹-⁹]/.test(body) && !body.includes("$")) return "short-unicode";
  if (row.format === "numerical") return row.numerical_answer?.trim() ? "OK" : "no-numeric-answer";
  if (row.format === "mcq") {
    const texts = [...(row.question_options ?? [])]
      .sort((a, b) => a.option_index - b.option_index)
      .slice(0, 4)
      .map((o) => cleanPyqOcrText(o.body ?? "").trim());
    if (texts.length < 4 || texts.some((t) => !t)) return `options-missing(${texts.length})`;
    if (texts.some((t) => !pyqStudentTextIsSafe(t))) return "option-unsafe";
    if (texts.some((t) => /\b(Inequalities|MUST DO|CONCEPT BUILDER|ADVANCED)\b/i.test(t) && t.length < 48))
      return "option-heading";
    return "OK";
  }
  return `format-${row.format}`;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const counts = new Map<string, number>();
  for (const slug of SLUGS) {
    const { data, error } = await supabase
      .from("pyq_questions")
      .select(`${PYQ_QUESTION_SELECT},source_bbox`)
      .eq("chapters.catalog_slug", slug)
      .in("review_status", [...PYQ_PUBLISHABLE_STATUSES]);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<PyqQuestionRow & { source_bbox?: unknown }>;
    for (const row of rows.filter(isBooklet)) {
      if (isPyqPaperFilled(row)) continue;
      const reason = diagnose(row);
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
      console.log(`${slug} q=${row.q_no} id=${row.id} reason=${reason} body="${(row.body ?? "").slice(0, 80).replace(/\n/g, " ")}"`);
    }
  }
  console.log("\nReason counts:", Object.fromEntries(counts));
}

void main();
