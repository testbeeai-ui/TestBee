/**
 * Seed Learning Outcomes for Relations and Functions into
 * `learning_outcomes_questions` from tmp-rf-outcomes-parsed.json.
 *
 * Source DOCX: Class 12 Mathematics Relations and Functions.docx
 *
 * Note: math subtopic_content currently has advanced only for this chapter —
 * we still upsert LO for basics/intermediate/advanced so Dive works at all levels.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Run: npx tsx --env-file=.env scripts/seed-rf-learning-outcomes.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type ParsedQ = {
  question: string;
  options: string[];
  correctAnswer: string;
  solution: string;
  difficulty?: string;
};

type ParsedBlock = {
  docTitle: string;
  matchKey: string;
  topic: string;
  questions: ParsedQ[];
  count: number;
};

const SOURCE = "Class 12 Mathematics Relations and Functions.docx";
const LEVELS = ["basics", "intermediate", "advanced"] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const parsedPath = resolve(process.cwd(), "tmp-rf-outcomes-parsed.json");
  const blocks = JSON.parse(readFileSync(parsedPath, "utf8")) as ParsedBlock[];
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let updated = 0;
  let missed = 0;
  let totalQs = 0;

  for (const block of blocks) {
    const payload = block.questions.map((q) => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      solution: q.solution,
    }));
    totalQs += payload.length;

    const { data: rows, error: findErr } = await supabase
      .from("subtopic_content")
      .select("board, subject, class_level, topic, subtopic_name, level")
      .eq("class_level", 12)
      .ilike("subject", "%math%")
      .eq("topic", block.topic)
      .ilike("subtopic_name", `${block.matchKey}%`);

    if (findErr) {
      console.error("find failed", block.matchKey, findErr.message);
      missed += 1;
      continue;
    }
    if (!rows?.length) {
      console.warn("NO MATCH", block.topic, "|", block.matchKey);
      missed += 1;
      continue;
    }

    // Deduplicate by subtopic_name (may only have advanced in content today)
    const bySub = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!bySub.has(row.subtopic_name)) bySub.set(row.subtopic_name, row);
    }

    for (const row of bySub.values()) {
      for (const level of LEVELS) {
        const { error: upsertErr } = await supabase.from("learning_outcomes_questions").upsert(
          {
            board: row.board || "CBSE",
            subject: row.subject,
            class_level: row.class_level,
            topic: row.topic,
            subtopic_name: row.subtopic_name,
            level,
            questions: payload,
            source: SOURCE,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "board,subject,class_level,topic,subtopic_name,level" }
        );
        if (upsertErr) {
          console.error("upsert failed", row.subtopic_name, level, upsertErr.message);
          missed += 1;
          continue;
        }
        updated += 1;
        console.log(
          `✓ ${level.padEnd(12)} ${row.topic} · ${String(row.subtopic_name).slice(0, 70)} (${payload.length} Qs)`
        );
      }
    }
  }

  console.log(
    `\nDone. upserted=${updated} miss_or_fail=${missed} blocks=${blocks.length} sourceQs=${totalQs}`
  );
  console.log("Table: public.learning_outcomes_questions");
  console.log("Source:", SOURCE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
