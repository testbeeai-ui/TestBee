/**
 * Import CBSE NCERT chapter JSON files into mock_papers + mock_questions.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env scripts/import-cbse-12-mcqs.ts
 *
 * Class 12 (default):
 *   CBSE_XII_JSON_ROOT or default Downloads CBSE XII path
 *
 * Class 11:
 *   CBSE_CLASS_LEVEL=11
 *   CBSE_JSON_ROOT="C:\Users\rentk\Downloads\CBSE XI-20260519T150202Z-3-001\CBSE XI"
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required)
 *   CBSE_CLASS_LEVEL — 11 or 12 (default 12)
 *   CBSE_JSON_ROOT / CBSE_XII_JSON_ROOT — JSON folder root
 *   DRY_RUN=1 — parse only, no DB writes
 *   ONLY_CHAPTER_ID=p11-1 — import a single chapter (retry missed)
 *
 * Idempotent: deletes mock_papers row by slug (chapter id) then re-inserts.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types";
import { MCQ_CHAPTERS, type McqClassChapters } from "../components/prep-mock/constants";
import {
  type ExamJson,
  type Subject,
  prepareQuestionsFromExamJson,
} from "./lib/mcq-json-import-core";

type SupabaseAdmin = ReturnType<typeof createClient<Database>>;

const DEFAULT_ROOT_BY_CLASS: Record<11 | 12, string> = {
  12: "C:\\Users\\rentk\\Downloads\\CBSE XII-20260519T150236Z-3-001\\CBSE XII",
  11: "C:\\Users\\rentk\\Downloads\\CBSE XI-20260519T150202Z-3-001\\CBSE XI",
};

const FOLDER_SUBJECT: Record<string, Subject> = {
  "NCERT-Physics": "physics",
  "NCERT-Chemistry": "chemistry",
  "NCERT-Mathematics": "math",
};

const CBSE_NCERT_CHAPTER_MARKING =
  "+4 for each correct response, 0 for incorrect or unattempted (CBSE NCERT chapter MCQ).";

/** JSON examSetName quirks → chapter id (class-specific ids in value). */
const CHAPTER_ID_ALIASES: Record<11 | 12, Record<string, string>> = {
  12: {
    "general priciples and process of isolation of elements": "c12-6",
    "continuity and differentibility": "m12-5",
    "inverse trignometric functions": "m12-2",
    "application of derivative": "m12-6",
    "semiconductor electronics material devices and simple circuits": "p12-14",
    "alcohols phenols and ethers": "c12-11",
    "aldehydes ketones and carboxylic acids": "c12-12",
    "the d and f block elements": "c12-8",
    "the p block elements": "c12-7",
    probability: "m12-13",
    "relations and functions": "m12-1",
    "three dimensional geometry": "m12-11",
  },
  11: {
    // Shared title across physics/chemistry — resolved via FOLDER_CHAPTER_ALIASES
    "chemical bonding molecular structure": "c11-4",
    "classification of elements and periodicity in properties": "c11-3",
    "organic chemistry some basic principles and techniques": "c11-12",
    "the p block elements": "c11-11",
    "the s block elements": "c11-10",
    "complex numbers": "m11-5",
    "introduction to three dimensional geometry": "m11-12",
    probability: "m11-16",
    "relations and functions": "m11-2",
    "work energy and power": "p11-6",
    "system of particles and rotational motion": "p11-7",
  },
};

/** Same examSetName in different NCERT subjects (e.g. Thermodynamics). */
const FOLDER_CHAPTER_ALIASES: Record<11 | 12, Partial<Record<Subject, Record<string, string>>>> = {
  12: {},
  11: {
    physics: { thermodynamics: "p11-12" },
    chemistry: { thermodynamics: "c11-6" },
  },
};

type ChapterMeta = { id: string; name: string; subject: Subject };

function normChapterKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/:\s*class\s*(11|12)/gi, "")
    .replace(/[:,]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildChapterLookup(classLevel: 11 | 12): Map<string, ChapterMeta> {
  const map = new Map<string, ChapterMeta>();
  const subjects: McqClassChapters[11 | 12] = MCQ_CHAPTERS[classLevel];
  for (const subject of ["physics", "chemistry", "math"] as const) {
    for (const ch of subjects[subject]) {
      const meta: ChapterMeta = { id: ch.id, name: ch.name, subject };
      map.set(normChapterKey(ch.name), meta);
    }
  }
  for (const [aliasKey, chapterId] of Object.entries(CHAPTER_ID_ALIASES[classLevel])) {
    for (const subject of ["physics", "chemistry", "math"] as const) {
      const ch = subjects[subject].find((c) => c.id === chapterId);
      if (ch) {
        map.set(aliasKey, { id: ch.id, name: ch.name, subject });
        break;
      }
    }
  }
  return map;
}

function chapterById(classLevel: 11 | 12, chapterId: string): ChapterMeta | null {
  const subjects = MCQ_CHAPTERS[classLevel];
  for (const subject of ["physics", "chemistry", "math"] as const) {
    const ch = subjects[subject].find((c) => c.id === chapterId);
    if (ch) return { id: ch.id, name: ch.name, subject };
  }
  return null;
}

function resolveChapter(
  lookup: Map<string, ChapterMeta>,
  examSetName: string,
  folderSubject: Subject,
  classLevel: 11 | 12
): ChapterMeta | null {
  const key = normChapterKey(examSetName);
  const folderAliasId = FOLDER_CHAPTER_ALIASES[classLevel][folderSubject]?.[key];
  if (folderAliasId) {
    return chapterById(classLevel, folderAliasId);
  }
  const hit = lookup.get(key);
  if (hit && hit.subject === folderSubject) return hit;
  return null;
}

function catalogTitle(classLevel: 11 | 12, examTypeName: string, chapterName: string): string {
  const grade = classLevel === 11 ? "CBSE XI" : "CBSE XII";
  return `${grade} — ${examTypeName.trim()} — ${chapterName.trim()}`;
}

type FileResult =
  | { ok: true; file: string; slug: string; inserted: number; skipped: number }
  | { ok: false; file: string; error: string };

const MAX_RETRIES = 5;

function shortError(msg: string): string {
  if (msg.includes("<!DOCTYPE") || msg.includes("Connection timed out")) {
    return "Supabase unreachable (timeout or network)";
  }
  return msg.length > 240 ? `${msg.slice(0, 240)}…` : msg;
}

async function withRetries<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt < MAX_RETRIES) {
        const waitMs = 3000 * attempt;
        console.warn(`  retry ${attempt}/${MAX_RETRIES} ${label} in ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function importOneFile(
  supabase: SupabaseAdmin | null,
  filePath: string,
  folderSubject: Subject,
  classLevel: 11 | 12,
  chapterLookup: Map<string, ChapterMeta>,
  dryRun: boolean
): Promise<FileResult> {
  const rel = path.basename(filePath);
  let exam: ExamJson;
  try {
    exam = JSON.parse(fs.readFileSync(filePath, "utf8")) as ExamJson;
  } catch (e) {
    return {
      ok: false,
      file: rel,
      error: `JSON parse: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const examSetName = (exam.examSetName ?? "").trim();
  const examTypeName = (exam.examTypeName ?? "").trim();
  if (!examSetName) {
    return { ok: false, file: rel, error: "Missing examSetName" };
  }

  const chapter = resolveChapter(chapterLookup, examSetName, folderSubject, classLevel);
  if (!chapter) {
    return {
      ok: false,
      file: rel,
      error: `No MCQ_CHAPTERS[${classLevel}] match for examSetName="${examSetName}" (${folderSubject})`,
    };
  }

  const slug = chapter.id;
  const title = catalogTitle(classLevel, examTypeName || `NCERT ${folderSubject}`, chapter.name);
  const questions = exam.questions ?? [];

  const skipLog: string[] = [];
  const { batch, skipped } = prepareQuestionsFromExamJson(questions, {
    forcedSubject: folderSubject,
    defaultChapter: chapter.name,
    onSkip: (reason, qid) => {
      if (skipLog.length < 5) skipLog.push(`${qid}:${reason}`);
    },
  });

  if (batch.length === 0) {
    return {
      ok: false,
      file: rel,
      error: `No valid questions (skipped ${skipped})${skipLog.length ? ` e.g. ${skipLog.join(", ")}` : ""}`,
    };
  }

  const durationMinutes = Math.max(30, Math.ceil(batch.length * 2));
  const totalMarks = batch.length * 4;
  const examLabel = classLevel === 11 ? "CBSE XI" : "CBSE XII";

  if (dryRun) {
    return { ok: true, file: rel, slug, inserted: batch.length, skipped };
  }

  if (!supabase) {
    return { ok: false, file: rel, error: "Supabase client not configured" };
  }

  try {
    await withRetries(`delete slug ${slug}`, async () => {
      const { data: existingRows, error: existingErr } = await supabase
        .from("mock_papers")
        .select("id")
        .eq("slug", slug);
      if (existingErr) throw new Error(shortError(existingErr.message));
      for (const row of existingRows ?? []) {
        const { error: delErr } = await supabase.from("mock_papers").delete().eq("id", row.id);
        if (delErr) throw new Error(shortError(delErr.message));
      }
    });

    const paper = await withRetries(`insert paper ${slug}`, async () => {
      const { data, error: paperErr } = await supabase
        .from("mock_papers")
        .insert({
          slug,
          title,
          exam_name: examLabel,
          exam_set_name: chapter.name,
          paper_type: "chapter",
          board: "CBSE",
          chapter_id: chapter.id,
          duration_minutes: durationMinutes,
          total_marks: totalMarks,
          question_count: batch.length,
          marking_scheme: CBSE_NCERT_CHAPTER_MARKING,
          class_level: classLevel,
          tags: ["CBSE", `Class ${classLevel}`, "NCERT", examTypeName, chapter.name].filter(
            Boolean
          ),
          subjects_covered: [folderSubject],
          published: true,
        })
        .select("id")
        .single();
      if (paperErr || !data)
        throw new Error(shortError(paperErr?.message ?? "mock_papers insert failed"));
      return data;
    });

    const paperId = paper.id as string;
    const CHUNK = 80;
    for (let i = 0; i < batch.length; i += CHUNK) {
      const slice = batch.slice(i, i + CHUNK).map((row) => ({ ...row, paper_id: paperId }));
      await withRetries(`insert questions ${slug} chunk ${i}`, async () => {
        const { error } = await supabase.from("mock_questions").insert(slice);
        if (error) throw new Error(shortError(error.message));
      });
    }
  } catch (e) {
    return {
      ok: false,
      file: rel,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return { ok: true, file: rel, slug, inserted: batch.length, skipped };
}

function collectJsonFiles(root: string): { filePath: string; subject: Subject }[] {
  const out: { filePath: string; subject: Subject }[] = [];
  for (const folder of Object.keys(FOLDER_SUBJECT)) {
    const dir = path.join(root, folder);
    if (!fs.existsSync(dir)) continue;
    const subject = FOLDER_SUBJECT[folder]!;
    for (const name of fs.readdirSync(dir)) {
      if (!name.toLowerCase().endsWith(".json")) continue;
      out.push({ filePath: path.join(dir, name), subject });
    }
  }
  return out.sort((a, b) => a.filePath.localeCompare(b.filePath));
}

function parseClassLevel(): 11 | 12 {
  const raw = process.env.CBSE_CLASS_LEVEL?.trim();
  if (raw === "11") return 11;
  if (raw === "12") return 12;
  return 12;
}

async function syncChapterCatalog(supabase: SupabaseAdmin, classLevel: 11 | 12): Promise<void> {
  const subjects = MCQ_CHAPTERS[classLevel];
  const rows: {
    chapter_id: string;
    board: string;
    class_level: number;
    subject: Subject;
    chapter_name: string;
    sort_order: number;
  }[] = [];
  for (const subject of ["physics", "chemistry", "math"] as const) {
    subjects[subject].forEach((ch, idx) => {
      rows.push({
        chapter_id: ch.id,
        board: "CBSE",
        class_level: classLevel,
        subject,
        chapter_name: ch.name,
        sort_order: idx + 1,
      });
    });
  }
  const { error } = await supabase
    .from("cbse_mcq_chapters")
    .upsert(rows, { onConflict: "chapter_id" });
  if (error) throw new Error(`cbse_mcq_chapters upsert: ${shortError(error.message)}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const classLevel = parseClassLevel();
  const root =
    process.env.CBSE_JSON_ROOT?.trim() ||
    process.env.CBSE_XII_JSON_ROOT?.trim() ||
    DEFAULT_ROOT_BY_CLASS[classLevel];
  const dryRun = process.env.DRY_RUN === "1";
  const onlyChapterId = process.env.ONLY_CHAPTER_ID?.trim();
  const chapterLookup = buildChapterLookup(classLevel);

  if (!fs.existsSync(root)) {
    throw new Error(`CBSE JSON root not found: ${root}`);
  }

  let files = collectJsonFiles(root);
  if (onlyChapterId) {
    files = files.filter(({ filePath, subject }) => {
      const exam = JSON.parse(fs.readFileSync(filePath, "utf8")) as ExamJson;
      const ch = resolveChapter(
        chapterLookup,
        (exam.examSetName ?? "").trim(),
        subject,
        classLevel
      );
      return ch?.id === onlyChapterId;
    });
    if (files.length === 0) {
      throw new Error(`No file matched ONLY_CHAPTER_ID=${onlyChapterId}`);
    }
  }

  if (!dryRun && (!url || !key)) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = url && key ? createClient<Database>(url, key) : null;
  const results: FileResult[] = [];

  if (!dryRun && supabase) {
    await withRetries("sync cbse_mcq_chapters", () => syncChapterCatalog(supabase, classLevel));
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry_run" : "import",
        class_level: classLevel,
        root,
        file_count: files.length,
        only_chapter_id: onlyChapterId ?? null,
      },
      null,
      2
    )
  );

  for (const { filePath, subject } of files) {
    const result = await importOneFile(
      supabase,
      filePath,
      subject,
      classLevel,
      chapterLookup,
      dryRun
    );
    results.push(result);
    const line = result.ok
      ? `OK  ${result.file} → ${result.slug} (${result.inserted} q, ${result.skipped} skipped)`
      : `FAIL ${result.file}: ${result.error}`;
    console.log(line);
  }

  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);

  const summary = {
    class_level: classLevel,
    total_files: results.length,
    success: ok.length,
    failed: fail.length,
    total_questions_inserted: ok.reduce((n, r) => n + (r.ok ? r.inserted : 0), 0),
    failures: fail.map((f) => ({ file: f.file, error: f.error })),
  };

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));

  if (fail.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
