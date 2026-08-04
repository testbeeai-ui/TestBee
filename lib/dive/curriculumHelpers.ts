import type { TopicNode } from "@/data/topicTaxonomy";
import type { Subject } from "@/types";
import { assignSubtopicRelativePercents } from "@/lib/dive/subtopicWeightage";
import type { DiveSubtopicCandidate } from "@/lib/dive/suggestBatch";

export function chaptersForSubjectClass(
  taxonomy: TopicNode[],
  subject: Subject,
  classLevel: 11 | 12
): string[] {
  const titles = new Set<string>();
  for (const node of taxonomy) {
    if (node.subject !== subject || node.classLevel !== classLevel) continue;
    const title = (node.chapterTitle ?? node.topic ?? "").trim();
    if (title) titles.add(title);
  }
  return Array.from(titles).sort((a, b) => a.localeCompare(b));
}

/** Flatten all subtopics under a chapter into Dive candidates with relative weightage. */
export function subtopicsForChapter(
  taxonomy: TopicNode[],
  subject: Subject,
  classLevel: 11 | 12,
  chapterTitle: string
): DiveSubtopicCandidate[] {
  const needle = chapterTitle.trim().toLowerCase();
  const nodes = taxonomy.filter(
    (n) =>
      n.subject === subject &&
      n.classLevel === classLevel &&
      (n.chapterTitle ?? "").trim().toLowerCase() === needle
  );

  const flat: Omit<DiveSubtopicCandidate, "relativePct" | "description">[] = [];
  for (const node of nodes) {
    for (const st of node.subtopics) {
      const name = st.name?.trim();
      if (!name) continue;
      flat.push({
        id: `${node.topic}::${name}`,
        name,
        topicTitle: node.topic,
        chapterTitle: node.chapterTitle ?? chapterTitle,
      });
    }
  }

  // De-dupe by name (keep first topic)
  const seen = new Set<string>();
  const unique = flat.filter((s) => {
    const key = s.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const pcts = assignSubtopicRelativePercents(unique.map((s) => s.name));
  return unique.map((s, i) => ({
    ...s,
    relativePct: pcts[i] ?? 5,
    description: `From ${s.topicTitle} · exam-relevant focus`,
  }));
}
