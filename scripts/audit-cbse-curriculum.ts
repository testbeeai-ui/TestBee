/**
 * Audits CBSE curriculum hierarchy integrity and optionally clears exam tags.
 *
 * Usage:
 *   npx tsx scripts/audit-cbse-curriculum.ts
 *   npx tsx scripts/audit-cbse-curriculum.ts --clear-exam-tags
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

type UnitRow = {
  id: string;
  subject: string;
  class_level: number;
  unit_label: string;
  unit_title: string;
  exam_relevance: string[] | null;
  curriculum_chapters?: ChapterRow[];
};

type ChapterRow = {
  id: string;
  unit_id: string;
  title: string;
  curriculum_topics?: TopicRow[];
};

type TopicRow = {
  id: string;
  chapter_id: string;
  title: string;
  curriculum_subtopics?: SubtopicRow[];
};

type SubtopicRow = {
  id: string;
  topic_id: string;
  name: string;
};

function normalize(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function keyify(value: string): string {
  return value.trim().toLowerCase();
}

function countDuplicates(values: string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const value of values) {
    const key = keyify(value);
    if (!key) continue;
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

function summarizeSet(label: string, rows: string[]): void {
  if (rows.length === 0) {
    console.log(`- ${label}: 0`);
    return;
  }
  console.log(`- ${label}: ${rows.length}`);
  for (const row of rows.slice(0, 10)) {
    console.log(`  • ${row}`);
  }
  if (rows.length > 10) {
    console.log(`  • ...and ${rows.length - 10} more`);
  }
}

async function main() {
  const clearExamTags = process.argv.includes("--clear-exam-tags");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running."
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("curriculum_units")
    .select(
      `
      id, subject, class_level, unit_label, unit_title, exam_relevance,
      curriculum_chapters (
        id, unit_id, title,
        curriculum_topics (
          id, chapter_id, title,
          curriculum_subtopics (
            id, topic_id, name
          )
        )
      )
    `
    )
    .in("class_level", [11, 12])
    .in("subject", ["physics", "chemistry", "math", "biology"]);

  if (error) throw new Error(`Failed to load curriculum: ${error.message}`);
  const units = (data ?? []) as UnitRow[];

  const badUnits: string[] = [];
  const badChapters: string[] = [];
  const badTopics: string[] = [];
  const badSubtopics: string[] = [];
  const duplicateChapters: string[] = [];
  const duplicateTopics: string[] = [];
  const duplicateSubtopics: string[] = [];
  const examTaggedUnits: string[] = [];
  const invalidExamTags: string[] = [];

  const allowedExamTags = new Set(["JEE", "NEET", "KCET", "JEE_Mains", "JEE_Advance", "other"]);

  for (const unit of units) {
    const unitLabel = normalize(unit.unit_label);
    const unitTitle = normalize(unit.unit_title);
    if (!unitLabel || !unitTitle) {
      badUnits.push(`${unit.subject} class ${unit.class_level} :: "${unit.unit_label}" -> "${unit.unit_title}"`);
    }

    const examTags = unit.exam_relevance ?? [];
    if (examTags.length > 0) {
      examTaggedUnits.push(
        `${unit.subject} class ${unit.class_level} :: ${unitLabel || "(empty unit)"} -> [${examTags.join(", ")}]`
      );
    }
    for (const tag of examTags) {
      if (!allowedExamTags.has(tag)) {
        invalidExamTags.push(
          `${unit.subject} class ${unit.class_level} :: ${unitLabel || "(empty unit)"} has invalid tag "${tag}"`
        );
      }
    }

    const chapters = unit.curriculum_chapters ?? [];
    if (countDuplicates(chapters.map((c) => c.title)) > 0) {
      duplicateChapters.push(`${unit.subject} class ${unit.class_level} :: ${unitLabel}`);
    }

    for (const chapter of chapters) {
      const chapterTitle = normalize(chapter.title);
      if (!chapterTitle) {
        badChapters.push(
          `${unit.subject} class ${unit.class_level} :: ${unitLabel} has empty chapter title`
        );
      }

      const topics = chapter.curriculum_topics ?? [];
      if (countDuplicates(topics.map((t) => t.title)) > 0) {
        duplicateTopics.push(
          `${unit.subject} class ${unit.class_level} :: ${unitLabel} / ${chapterTitle || "(empty chapter)"}`
        );
      }

      for (const topic of topics) {
        const topicTitle = normalize(topic.title);
        if (!topicTitle) {
          badTopics.push(
            `${unit.subject} class ${unit.class_level} :: ${unitLabel} / ${chapterTitle || "(empty chapter)"} has empty topic title`
          );
        }

        const subtopics = topic.curriculum_subtopics ?? [];
        if (countDuplicates(subtopics.map((s) => s.name)) > 0) {
          duplicateSubtopics.push(
            `${unit.subject} class ${unit.class_level} :: ${unitLabel} / ${chapterTitle || "(empty chapter)"} / ${topicTitle || "(empty topic)"}`
          );
        }

        for (const subtopic of subtopics) {
          if (!normalize(subtopic.name)) {
            badSubtopics.push(
              `${unit.subject} class ${unit.class_level} :: ${unitLabel} / ${chapterTitle || "(empty chapter)"} / ${topicTitle || "(empty topic)"} has empty subtopic`
            );
          }
        }
      }
    }
  }

  console.log("\nCBSE curriculum audit report");
  console.log("============================");
  console.log(`Total units scanned: ${units.length}`);
  summarizeSet("Malformed units", badUnits);
  summarizeSet("Malformed chapters", badChapters);
  summarizeSet("Malformed topics", badTopics);
  summarizeSet("Malformed subtopics", badSubtopics);
  summarizeSet("Units with duplicate chapter titles", duplicateChapters);
  summarizeSet("Chapters with duplicate topic titles", duplicateTopics);
  summarizeSet("Topics with duplicate subtopic names", duplicateSubtopics);
  summarizeSet("Units carrying exam tags", examTaggedUnits);
  summarizeSet("Units with invalid exam tags", invalidExamTags);

  if (clearExamTags) {
    const idsToClear = units
      .filter((u) => (u.exam_relevance ?? []).length > 0)
      .map((u) => u.id);

    if (idsToClear.length === 0) {
      console.log("\nNo exam tags found; nothing to clear.");
      return;
    }

    const { error: clearError } = await supabase
      .from("curriculum_units")
      .update({ exam_relevance: [] })
      .in("id", idsToClear);

    if (clearError) {
      throw new Error(`Failed to clear exam_relevance: ${clearError.message}`);
    }
    console.log(`\nCleared exam_relevance for ${idsToClear.length} unit rows.`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

