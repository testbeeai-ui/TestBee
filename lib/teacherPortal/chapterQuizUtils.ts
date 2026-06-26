import type { TopicNode } from "@/data/topicTaxonomy";
import type { TeacherPortalChapterQuizRef } from "@/lib/teacherPortal/types";
import type { ClassLevel, Subject } from "@/types";
import type { DifficultyLevel } from "@/lib/slugs";
import type { AdvancedQuizSetIndex } from "@/lib/play/quiz/advancedQuizSets";

export type ChapterQuizSelectionState = {
  classLevel: ClassLevel | null;
  subject: Subject | null;
  chapterTitle: string | null;
  /** Index into {@link topicsForChapter} */
  topicIndex: number | null;
  subtopicName: string | null;
  level: DifficultyLevel;
  advancedSet: AdvancedQuizSetIndex;
};

export const initialChapterQuizSelection = (): ChapterQuizSelectionState => ({
  classLevel: null,
  subject: null,
  chapterTitle: null,
  topicIndex: null,
  subtopicName: null,
  /** Teacher flow uses advanced practice tiers only; UI picks practice set (1–6). */
  level: "advanced",
  advancedSet: 1,
});

export function uniqueChaptersFor(
  nodes: TopicNode[],
  subject: Subject,
  classLevel: ClassLevel
): string[] {
  const set = new Set<string>();
  for (const n of nodes) {
    if (n.subject !== subject || n.classLevel !== classLevel) continue;
    const ch = (n.chapterTitle ?? "").trim();
    set.add(ch || "(No chapter title)");
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function topicsForChapter(
  nodes: TopicNode[],
  subject: Subject,
  classLevel: ClassLevel,
  chapterTitle: string
): TopicNode[] {
  const normalized = chapterTitle === "(No chapter title)" ? "" : chapterTitle;
  return nodes.filter((n) => {
    if (n.subject !== subject || n.classLevel !== classLevel) return false;
    const ch = (n.chapterTitle ?? "").trim();
    if (normalized === "") return ch === "";
    return ch === normalized;
  });
}

export function topicOptionLabel(n: TopicNode): string {
  const unit = (n.unitLabel ?? n.unitTitle ?? "").trim();
  return unit ? `${n.topic} — ${unit}` : n.topic;
}

export function chapterQuizSelectionComplete(
  sel: ChapterQuizSelectionState,
  taxonomy: TopicNode[]
): boolean {
  if (
    !sel.classLevel ||
    !sel.subject ||
    !sel.chapterTitle ||
    sel.topicIndex == null ||
    !sel.subtopicName?.trim()
  ) {
    return false;
  }
  const topics = topicsForChapter(taxonomy, sel.subject, sel.classLevel, sel.chapterTitle);
  const node = topics[sel.topicIndex];
  if (!node) return false;
  return node.subtopics.some((s) => s.name === sel.subtopicName);
}

export function chapterQuizToRef(
  sel: ChapterQuizSelectionState,
  taxonomy: TopicNode[]
): TeacherPortalChapterQuizRef | null {
  if (!chapterQuizSelectionComplete(sel, taxonomy)) return null;
  const topics = topicsForChapter(taxonomy, sel.subject!, sel.classLevel!, sel.chapterTitle!);
  const node = topics[sel.topicIndex!]!;
  const chapterTitleStored = sel.chapterTitle === "(No chapter title)" ? "" : sel.chapterTitle!;
  return {
    board: "cbse",
    subject: sel.subject!,
    classLevel: sel.classLevel!,
    chapterTitle: chapterTitleStored,
    topic: node.topic,
    subtopicName: sel.subtopicName!.trim(),
    level: "advanced",
    advancedSet: sel.advancedSet,
  };
}
