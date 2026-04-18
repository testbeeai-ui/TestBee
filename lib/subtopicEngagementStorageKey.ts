import type { SubtopicEngagementScope } from "@/lib/subtopicEngagementService";

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function normalizeKeyPart(value: unknown, maxLen = 300): string {
  return sanitize(value, maxLen).toLowerCase();
}

/** Same key shape as `profiles.subtopic_engagement` object keys (see subtopic-engagement API). */
export function makeSubtopicEngagementStorageKey(scope: SubtopicEngagementScope): string {
  return [
    normalizeKeyPart(scope.board, 40),
    normalizeKeyPart(scope.subject, 80),
    String(scope.classLevel),
    normalizeKeyPart(scope.topic, 300),
    normalizeKeyPart(scope.subtopicName, 300),
    normalizeKeyPart(scope.level, 30),
  ].join("||");
}
