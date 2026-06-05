import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import {
  bucketForDailyRewardAction,
  describeDailyRewardClaim,
  istYmdInRange,
  rollingIstDateRangeInclusive,
  type RdmClaimCategory,
} from "@/lib/rdm/rdmRecentByActivity";

function istStartIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00+05:30`).toISOString();
}

/** First instant after `toIst` (end-exclusive upper bound for timestamps). */
function istEndExclusiveIso(toIst: string): string {
  const ms = new Date(`${toIst}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

const MIN_CLAIM_LIST_RDM = 1;

export type RecentClaimApi = {
  key: string;
  category: RdmClaimCategory;
  title: string;
  detail: string;
  amount: number;
  at: string;
};

/** GET ?days=28 — bucket sums + last 5 claimed rows with amount > 1 RDM in the IST window. */
export async function GET(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawDays = Number(req.nextUrl.searchParams.get("days") ?? "28");
  const windowDays = Number.isFinite(rawDays)
    ? Math.min(366, Math.max(1, Math.floor(rawDays)))
    : 28;
  const { fromIst, toIst } = rollingIstDateRangeInclusive(windowDays);
  const uid = auth.user.id;

  const sb = auth.supabase as import("@supabase/supabase-js").SupabaseClient;

  const [
    { data: claimRows, error: e1 },
    { data: mockBonusRows, error: e2 },
    { data: mockShareRows, error: e3 },
    { data: quizShareRows, error: e4 },
    { data: numeralsShareRows, error: e5 },
    { data: penaltyRows, error: e6 },
  ] = await Promise.all([
    sb
      .from("daily_reward_claims")
      .select("id,action_type,points_awarded,claim_date_ist,created_at")
      .eq("user_id", uid)
      .gte("claim_date_ist", fromIst)
      .lte("claim_date_ist", toIst),
    sb
      .from("mock_rdm_bonus_claims")
      .select("id,rdm_amount,ist_claim_date,score_percent,created_at")
      .eq("user_id", uid)
      .gte("ist_claim_date", fromIst)
      .lte("ist_claim_date", toIst),
    sb
      .from("mock_community_share_rdm_claims")
      .select("id,rdm_amount,created_at")
      .eq("user_id", uid)
      .gte("created_at", istStartIso(fromIst))
      .lt("created_at", istEndExclusiveIso(toIst)),
    sb
      .from("quiz_community_share_rdm_claims")
      .select("user_id,topic_ref,subtopic_ref,post_id,quiz_set,rdm_amount,claimed_at")
      .eq("user_id", uid)
      .gte("claimed_at", istStartIso(fromIst))
      .lt("claimed_at", istEndExclusiveIso(toIst)),
    sb
      .from("numerals_community_share_rdm_claims")
      .select("user_id,topic_ref,subtopic_ref,post_id,formula_index,rdm_amount,claimed_at")
      .eq("user_id", uid)
      .gte("claimed_at", istStartIso(fromIst))
      .lt("claimed_at", istEndExclusiveIso(toIst)),
    sb
      .from("inactive_day_penalties")
      .select("day,penalty_rdm,penalized_at")
      .eq("user_id", uid)
      .gte("day", fromIst)
      .lte("day", toIst),
  ]);

  const err = e1 ?? e2 ?? e3 ?? e4 ?? e5 ?? e6;
  if (err) {
    console.error("[rdm-recent-by-activity]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const sums = { gyan: 0, play: 0, mocks: 0, revision: 0 };

  type ClaimRow = {
    id: string;
    action_type: string;
    points_awarded: number;
    claim_date_ist: string;
    created_at: string;
  };
  for (const row of (claimRows ?? []) as ClaimRow[]) {
    if (!istYmdInRange(row.claim_date_ist, fromIst, toIst)) continue;
    const b = bucketForDailyRewardAction(row.action_type);
    sums[b] += row.points_awarded ?? 0;
  }

  type MockBonusRow = {
    id: string;
    rdm_amount: number;
    ist_claim_date: string;
    score_percent: number;
    created_at: string;
  };
  for (const row of (mockBonusRows ?? []) as MockBonusRow[]) {
    if (!istYmdInRange(row.ist_claim_date, fromIst, toIst)) continue;
    sums.mocks += row.rdm_amount ?? 0;
  }

  type AmountRow = { rdm_amount: number };
  for (const row of (mockShareRows ?? []) as AmountRow[]) {
    sums.mocks += row.rdm_amount ?? 0;
  }
  for (const row of (quizShareRows ?? []) as AmountRow[]) {
    sums.play += row.rdm_amount ?? 0;
  }
  for (const row of (numeralsShareRows ?? []) as AmountRow[]) {
    sums.play += row.rdm_amount ?? 0;
  }

  let totalPenalties = 0;
  type PenaltyRow = {
    day: string;
    penalty_rdm: number;
    penalized_at: string;
  };
  for (const row of (penaltyRows ?? []) as PenaltyRow[]) {
    totalPenalties += row.penalty_rdm ?? 50;
  }

  const totalInWindow = sums.gyan + sums.play + sums.mocks + sums.revision - totalPenalties;

  const recentRaw: RecentClaimApi[] = [];

  for (const row of (claimRows ?? []) as ClaimRow[]) {
    if (!istYmdInRange(row.claim_date_ist, fromIst, toIst)) continue;
    const amt = row.points_awarded ?? 0;
    if (amt <= MIN_CLAIM_LIST_RDM) continue;
    const { category, title, detail } = describeDailyRewardClaim(row.action_type);
    recentRaw.push({
      key: `daily:${row.id}`,
      category,
      title,
      detail,
      amount: amt,
      at: row.created_at,
    });
  }

  for (const row of (mockBonusRows ?? []) as MockBonusRow[]) {
    if (!istYmdInRange(row.ist_claim_date, fromIst, toIst)) continue;
    const amt = row.rdm_amount ?? 0;
    if (amt <= MIN_CLAIM_LIST_RDM) continue;
    recentRaw.push({
      key: `mock_bonus:${row.id}`,
      category: "mocks",
      title: "Mock test · Score bonus",
      detail: `${row.score_percent}% adaptive mock · IST claim`,
      amount: amt,
      at: row.created_at,
    });
  }

  type MockShareRow = { id: string; rdm_amount: number; created_at: string };
  for (const row of (mockShareRows ?? []) as MockShareRow[]) {
    const amt = row.rdm_amount ?? 0;
    if (amt <= MIN_CLAIM_LIST_RDM) continue;
    recentRaw.push({
      key: `mock_share:${row.id}`,
      category: "mocks",
      title: "Mock · Community share",
      detail: "Posted mock results to community",
      amount: amt,
      at: row.created_at,
    });
  }

  type QuizShareRow = {
    user_id: string;
    topic_ref: string;
    subtopic_ref: string;
    post_id: string;
    quiz_set: number;
    rdm_amount: number;
    claimed_at: string;
  };
  for (const row of (quizShareRows ?? []) as QuizShareRow[]) {
    const amt = row.rdm_amount ?? 0;
    if (amt <= MIN_CLAIM_LIST_RDM) continue;
    recentRaw.push({
      key: `quiz_share:${row.post_id}:${row.claimed_at}`,
      category: "play",
      title: "Play · Quiz community share",
      detail: `${row.topic_ref} · set ${row.quiz_set}`,
      amount: amt,
      at: row.claimed_at,
    });
  }

  type NumeralsShareRow = {
    post_id: string;
    topic_ref: string;
    subtopic_ref: string;
    formula_index: number;
    rdm_amount: number;
    claimed_at: string;
  };
  for (const row of (numeralsShareRows ?? []) as NumeralsShareRow[]) {
    const amt = row.rdm_amount ?? 0;
    if (amt <= MIN_CLAIM_LIST_RDM) continue;
    recentRaw.push({
      key: `numerals_share:${row.post_id}:${row.claimed_at}`,
      category: "play",
      title: "Play · Numerals community share",
      detail: `${row.topic_ref} · formula #${row.formula_index + 1}`,
      amount: amt,
      at: row.claimed_at,
    });
  }

  for (const row of (penaltyRows ?? []) as PenaltyRow[]) {
    const amt = row.penalty_rdm ?? 50;
    recentRaw.push({
      key: `penalty:${row.day}`,
      category: "penalty" as any,
      title: "Inactive day penalty",
      detail: `Under 30m on completed day ${row.day}`,
      amount: -amt,
      at: row.penalized_at,
    });
  }

  recentRaw.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const recentClaims = recentRaw.slice(0, 5);

  return NextResponse.json({
    windowDays,
    fromIst,
    toIst,
    ...sums,
    totalInWindow,
    recentClaims,
    minListRdm: MIN_CLAIM_LIST_RDM + 1,
  });
}
