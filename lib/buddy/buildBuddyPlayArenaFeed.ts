import { buildPlaySessionsFromAttempts } from "@/lib/admin/adminPlaySessions";
import {
  bucketForDailyRewardAction,
  describeDailyRewardClaim,
  istYmd,
} from "@/lib/rdm/rdmRecentByActivity";
import type { RdmConfigParams } from "@/lib/rdm/rdmConfig";

export type BuddyPlayRecentActivity = {
  id: string;
  kind: "daily_dose" | "quant_blitz" | "numerals" | "challenge" | "streak_bonus" | "other";
  title: string;
  subtitle: string;
  rdmBadge: string | null;
  href: string;
  occurredAt: string;
};

export type BuddyPlayArenaFeed = {
  recent: BuddyPlayRecentActivity[];
  playRdmMissedToday: number;
  blitzRoundsToday: number;
};

type RewardClaimRow = {
  id: string;
  action_type: string;
  points_awarded: number | null;
  claim_date_ist: string;
  created_at: string;
};

type GauntletRow = {
  gauntlet_date: string;
  domain: string;
  correct_count: number;
  completed_at: string;
};

type PlayHistoryRow = {
  id: string;
  created_at: string;
  is_correct: boolean;
  pool_key: string | null;
};

type ReferClaimRow = {
  challenge_key: string;
  win_claimed: boolean;
  share_claimed: boolean;
  claim_date: string;
};

const BLITZ_POOL_SUFFIX = "_all";

function formatIstTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function playHrefForAction(actionType: string): string {
  switch (actionType) {
    case "DAILY_DOSE_ACADEMIC":
      return "/play?domain=academic";
    case "DAILY_DOSE_FUNBRAIN":
      return "/play?domain=funbrain";
    case "TOPIC_QUIZ_ADVANCED_60":
      return "/play?domain=academic";
    case "NUMERALS_PACK_COMPLETE":
      return "/play?domain=funbrain";
    default:
      return "/play";
  }
}

