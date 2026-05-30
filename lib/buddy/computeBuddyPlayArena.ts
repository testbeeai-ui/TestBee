import { computeStreakDays } from "@/lib/dashboard/gauntletStreak";
import { bucketForDailyRewardAction, istYmd } from "@/lib/rdm/rdmRecentByActivity";
import type { RdmConfigParams } from "@/lib/rdm/rdmConfig";

export type BuddyPlayArenaStats = {
  rdmEarnedToday: number;
  rdmEarnedLast7Days: number;
  gauntletStreakDays: number;
  gauntletDaysLast30: number;
  challengesClaimedToday: number;
  challengesClaimedLast7Days: number;
};

type DailyRewardClaimRow = {
  action_type: string;
  points_awarded: number | null;
  claim_date_ist: string;
};

type ReferChallengeClaimRow = {
  challenge_key: string;
  win_claimed: boolean;
  share_claimed: boolean;
  claim_date: string;
};

export function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function istDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function referRewardAmount(
  challengeKey: string,
  kind: "win" | "share",
  cfg: RdmConfigParams
): number {
  switch (challengeKey) {
    case "5":
      return kind === "win" ? cfg.challenge_5_win : cfg.challenge_5_share;
    case "10":
      return kind === "win" ? cfg.challenge_10_win : cfg.challenge_10_share;
    case "20":
      return kind === "win" ? cfg.challenge_20_win : cfg.challenge_20_share;
    case "50":
      return kind === "win" ? cfg.challenge_50_win : cfg.challenge_50_share;
    default:
      return 0;
  }
}

function countReferClaims(row: ReferChallengeClaimRow): number {
  let n = 0;
  if (row.win_claimed) n += 1;
  if (row.share_claimed) n += 1;
  return n;
}

/** Play Arena tile stats for a buddy (aligned with Refer & Earn play sources). */
export function computeBuddyPlayArena(input: {
  istToday: string;
  utcClaimDate: string;
  rewardClaims: DailyRewardClaimRow[];
  referClaims: ReferChallengeClaimRow[];
  gauntletDates: string[];
  rdmConfig: RdmConfigParams;
}): BuddyPlayArenaStats {
  const istSince7 = istDateDaysAgo(6);
  const utcSince7 = new Date();
  utcSince7.setUTCDate(utcSince7.getUTCDate() - 6);
  const utcSince7Str = utcSince7.toISOString().slice(0, 10);
  const istSince30 = istDateDaysAgo(29);

  let rdmFromPlayMilestonesToday = 0;
  let rdmFromPlayMilestones7d = 0;
  for (const row of input.rewardClaims) {
    if (bucketForDailyRewardAction(row.action_type) !== "play") continue;
    const pts = Math.max(0, Number(row.points_awarded ?? 0));
    if (row.claim_date_ist === input.istToday) rdmFromPlayMilestonesToday += pts;
    if (row.claim_date_ist >= istSince7) rdmFromPlayMilestones7d += pts;
  }

  let rdmFromReferToday = 0;
  let rdmFromRefer7d = 0;
  let challengesClaimedToday = 0;
  let challengesClaimedLast7Days = 0;
  for (const row of input.referClaims) {
    const claims = countReferClaims(row);
    if (row.claim_date === input.utcClaimDate) {
      challengesClaimedToday += claims;
      if (row.win_claimed) {
        rdmFromReferToday += referRewardAmount(row.challenge_key, "win", input.rdmConfig);
      }
      if (row.share_claimed) {
        rdmFromReferToday += referRewardAmount(row.challenge_key, "share", input.rdmConfig);
      }
    }
    if (row.claim_date >= utcSince7Str) {
      challengesClaimedLast7Days += claims;
      if (row.win_claimed) {
        rdmFromRefer7d += referRewardAmount(row.challenge_key, "win", input.rdmConfig);
      }
      if (row.share_claimed) {
        rdmFromRefer7d += referRewardAmount(row.challenge_key, "share", input.rdmConfig);
      }
    }
  }

  const gauntletStreakDays = computeStreakDays(input.gauntletDates, istYmd(new Date()));
  const gauntletDaysLast30 = input.gauntletDates.filter((d) => d >= istSince30).length;

  return {
    rdmEarnedToday: rdmFromPlayMilestonesToday + rdmFromReferToday,
    rdmEarnedLast7Days: rdmFromPlayMilestones7d + rdmFromRefer7d,
    gauntletStreakDays,
    gauntletDaysLast30,
    challengesClaimedToday,
    challengesClaimedLast7Days,
  };
}
