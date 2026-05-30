/**
 * Maps `daily_reward_claims.action_type` into profile UI buckets.
 * Extend when new action types are added in migrations.
 */

const TZ = "Asia/Kolkata";

export type RdmActivityBucketKey = "gyan" | "play" | "mocks" | "revision";

const GYAN = new Set(["ASK", "COMMENT", "UPVOTE", "SAVE"]);

const PLAY = new Set([
  "TOPIC_QUIZ_ADVANCED_60",
  "NUMERALS_PACK_COMPLETE",
  "DAILY_DOSE_ACADEMIC",
  "DAILY_DOSE_FUNBRAIN",
  "DAILY_DOSE_STREAK_7",
  "DAILY_DOSE_STREAK_30",
]);

/** Revision / InstaCue daily milestone */
const REVISION = new Set(["INSTACUE_CREATE"]);

export function bucketForDailyRewardAction(actionType: string): RdmActivityBucketKey {
  if (GYAN.has(actionType)) return "gyan";
  if (PLAY.has(actionType)) return "play";
  if (REVISION.has(actionType)) return "revision";
  /** Mocks use other tables; unknown daily actions default to Play until mapped here */
  return "play";
}

export function istYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Inclusive rolling window in IST calendar days ending today (IST). */
export function rollingIstDateRangeInclusive(days: number): { fromIst: string; toIst: string } {
  const safe = Math.max(1, Math.min(Math.floor(days), 366));
  const toIst = istYmd(new Date());
  let cursor = new Date();
  for (let i = 0; i < safe - 1; i++) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return { fromIst: istYmd(cursor), toIst };
}

export function istYmdInRange(ymd: string, fromIst: string, toIst: string): boolean {
  return ymd >= fromIst && ymd <= toIst;
}

/** UI bucket for icons / grouping — aligns with `bucketForDailyRewardAction`. */
export type RdmClaimCategory = "gyan" | "play" | "mocks" | "revision";

/**
 * Human-readable labels for `daily_reward_claims.action_type`.
 * Keep in sync with CHECK constraints / migrations.
 */
export function describeDailyRewardClaim(actionType: string): {
  category: RdmClaimCategory;
  title: string;
  detail: string;
} {
  switch (actionType) {
    case "ASK":
      return { category: "gyan", title: "Gyan++ · Ask", detail: "Question posted (daily IST cap)" };
    case "COMMENT":
      return {
        category: "gyan",
        title: "Gyan++ · Comment",
        detail: "Answer or reply (daily IST cap)",
      };
    case "UPVOTE":
      return { category: "gyan", title: "Gyan++ · Upvote", detail: "Vote reward (daily IST cap)" };
    case "SAVE":
      return {
        category: "gyan",
        title: "Gyan++ · Save",
        detail: "Bookmark / save (daily IST cap)",
      };
    case "TOPIC_QUIZ_ADVANCED_60":
      return {
        category: "play",
        title: "Play · Topic quiz (advanced)",
        detail: "Quant Blitz / curriculum quizzes — 60+ tier",
      };
    case "NUMERALS_PACK_COMPLETE":
      return {
        category: "play",
        title: "Play · Numerals pack",
        detail: "Logic Maze numerals completion",
      };
    case "DAILY_DOSE_ACADEMIC":
      return {
        category: "play",
        title: "Play · DailyDose (academic)",
        detail: "DailyDose gauntlet · academic domain",
      };
    case "DAILY_DOSE_FUNBRAIN":
      return {
        category: "play",
        title: "Play · DailyDose (funbrain)",
        detail: "DailyDose gauntlet · funbrain domain",
      };
    case "DAILY_DOSE_STREAK_7":
      return {
        category: "play",
        title: "Play · DailyDose 7-day streak",
        detail: "Streak milestone bonus",
      };
    case "DAILY_DOSE_STREAK_30":
      return {
        category: "play",
        title: "Play · DailyDose 30-day streak",
        detail: "Streak milestone bonus",
      };
    case "INSTACUE_CREATE":
      return {
        category: "revision",
        title: "Revision · InstaCue",
        detail: "First InstaCue card created that IST day",
      };
    default: {
      const b = bucketForDailyRewardAction(actionType);
      return {
        category: b,
        title:
          b === "gyan"
            ? `Gyan++ · ${actionType}`
            : b === "revision"
              ? `Revision · ${actionType}`
              : b === "mocks"
                ? `Mocks · ${actionType}`
                : `Play · ${actionType}`,
        detail: "Daily reward claim (IST)",
      };
    }
  }
}