function playHrefForDomain(domain: string): string {
  if (domain === "academic") return "/play?domain=academic";
  if (domain === "funbrain") return "/play?domain=funbrain";
  return "/play";
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

function claimToActivity(
  row: RewardClaimRow,
  gauntletByKey: Map<string, GauntletRow>,
  minQuestions: number
): BuddyPlayRecentActivity | null {
  if (bucketForDailyRewardAction(row.action_type) !== "play") return null;

  const pts = Math.max(0, Number(row.points_awarded ?? 0));
  const rdmBadge = pts > 0 ? `+${pts} RDM` : null;
  const timeLabel = formatIstTime(row.created_at);
  const desc = describeDailyRewardClaim(row.action_type);

  let kind: BuddyPlayRecentActivity["kind"] = "other";
  let title = desc.title.replace(/^Play · /, "");
  let subtitle = `${timeLabel} · ${desc.detail}`;
  let href = playHrefForAction(row.action_type);

  const gauntletKey =
    row.action_type === "DAILY_DOSE_ACADEMIC"
      ? `${row.claim_date_ist}:academic`
      : row.action_type === "DAILY_DOSE_FUNBRAIN"
        ? `${row.claim_date_ist}:funbrain`
        : null;
  const gauntlet = gauntletKey ? gauntletByKey.get(gauntletKey) : undefined;
  const totalQ = Math.max(minQuestions, gauntlet?.correct_count ?? minQuestions);

  switch (row.action_type) {
    case "DAILY_DOSE_ACADEMIC":
    case "DAILY_DOSE_FUNBRAIN": {
      kind = "daily_dose";
      const correct = gauntlet?.correct_count ?? totalQ;
      const domainLabel =
        row.action_type === "DAILY_DOSE_ACADEMIC" ? "academic" : "funbrain";
      title = `DailyDose — ${correct}/${totalQ} correct`;
      subtitle =
        correct >= totalQ
          ? `${timeLabel} · full score · ${domainLabel}`
          : `${timeLabel} · ${domainLabel}`;
      break;
    }
    case "TOPIC_QUIZ_ADVANCED_60":
      kind = "quant_blitz";
      title = "Quant Blitz · advanced tier";
      subtitle = `${timeLabel} · topic quiz`;
      break;
    case "NUMERALS_PACK_COMPLETE":
      kind = "numerals";
      title = "Logic Maze · Numerals";
      subtitle = `${timeLabel} · pack complete`;
      break;
    case "DAILY_DOSE_STREAK_7":
    case "DAILY_DOSE_STREAK_30":
      kind = "streak_bonus";
      title = row.action_type === "DAILY_DOSE_STREAK_7" ? "DailyDose · 7-day streak" : "DailyDose · 30-day streak";
      subtitle = timeLabel;
      break;
    default:
      title = desc.title.replace(/^Play · /, "");
      subtitle = timeLabel;
  }

  return {
    id: `claim:${row.id}`,
    kind,
    title,
    subtitle,
    rdmBadge,
    href,
    occurredAt: row.created_at,
  };
}

function gauntletSessionActivity(
  row: GauntletRow,
  minQuestions: number,
  rankByDomain: Map<string, number>
): BuddyPlayRecentActivity {
  const totalQ = Math.max(minQuestions, row.correct_count);
  const rank = rankByDomain.get(row.domain);
  const rankLine =
    rank != null && rank > 0 ? `Speed rank #${rank} today` : "Daily gauntlet run";

  return {
    id: `gauntlet:${row.gauntlet_date}:${row.domain}`,
    kind: "daily_dose",
    title: `DailyDose — ${row.correct_count}/${totalQ} correct`,
    subtitle: `${formatIstTime(row.completed_at)} · ${rankLine}`,
    rdmBadge: null,
    href: playHrefForDomain(row.domain),
    occurredAt: row.completed_at,
  };
}

function blitzSessionActivity(
  session: ReturnType<typeof buildPlaySessionsFromAttempts<PlayHistoryRow>>[number],
  rankByDomain: Map<string, number>
): BuddyPlayRecentActivity {
  const pool = session.distinctPoolKeys.find((k) => k.endsWith(BLITZ_POOL_SUFFIX)) ?? "academic_all";
  const domain = pool.startsWith("funbrain") ? "funbrain" : "academic";
  const rank = rankByDomain.get(domain);

  return {
    id: `blitz:${session.id}`,
    kind: "quant_blitz",
    title: `Quant Blitz · ${session.correctCount} correct`,
    subtitle:
      rank != null && rank > 0
        ? `Speed rank #${rank} today`
        : `${formatIstTime(session.endedAt)} · streak track`,
    rdmBadge: null,
    href: playHrefForDomain(domain),
    occurredAt: session.endedAt,
  };
}

function referClaimActivities(
  rows: ReferClaimRow[],
  cfg: RdmConfigParams,
  utcToday: string
): BuddyPlayRecentActivity[] {
  const out: BuddyPlayRecentActivity[] = [];
  for (const row of rows) {
    if (row.claim_date !== utcToday) continue;
    if (row.win_claimed) {
      const pts = referRewardAmount(row.challenge_key, "win", cfg);
      out.push({
        id: `refer:${row.challenge_key}:win:${row.claim_date}`,
        kind: "challenge",
        title: `Refer challenge · ${row.challenge_key} referrals`,
        subtitle: "Win claim today",
        rdmBadge: pts > 0 ? `+${pts} RDM` : null,
        href: "/refer-earn",
        occurredAt: `${row.claim_date}T12:00:00.000Z`,
      });
    }
    if (row.share_claimed) {
      const pts = referRewardAmount(row.challenge_key, "share", cfg);
      out.push({
        id: `refer:${row.challenge_key}:share:${row.claim_date}`,
        kind: "challenge",
        title: `Refer challenge · share`,
        subtitle: `${row.challenge_key}-referral tier`,
        rdmBadge: pts > 0 ? `+${pts} RDM` : null,
        href: "/refer-earn",
        occurredAt: `${row.claim_date}T12:00:00.000Z`,
      });
    }
  }
  return out;
}

function isIstToday(iso: string, istToday: string): boolean {
  return istYmd(new Date(iso)) === istToday;
}

/** Recent Play Arena rows + footer stats for buddy dashboard. */
export function buildBuddyPlayArenaFeed(input: {
  istToday: string;
  utcClaimDate: string;
  rewardClaims: RewardClaimRow[];
  referClaims: ReferClaimRow[];
  gauntletAttempts: GauntletRow[];
  playHistory: PlayHistoryRow[];
  rdmConfig: RdmConfigParams;
  gauntletRankByDomain?: Partial<Record<"academic" | "funbrain", number>>;
}): BuddyPlayArenaFeed {
  const minQ = input.rdmConfig.play_dailydose_min_questions_for_rdm;
  const gauntletByKey = new Map<string, GauntletRow>();
  for (const g of input.gauntletAttempts) {
    gauntletByKey.set(`${g.gauntlet_date}:${g.domain}`, g);
  }

  const rankMap = new Map<string, number>();
  if (input.gauntletRankByDomain?.academic != null) {
    rankMap.set("academic", input.gauntletRankByDomain.academic);
  }
  if (input.gauntletRankByDomain?.funbrain != null) {
    rankMap.set("funbrain", input.gauntletRankByDomain.funbrain);
  }

  const fromClaims = input.rewardClaims
    .map((r) => claimToActivity(r, gauntletByKey, minQ))
    .filter((r): r is BuddyPlayRecentActivity => r != null);

  const claimKeys = new Set(
    input.rewardClaims
      .filter((r) => r.claim_date_ist === input.istToday)
      .map((r) =>
        r.action_type === "DAILY_DOSE_ACADEMIC"
          ? `${input.istToday}:academic`
          : r.action_type === "DAILY_DOSE_FUNBRAIN"
            ? `${input.istToday}:funbrain`
            : ""
      )
      .filter(Boolean)
  );

  const fromGauntlet = input.gauntletAttempts
    .filter((g) => g.gauntlet_date === input.istToday)
    .filter((g) => !claimKeys.has(`${g.gauntlet_date}:${g.domain}`))
    .map((g) => gauntletSessionActivity(g, minQ, rankMap));

  const blitzRows = input.playHistory.filter(
    (r) => r.pool_key != null && r.pool_key.endsWith(BLITZ_POOL_SUFFIX)
  );
  const blitzSessions = buildPlaySessionsFromAttempts(blitzRows).filter((s) =>
    isIstToday(s.endedAt, input.istToday)
  );

  const fromBlitz = blitzSessions.map((s) => blitzSessionActivity(s, rankMap));
  const fromRefer = referClaimActivities(input.referClaims, input.rdmConfig, input.utcClaimDate);

  const merged = [...fromClaims, ...fromGauntlet, ...fromBlitz, ...fromRefer]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 5);

  const academicClaimed = input.rewardClaims.some(
    (r) => r.action_type === "DAILY_DOSE_ACADEMIC" && r.claim_date_ist === input.istToday
  );
  const funbrainClaimed = input.rewardClaims.some(
    (r) => r.action_type === "DAILY_DOSE_FUNBRAIN" && r.claim_date_ist === input.istToday
  );
  const academicPlayed = input.gauntletAttempts.some(
    (g) => g.gauntlet_date === input.istToday && g.domain === "academic"
  );
  const funbrainPlayed = input.gauntletAttempts.some(
    (g) => g.gauntlet_date === input.istToday && g.domain === "funbrain"
  );

  let playRdmMissedToday = 0;
  if (!academicClaimed && !academicPlayed) playRdmMissedToday += 1;
  if (!funbrainClaimed && !funbrainPlayed) playRdmMissedToday += 1;

  return {
    recent: merged,
    playRdmMissedToday,
    blitzRoundsToday: blitzSessions.length,
  };
}
