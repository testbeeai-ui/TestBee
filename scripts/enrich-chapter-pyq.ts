import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * CLI: npx tsx scripts/enrich-chapter-pyq.ts [--refill] [limit] [catalogSlug ...]
 *   limit default 100; no slugs = every chapter.
 *   --refill also re-runs rows whose stored fields match the structured-filler
 *   signatures (from earlier fallback runs) instead of only null fields.
 */
const argv = process.argv.slice(2);
const REFILL = argv.includes("--refill");
const args = argv.filter((a) => a !== "--refill");
const LIMIT = Number(args[0]) > 0 ? Number(args[0]) : 100;
const CHAPTER_SLUGS = args.slice(Number(args[0]) > 0 ? 1 : 0);

/** Signatures written by buildStructuredFallback — safe to overwrite in refill mode. */
const SOLUTION_FILLER_PREFIX = "## Step 1: Concept & Setup";
const TIPS_FILLER_BODY = "Analyze the given parameters";
const FORMULAS_FILLER_TEX = "Apply governing equations for";

function isTipsFiller(text: string): boolean {
  return text.includes(TIPS_FILLER_BODY);
}
function isFormulasFiller(text: string): boolean {
  return text.includes(FORMULAS_FILLER_TEX);
}
function isSolutionFiller(text: string): boolean {
  return text.startsWith(SOLUTION_FILLER_PREFIX);
}

function buildStructuredFallback(stem: string, chapterName: string, topicName: string) {
  const cleanStem = stem.replace(/<[^>]+>/g, "").slice(0, 120);
  return {
    solutionMd: `## Step 1: Concept & Setup\nIdentify the given parameters in: ${cleanStem}...\n\n## Step 2: Formula & Relations\nApply standard governing equations for **${topicName}** in ${chapterName}.\n\n## Step 3: Evaluation\nSubstitute the values and simplify to get the final answer.`,
    tipsMd: JSON.stringify({
      tips: [
        {
          title: `Approach for ${topicName}`,
          body: `Analyze the given parameters and identify the primary relations governing ${topicName}. Set up the equations carefully before calculating.`,
          callout: "",
        },
      ],
    }),
    formulasMd: JSON.stringify({
      formulas: [
        {
          name: `${topicName} Relation`,
          tex: `\\text{Apply governing equations for } ${topicName}`,
          note: "Use standard formulas for this topic.",
        },
      ],
    }),
  };
}

/**
 * Models emit raw newlines/tabs inside JSON string values (invalid JSON) and
 * single backslashes in LaTeX (\vec, \frac) which are also invalid JSON escapes.
 * Re-escape control characters and double illegal backslash escapes inside
 * strings; leave structural whitespace alone.
 */
function repairJsonControlChars(text: string): string {
  const LEGAL = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);
  const chars = [...text];
  let out = "";
  let inStr = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (!inStr) {
      if (ch === '"') inStr = true;
      out += ch;
      continue;
    }
    // Inside a string.
    if (ch === "\\") {
      const next = chars[i + 1] ?? "";
      if (LEGAL.has(next)) {
        out += ch + next;
        i++; // consume the escape char
      } else {
        out += "\\\\"; // illegal escape (e.g. \vec) → double the backslash
      }
      continue;
    }
    if (ch === '"') {
      inStr = false;
      out += ch;
      continue;
    }
    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\t") {
      out += "\\t";
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Close strings/brackets the model left open (truncated replies), so JSON.parse
 * can run. Best effort — only reached when the plain text will not parse.
 */
function closeOpenStructures(text: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const ch of text) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let out = text;
  if (inStr) out += '"';
  while (stack.length > 0) {
    const open = stack.pop();
    out += open === "{" ? "}" : "]";
  }
  return out;
}

/** Pull the outermost JSON object out of a possibly fenced/annotated reply. */
function extractJson(content: string): Record<string, unknown> | null {
  const stripped = content.replace(/```json|```/g, "").trim();
  const start = stripped.indexOf("{");
  if (start === -1) return null;
  const end = stripped.lastIndexOf("}");
  const candidates: string[] = [];
  if (end > start) {
    const slice = stripped.slice(start, end + 1);
    candidates.push(slice, repairJsonControlChars(slice));
  }
  // Truncated reply: take everything from the first brace and close what is open.
  const fromStart = repairJsonControlChars(stripped.slice(start)).replace(/,\s*([}\]])/g, "$1");
  candidates.push(closeOpenStructures(fromStart));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Coerce whatever the model produced into validated tip steps, or null. */
