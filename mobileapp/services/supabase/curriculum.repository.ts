import type { ClassLevel, Subject, TopicNode } from "@/core/domain/curriculum";
import { getSupabaseClient } from "./client";

const CURRICULUM_SELECT = `
  id,
  subject,
  class_level,
  unit_label,
  unit_title,
  exam_relevance,
  sort_order,
  curriculum_chapters (
    id,
    title,
    sort_order,
    curriculum_topics (
      id,
      title,
      sort_order,
      curriculum_subtopics (
        name,
        sort_order
      )
    )
  )
`;

type UnitRow = {
  subject: string;
  class_level: number;
  unit_label: string;
  unit_title: string;
  exam_relevance: string[] | null;
  curriculum_chapters?: {
    title: string;
    sort_order: number;
    curriculum_topics?: {
      title: string;
      sort_order: number;
      curriculum_subtopics?: { name: string; sort_order: number }[];
    }[];
  }[];
};

function norm(s: string | null | undefined): string {
  return typeof s === "string" ? s.trim() : "";
}

async function fetchUnits(subject: Subject, classLevel: ClassLevel): Promise<UnitRow[] | null> {
  const { data, error } = await getSupabaseClient()
    .from("curriculum_units")
    .select(CURRICULUM_SELECT)
    .eq("subject", subject)
    .eq("class_level", classLevel)
    .order("sort_order", { ascending: true });

  if (error) return null;
  return (data as UnitRow[]) ?? [];
}

function mapUnitsToNodes(rows: UnitRow[]): TopicNode[] {
  const nodes: TopicNode[] = [];
  for (const unit of rows) {
    const chapters = (unit.curriculum_chapters ?? []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    for (const chapter of chapters) {
      const chapterTitle = norm(chapter.title);
      const topics = (chapter.curriculum_topics ?? []).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      for (const topic of topics) {
        const topicTitle = norm(topic.title);
        if (!topicTitle || !chapterTitle) continue;
        const seen = new Set<string>();
        const subtopics = (topic.curriculum_subtopics ?? [])
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((s) => norm(s.name))
          .filter((name) => {
            if (!name) return false;
            const k = name.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .map((name) => ({ name }));

        nodes.push({
          subject: unit.subject as Subject,
          classLevel: unit.class_level as ClassLevel,
          topic: topicTitle,
          chapterTitle,
          unitLabel: norm(unit.unit_label),
          unitTitle: norm(unit.unit_title),
          subtopics,
        });
      }
    }
  }
  return nodes;
}

export async function fetchFullCurriculum(): Promise<TopicNode[]> {
  const subjects: Subject[] = ["physics", "chemistry", "math"];
  const levels: ClassLevel[] = [11, 12];
  const all: TopicNode[] = [];
  let anyOk = false;

  for (const subject of subjects) {
    for (const classLevel of levels) {
      const rows = await fetchUnits(subject, classLevel);
      if (rows) {
        anyOk = true;
        all.push(...mapUnitsToNodes(rows));
      }
    }
  }

  if (!anyOk) throw new Error("Could not load curriculum from Supabase");
  return all;
}
