import type { BuddyDashboardResponse } from "@/lib/buddy/buddyClient";

/** @deprecated Prefer `maxBuddies` from `/api/buddy/state` (plan-driven). */
export { BUDDY_MAX_ACTIVE_FALLBACK as BUDDY_MAX_ACTIVE } from "@/lib/buddy/buddyPlanLimits";

export type BuddyPrivacyKey =
  | "share_streak"
  | "share_rdm"
  | "share_mocks"
  | "share_gyan"
  | "share_subtopics"
  | "share_play"
  | "share_community"
  | "share_edufund";

export type BuddyPrivacySettings = Record<BuddyPrivacyKey, boolean>;

export const DEFAULT_BUDDY_PRIVACY: BuddyPrivacySettings = {
  share_streak: true,
  share_rdm: true,
  share_mocks: true,
  share_gyan: true,
  share_subtopics: true,
  share_play: true,
  share_community: true,
  share_edufund: true,
};

const PRIVACY_LABELS: Record<BuddyPrivacyKey, string> = {
  share_streak: "streaks and login activity",
  share_rdm: "RDM balance and earnings",
  share_mocks: "mock test scores",
  share_gyan: "Gyan++ questions and answers",
  share_subtopics: "subtopics completed",
  share_play: "Play arena scores",
  share_community: "community wall posts",
  share_edufund: "EduFund tier progress",
};

export function parseBuddyPrivacySettings(raw: unknown): BuddyPrivacySettings {
  const out = { ...DEFAULT_BUDDY_PRIVACY };
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_BUDDY_PRIVACY) as BuddyPrivacyKey[]) {
    if (typeof obj[key] === "boolean") out[key] = obj[key];
  }
  return out;
}

export function buildPrivacyNotice(
  buddyName: string | null,
  settings: BuddyPrivacySettings
): string {
  const name = buddyName?.trim() || "Your buddy";
  const shared = (Object.keys(settings) as BuddyPrivacyKey[])
    .filter((k) => settings[k])
    .map((k) => PRIVACY_LABELS[k]);
  const privateKeys = (Object.keys(settings) as BuddyPrivacyKey[]).filter((k) => !settings[k]);

  if (shared.length === 0) {
    return `${name} has not shared any activity with buddies yet.`;
  }

  let line = `${name} shares: ${shared.slice(0, 4).join(", ")}`;
  if (shared.length > 4) line += ", and more";
  line += ".";

  if (privateKeys.length > 0) {
    const privateLabels = privateKeys.map((k) => PRIVACY_LABELS[k]);
    line += ` ${privateLabels[0] ? privateLabels[0].charAt(0).toUpperCase() + privateLabels[0].slice(1) : "Some items"} are kept private`;
    if (privateKeys.length > 1) {
      line += ` (${privateLabels.slice(1, 3).join(", ")}${privateKeys.length > 3 ? ", …" : ""})`;
    }
    line += ".";
  }

  return line;
}

export type BuddyAdvancedSections = {
  streak: BuddyStreakSection | null;
  mocks: BuddyMocksSection | null;
  edufund: BuddyEdufundSection | null;
  subjectAccuracy: BuddySubjectAccuracySection | null;
};

export type BuddyStreakSection = {
  dayStreak: number;
  activeDays60d: number;
  avgDailyMs: number;
  last10Days: Array<"active" | "miss" | "unknown">;
  studyDays?: Array<{ day: string; active_ms: number; presence_ms: number }>;
};

export type BuddyMocksSection = {
  recent: Array<{
    title: string;
    subtitle: string;
    scorePercent: number | null;
    href: string;
  }>;
  mocksThisMonth: number;
  avgAccuracy: number | null;
};

export type BuddyEdufundSection = {
  rdm: number;
  nextTierName: string | null;
  nextTierNeed: number | null;
  nextTierProgressPct: number;
  activeDays60d: number;
  activeDaysGoal: number;
  earnedTodayRdm: number;
};

export type BuddySubjectAccuracySection = {
  subjects: Array<{
    subject: "physics" | "math" | "chemistry";
    name: string;
    pct: number;
    hasData: boolean;
  }>;
};

export type BuddyAdvancedDashboardPayload = BuddyDashboardResponse & {
  visibility: BuddyPrivacySettings;
  privacyNotice: string;
  advanced: BuddyAdvancedSections;
};

export function maskDashboardForPrivacy(
  payload: BuddyAdvancedDashboardPayload
): BuddyAdvancedDashboardPayload {
  const v = payload.visibility;
  const masked = { ...payload };

  if (!v.share_rdm) {
    masked.buddy = { ...masked.buddy, rdm: 0 };
  }

  if (!v.share_gyan) {
    masked.gyanRecent = [];
    if (masked.rightNow.kind === "gyan_active" || masked.rightNow.kind === "gyan_browsing") {
      masked.rightNow = { kind: "idle", lastActiveAt: masked.rightNow.lastActiveAt ?? null };
    }
  }

  if (!v.share_community) {
    if (masked.rightNow.kind === "community_posted") {
      masked.rightNow = { kind: "idle", lastActiveAt: masked.rightNow.lastActiveAt ?? null };
    }
  }

  if (!v.share_subtopics) {
    masked.subtopic = {
      current: null,
      lastOn: null,
      completedRecent: [],
    };
  }

  if (!v.share_play) {
    masked.playArena = {
      rdmEarnedToday: 0,
      rdmEarnedLast7Days: 0,
      gauntletStreakDays: 0,
      gauntletDaysLast30: 0,
      challengesAttemptedToday: 0,
      challengesClaimedLast7Days: 0,
      recent: [],
      playRdmMissedToday: 0,
      blitzRoundsToday: 0,
    };
  }

  if (!v.share_mocks) {
    masked.mcqRecent = [];
    if (masked.rightNow.kind === "quiz_attempted") {
      masked.rightNow = { kind: "idle", lastActiveAt: masked.rightNow.lastActiveAt ?? null };
    }
  }

  const adv = { ...masked.advanced };
  if (!v.share_streak) {
    adv.streak = null;
  }
  if (!v.share_mocks) adv.mocks = null;
  if (!v.share_edufund || !v.share_rdm) adv.edufund = null;
  if (!v.share_mocks) adv.subjectAccuracy = null;
  masked.advanced = adv;

  return masked;
}