function tipStepsOf(raw: unknown): { title: string; body: string; callout: string }[] | null {
  let value = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const obj = trimmed.startsWith("{") ? null : extractJson(trimmed);
    if (obj) value = obj.tips ?? obj;
    else {
      try {
        value = JSON.parse(repairJsonControlChars(trimmed));
      } catch {
        return null;
      }
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    value = (value as Record<string, unknown>).tips ?? null;
  }
  if (!Array.isArray(value)) return null;
  const steps: { title: string; body: string; callout: string }[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const title = String(rec.title ?? "").trim();
    const body = String(rec.body ?? "").trim();
    if (!title || !body) continue;
    steps.push({ title, body, callout: String(rec.callout ?? "").trim() });
  }
  return steps.length > 0 ? steps : null;
}

/** Coerce whatever the model produced into validated formula cards, or null. */
function formulaListOf(
  raw: unknown
): { name: string; tex: string; note: string }[] | null {
  let value = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const obj = trimmed.startsWith("{") ? null : extractJson(trimmed);
    if (obj) value = obj.formulas ?? obj;
    else {
      try {
        value = JSON.parse(repairJsonControlChars(trimmed));
      } catch {
        return null;
      }
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    value = (value as Record<string, unknown>).formulas ?? null;
  }
  if (!Array.isArray(value)) return null;
  const items: { name: string; tex: string; note: string }[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = String(rec.name ?? "").trim();
    const tex = String(rec.tex ?? "").trim();
    if (!name || !tex) continue;
    items.push({ name, tex, note: String(rec.note ?? "").trim() });
  }
  return items.length > 0 ? items : null;
}

function validSolution(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  return text.length >= 40 ? text : null;
}

type EnrichResult = {
  solutionMd: string;
  tipsMd: string;
  formulasMd: string;
};

/** Flat schema: top-level arrays survive generation far better than double-encoded strings. */
const PROMPT = `You are a Senior JEE Subject Matter Expert.
Question: {STEM}

Return ONLY a raw JSON object (no markdown fences, no commentary):
{
  "solutionMd": "Step-by-step worked solution in markdown with KaTeX math ($...$ or $$...$$). Use ## headings for each step. End with the final answer.",
  "tips": [ { "title": "short approach title", "body": "how a topper would think through this question", "callout": "" } ],
  "formulas": [ { "name": "formula name", "tex": "KaTeX without $ delimiters", "note": "when to use it" } ]
}
Give 2-4 tips and 2-5 formulas actually used by this question.`;

async function callGemini(stem: string): Promise<EnrichResult | null> {
  if (!GEMINI_API_KEY) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT.replace("{STEM}", stem) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  const parsed = extractJson(text);
  if (!parsed) return null;
  const solution = validSolution(parsed.solutionMd);
  const tips = tipStepsOf(parsed.tips ?? parsed.tipsMd);
  const formulas = formulaListOf(parsed.formulas ?? parsed.formulasMd);
  if (!solution || !tips || !formulas) return null;
  return {
    solutionMd: solution,
    tipsMd: JSON.stringify({ tips }),
    formulasMd: JSON.stringify({ formulas }),
  };
}

