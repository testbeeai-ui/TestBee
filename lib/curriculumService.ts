/**
 * Fetches curriculum (Unit -> Chapter -> Topic -> Subtopic) from Supabase
 * and maps to TopicNode[] for use in the explore UI.
 */

import { supabase } from '@/integrations/supabase/client';
import type { TopicNode } from '@/data/topicTaxonomy';
import type { Subject } from '@/types';
import type { ExamType } from '@/types';

type CurriculumUnitRow = {
  id: string;
  subject: string;
  class_level: number;
  unit_label: string;
  unit_title: string;
  exam_relevance: string[] | null;
  sort_order: number;
  curriculum_chapters?: CurriculumChapterRow[];
};

type CurriculumChapterRow = {
  id: string;
  title: string;
  sort_order: number;
  curriculum_topics?: CurriculumTopicRow[];
};

type CurriculumTopicRow = {
  id: string;
  title: string;
  sort_order: number;
  curriculum_subtopics?: { name: string; sort_order: number }[];
};

const CANONICAL_SUBTOPICS: Record<string, string[]> = {
  "math|12|Area Under Curves": [
    "Area between curve y = f(x) and x-axis from x=a to x=b: A = integral_a^b |f(x)| dx",
    "Area between curve x = g(y) and y-axis from y=c to y=d: A = integral_c^d |g(y)| dy",
    "Standard areas: circle x^2+y^2=r^2 -> A = pi r^2; parabola y^2=4ax from 0 to h -> A = (4a/3)(h/4a)^(3/2)",
    "Area between two curves: A = integral_a^b [f(x) - g(x)] dx where f(x) >= g(x)",
    "Find intersection points first (set f(x) = g(x)) to determine limits",
  ],
};

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mapExamRelevance(arr: string[] | null): ExamType[] {
  if (!arr?.length) return [];
  const allowed = new Set<ExamType>(['JEE', 'NEET', 'KCET', 'JEE_Mains', 'JEE_Advance', 'other']);
  const out: ExamType[] = [];
  for (const value of arr) {
    const trimmed = value.trim();
    if (!allowed.has(trimmed as ExamType)) continue;
    const exam = trimmed as ExamType;
    if (!out.includes(exam)) out.push(exam);
  }
  return out;
}

function applyCanonicalSubtopicFixups(subject: Subject, classLevel: number, topicTitle: string, raw: string[]): string[] {
  const key = `${subject}|${classLevel}|${topicTitle}`;
  const canonical = CANONICAL_SUBTOPICS[key];
  if (!canonical?.length) return raw;

  const out = [...raw];
  const seen = new Set(raw.map((s) => s.trim().toLowerCase()));
  for (const item of canonical) {
    const normalized = item.trim();
    if (!normalized) continue;
    const k = normalized.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(normalized);
  }
  return out;
}

/**
 * Fetches curriculum from Supabase for the given subject and class level,
 * returns TopicNode[] or null on error.
 */
export async function fetchCurriculumFromSupabase(
  subject: Subject,
  classLevel: number
): Promise<TopicNode[] | null> {
  const { data, error } = await supabase
    .from('curriculum_units')
    .select(
      `
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
    `
    )
    .eq('subject', subject)
    .eq('class_level', classLevel)
    .order('sort_order', { ascending: true });

  if (error) {
    console.warn('[curriculumService] Supabase error:', subject, classLevel, error.message, error.code);
    return null;
  }
  if (!data) return null;

  const rows = data as CurriculumUnitRow[];
  const nodes: TopicNode[] = [];

  for (const unit of rows) {
    const examRelevance = mapExamRelevance(unit.exam_relevance);
    const chapters = (unit.curriculum_chapters ?? []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    for (const chapter of chapters) {
      const topics = (chapter.curriculum_topics ?? []).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      for (const topic of topics) {
        const unitLabel = normalizeText(unit.unit_label);
        const unitTitle = normalizeText(unit.unit_title);
        const chapterTitle = normalizeText(chapter.title);
        const topicTitle = normalizeText(topic.title);
        if (!unitLabel || !unitTitle || !chapterTitle || !topicTitle) {
          console.warn(
            '[curriculumService] Skipping malformed curriculum row:',
            JSON.stringify({
              subject: unit.subject,
              classLevel: unit.class_level,
              unitLabel,
              unitTitle,
              chapterTitle,
              topicTitle,
            })
          );
          continue;
        }

        const seenSubtopics = new Set<string>();
        const normalizedSubtopics = (topic.curriculum_subtopics ?? [])
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((s) => normalizeText(s.name))
          .filter((name) => {
            if (!name) return false;
            const key = name.toLowerCase();
            if (seenSubtopics.has(key)) return false;
            seenSubtopics.add(key);
            return true;
          });
        const canonicalized = applyCanonicalSubtopicFixups(
          unit.subject as Subject,
          unit.class_level,
          topicTitle,
          normalizedSubtopics
        );
        const subtopics = canonicalized
          .map((name) => ({ name }));
        nodes.push({
          subject: unit.subject as Subject,
          classLevel: unit.class_level as 11 | 12,
          topic: topicTitle,
          chapterTitle,
          unitLabel,
          unitTitle,
          subtopics,
          examRelevance,
        });
      }
    }
  }

  return nodes;
}

const CURRICULUM_SUBJECTS = ['physics', 'chemistry', 'math', 'biology'] as const satisfies readonly Subject[];

/**
 * Fetches all curriculum rows from Supabase (Class 11 & 12, all subjects).
 * Returns merged TopicNode[] or null if every fetch failed.
 */
export async function fetchFullCurriculumFromSupabase(): Promise<TopicNode[] | null> {
  const pairs: { subject: Subject; classLevel: number }[] = [];
  for (const s of CURRICULUM_SUBJECTS) {
    pairs.push({ subject: s, classLevel: 11 });
    pairs.push({ subject: s, classLevel: 12 });
  }
  const results = await Promise.all(
    pairs.map(({ subject, classLevel }) => fetchCurriculumFromSupabase(subject, classLevel))
  );
  const nodes: TopicNode[] = [];
  let anyOk = false;
  for (const r of results) {
    if (r !== null) {
      anyOk = true;
      nodes.push(...r);
    }
  }
  if (!anyOk) return null;
  return nodes;
}

/** @deprecated Use fetchFullCurriculumFromSupabase */
export async function fetchClass12CurriculumFromSupabase(): Promise<{
  physics: TopicNode[];
  math: TopicNode[];
  chemistry: TopicNode[];
} | null> {
  const [physics, math, chemistry] = await Promise.all([
    fetchCurriculumFromSupabase('physics', 12),
    fetchCurriculumFromSupabase('math', 12),
    fetchCurriculumFromSupabase('chemistry', 12),
  ]);
  if (physics === null && math === null && chemistry === null) return null;
  return {
    physics: physics ?? [],
    math: math ?? [],
    chemistry: chemistry ?? [],
  };
}
