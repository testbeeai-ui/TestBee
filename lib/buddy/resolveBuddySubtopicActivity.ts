import { buildTopicPath } from "@/lib/curriculum/topicRoutes";
import type { DifficultyLevel, Subject } from "@/types";

export type BuddySubtopicActivitySource = {
  board: string | null;
  subject: string | null;
  classLevel: number | null;
  topic: string | null;
  subtopicName: string | null;
  level: string | null;
  panel: string | null;
  occurredAt: string;
};

function asDifficultyLevel(value: string | null | undefined): DifficultyLevel {
  if (value === "intermediate" || value === "advanced") return value;
  return "basics";
}

function asSubject(value: string | null | undefined): Subject | null {
  const v = (value ?? "").toLowerCase();
  if (v === "physics" || v === "chemistry" || v === "math") return v;
  return null;
}

export function resolveBuddySubtopicActivity(
  presence: BuddySubtopicActivitySource | null,
  dwell: BuddySubtopicActivitySource | null,
  recentWindowMs: number
): {
  latest: BuddySubtopicActivitySource | null;
  isRecent: boolean;
  href: string | null;
} {
  let latest: BuddySubtopicActivitySource | null = null;
  if (presence && dwell) {
    latest = Date.parse(presence.occurredAt) >= Date.parse(dwell.occurredAt) ? presence : dwell;
  } else {
    latest = presence ?? dwell;
  }

  if (!latest) {
    return { latest: null, isRecent: false, href: null };
  }

  const ageMs = Date.now() - Date.parse(latest.occurredAt);
  const isRecent = Number.isFinite(ageMs) && ageMs <= recentWindowMs;

  const subj = asSubject(latest.subject);
  const href = subj
    ? buildTopicPath(
        latest.board ?? "cbse",
        subj,
        Number(latest.classLevel) || 12,
        latest.topic ?? "",
        latest.subtopicName ?? "",
        asDifficultyLevel(latest.level)
      )
    : null;

  return { latest, isRecent, href };
}