async function callSarvam(stem: string): Promise<EnrichResult | null> {
  if (!SARVAM_API_KEY) return null;
  try {
    const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM_API_KEY,
        Authorization: `Bearer ${SARVAM_API_KEY}`,
      },
      body: JSON.stringify({
        // Reasoning model: without the system nudge it thinks past the token cap
        // and returns empty content with finish_reason "length".
        model: "sarvam-105b-conversations",
        messages: [
          {
            role: "system",
            content: "Answer directly. Do not think out loud. Output only the JSON object.",
          },
          { role: "user", content: PROMPT.replace("{STEM}", stem) },
        ],
        temperature: 0.2,
        max_tokens: 8192,
      }),
    });
    if (!res.ok) {
      console.error(`    [sarvam] HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      console.error("    [sarvam] empty content (likely reasoning overflow)");
      return null;
    }
    const parsed = extractJson(content);
    if (!parsed) {
      console.error(`    [sarvam] unparseable (${content.length} chars): ${content.slice(0, 120)}`);
      return null;
    }
    const solution = validSolution(parsed.solutionMd);
    const tips = tipStepsOf(parsed.tips ?? parsed.tipsMd);
    const formulas = formulaListOf(parsed.formulas ?? parsed.formulasMd);
    if (!solution || !tips || !formulas) {
      console.error(
        `    [sarvam] invalid fields: sol=${Boolean(solution)} tips=${Boolean(tips)} frm=${Boolean(formulas)}`
      );
      return null;
    }
    return {
      solutionMd: solution,
      tipsMd: JSON.stringify({ tips }),
      formulasMd: JSON.stringify({ formulas }),
    };
  } catch (err) {
    console.error(`    [sarvam] threw:`, err instanceof Error ? err.message : err);
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function enrichOne(stem: string, chapterName: string, topicName: string): Promise<EnrichResult> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const gem = await callGemini(stem).catch(() => null);
    if (gem) return gem;
    const sar = await callSarvam(stem).catch(() => null);
    if (sar) return sar;
    if (attempt < 3) await sleep(2000);
  }
  return buildStructuredFallback(stem, chapterName, topicName);
}

/** Modest parallel workers so a 160-question chapter is minutes, not hours. */
const CONCURRENCY = 4;

async function runPool(rows: Row[]) {
  let done = 0;
  let fallbacks = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      if (!row) break;
      const stem = (row.body ?? "").trim();
      const chapterName = row.chapters?.name ?? "Chapter Practice";
      const topicName = row.topics?.name ?? chapterName;
      if (!stem) continue;

      const result = await enrichOne(stem, chapterName, topicName);
      const isFallback = isSolutionFiller(result.solutionMd);
      if (isFallback) fallbacks += 1;

      const need = fieldsNeedingWork(row);
      const { error: updateErr } = await supabase
        .from("pyq_questions")
        .update({
          ...(need.solution ? { solution_md: result.solutionMd } : {}),
          ...(need.tips ? { tips_md: result.tipsMd } : {}),
          ...(need.formulas ? { formulas_md: result.formulasMd } : {}),
        })
        .eq("id", row.id);

      done += 1;
      if (!updateErr) {
        const tag = isFallback ? "FALLBACK" : "ai";
        console.log(`  [${done}/${rows.length}] ${tag} ${row.id} (${chapterName} — ${topicName})`);
      } else {
        console.error(`  [${done}/${rows.length}] Failed to update ${row.id}:`, updateErr.message);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { done, fallbacks };
}

type Row = {
  id: string;
  body: string | null;
  solution_md: string | null;
  tips_md: string | null;
  formulas_md: string | null;
  chapters: { name: string; catalog_slug: string | null } | null;
  topics: { name: string } | null;
};

/** Which fields of this row the run should (re)write. */
function fieldsNeedingWork(row: Row): { solution: boolean; tips: boolean; formulas: boolean } {
  const solution = !row.solution_md?.trim() || (REFILL && isSolutionFiller(row.solution_md));
  const tips = !row.tips_md?.trim() || (REFILL && isTipsFiller(row.tips_md));
  const formulas = !row.formulas_md?.trim() || (REFILL && isFormulasFiller(row.formulas_md));
  return { solution, tips, formulas };
}

async function main() {
  const label = CHAPTER_SLUGS.length > 0 ? `chapters: ${CHAPTER_SLUGS.join(", ")}` : "ALL chapters";
  console.log(`Starting Chapter PYQ enrichment (${label}, limit ${LIMIT}${REFILL ? ", refill" : ""})...`);

  const allRows: Row[] = [];

  if (REFILL) {
    // Filler signatures are not expressible as one safe PostgREST or(), and a
    // bare .limit() window misses rows deeper in the chapter — paginate the
    // whole selection and filter in JS.
    if (CHAPTER_SLUGS.length === 0) {
      console.error("--refill requires at least one chapter slug (full-bank scan is too wide).");
      process.exit(1);
    }
    const PAGE = 1000;
    for (let page = 0; page < 20; page++) {
      const from = page * PAGE;
      const { data, error } = await supabase
        .from("pyq_questions")
        .select(
          "id, body, solution_md, tips_md, formulas_md, chapters:pyq_chapters!inner(name, catalog_slug), topics:pyq_topics(name)"
        )
        .in("review_status", ["auto_ok", "human_ok"])
        .in("chapters.catalog_slug", CHAPTER_SLUGS)
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("Error fetching PYQ questions:", error.message);
        process.exit(1);
      }
      const batch = (data ?? []) as Row[];
      allRows.push(...batch);
      if (batch.length < PAGE) break;
    }
  } else {
    let query = supabase
      .from("pyq_questions")
      .select(
        "id, body, solution_md, tips_md, formulas_md, chapters:pyq_chapters!inner(name, catalog_slug), topics:pyq_topics(name)"
      )
      .in("review_status", ["auto_ok", "human_ok"])
      .or("solution_md.is.null,tips_md.is.null,formulas_md.is.null")
      .limit(LIMIT);
    if (CHAPTER_SLUGS.length > 0) {
      query = query.in("chapters.catalog_slug", CHAPTER_SLUGS);
    }
    const { data, error } = await query;
    if (error) {
      console.error("Error fetching PYQ questions:", error.message);
      process.exit(1);
    }
    allRows.push(...((data ?? []) as Row[]));
  }

  const rows = REFILL
    ? allRows.filter((row) => {
        const need = fieldsNeedingWork(row);
        return need.solution || need.tips || need.formulas;
      })
    : allRows;

  if (rows.length === 0) {
    console.log("Nothing to enrich for this selection — all done!");
    return;
  }

  console.log(`Found ${rows.length} Chapter PYQ questions requiring enrichment.`);

  const { done, fallbacks } = await runPool(rows);
  console.log(`\nDone. Updated ${done}/${rows.length} (${fallbacks} used structured fallback).`);
}

void main();
