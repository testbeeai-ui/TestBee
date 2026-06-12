import type { DifficultyLevel } from "@/lib/slugs";
import type { TopicContentGateRow } from "@/lib/curriculum/subtopicCompleteness";
import type { TopicSubtopicPreview } from "@/lib/curriculum/topicContentService";

/** Agent gap-fill stores a single hyphen when a section was intentionally skipped. */
export const TOPIC_HUB_SECTION_PLACEHOLDER = "-";

export function normalizeHubSectionForDisplay(value: string | null | undefined): string {
  const t = String(value ?? "").trim();
  if (!t || t === TOPIC_HUB_SECTION_PLACEHOLDER) return "";
  return t;
}

export function hasDisplayableHubSection(value: string | null | undefined): boolean {
  return normalizeHubSectionForDisplay(value).length > 0;
}

export function topicHubRowHasOverviewProse(row: TopicContentGateRow | null | undefined): boolean {
  if (!row) return false;
  return (
    hasDisplayableHubSection(row.why_study) ||
    hasDisplayableHubSection(row.what_learn) ||
    hasDisplayableHubSection(row.real_world)
  );
}

export function topicHubRowHasPreviews(row: TopicContentGateRow | null | undefined): boolean {
  return Array.isArray(row?.subtopic_previews) && row.subtopic_previews.length > 0;
}

/** Gate + display viability: real prose or subtopic previews (placeholders do not count as prose). */
export function isTopicHubRowViable(row: TopicContentGateRow | null | undefined): boolean {
  if (!row) return false;
  return topicHubRowHasOverviewProse(row) || topicHubRowHasPreviews(row);
}

export function countSubtopicPreviews(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const o = item as Record<string, unknown>;
    const name = String(o.subtopicName ?? o.subtopic_name ?? "").trim();
    const preview = typeof o.preview === "string" ? o.preview.trim() : "";
    return Boolean(name && preview);
  }).length;
}

export function mergeHubSectionsAcrossLevels(
  rows: Partial<Record<DifficultyLevel, { whyStudy: string; whatLearn: string; realWorld: string }>>
): { whyStudy: string; whatLearn: string; realWorld: string } {
  const order: DifficultyLevel[] = ["basics", "intermediate", "advanced"];
  const pick = (key: "whyStudy" | "whatLearn" | "realWorld") => {
    for (const level of order) {
      const text = rows[level]?.[key];
      if (hasDisplayableHubSection(text)) return normalizeHubSectionForDisplay(text);
    }
    return "";
  };
  return {
    whyStudy: pick("whyStudy"),
    whatLearn: pick("whatLearn"),
    realWorld: pick("realWorld"),
  };
}

export function mergeSubtopicPreviewsAcrossLevels(
  previewsByLevel: Partial<Record<DifficultyLevel, TopicSubtopicPreview[]>>
): TopicSubtopicPreview[] {
  const order: DifficultyLevel[] = ["basics", "intermediate", "advanced"];
  for (const level of order) {
    const list = previewsByLevel[level];
    if (list && list.length > 0) return list;
  }
  return [];
}
