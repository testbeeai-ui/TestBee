import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileRank = "Novice" | "Scholar" | "Expert" | "Master";

export interface AcademicRecord {
  exam: string;
  board: string;
  score: string;
  verified: "verified" | "pending" | "unverified";
}

export interface Achievement {
  name: string;
  level: "School" | "District" | "State" | "National" | "International";
  year: number;
  result: string;
}

export interface RdmBreakdown {
  answersGiven: number;
  acceptedBonus: number;
  mockTests: number;
  streakBonus: number;
  bountiesWon: number;
  doubtsAsked: number;
}

export interface SubjectStats {
  physics: number;
  chemistry: number;
  math: number;
  biology: number;
}

export interface PublicProfile {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  avatarUrl: string | null;
  bio: string | null;
  rdm: number;
  rank: ProfileRank;
  memberSince: string;
  questionsAsked: number;
  answersGiven: number;
  acceptedAnswers: number;
  strikeRate: number;
  subjectStats: SubjectStats;
  rdmFromDoubts: number;
  bountiesWon: number;
  streakDays: number;
  badges: string[];
  recentDoubts: { id: string; title: string }[];
  recentAnswers: { id: string; doubtId: string; title: string }[];
  nextRankRdm: number;
  academics: AcademicRecord[];
  achievements: Achievement[];
  rdmBreakdown: RdmBreakdown;
}

const RANK_THRESHOLDS: { rdm: number; rank: ProfileRank }[] = [
  { rdm: 0, rank: "Novice" },
  { rdm: 100, rank: "Scholar" },
  { rdm: 250, rank: "Expert" },
  { rdm: 500, rank: "Master" },
];

const RANK_NEXT_RDM: Record<ProfileRank, number> = {
  Novice: 100,
  Scholar: 250,
  Expert: 500,
  Master: 1000,
};

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function getRankFromRdm(rdm: number): ProfileRank {
  let rank: ProfileRank = "Novice";
  for (const t of RANK_THRESHOLDS) {
    if (rdm >= t.rdm) rank = t.rank;
  }
  return rank;
}

function getInitials(name: string | null): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash << 5) - hash + userId.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Compute consecutive streak days from gauntlet dates (most recent first) */
function computeStreakDays(dates: string[]): number {
  if (dates.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  const mostRecent = sorted[0];
  const oneDayAgo = prevDay(today);
  if (mostRecent !== today && mostRecent !== oneDayAgo) return 0;
  let count = 0;
  let expect = mostRecent;
  for (const d of sorted) {
    if (d !== expect) break;
    count++;
    expect = prevDay(expect);
  }
  return count;
}
function prevDay(d: string): string {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** Derive badges from real profile stats */
function deriveBadges(
  acceptedAnswers: number,
  streakDays: number,
  bountiesWon: number,
  questionsAsked: number,
): string[] {
  const badges: string[] = [];
  if (acceptedAnswers >= 25) badges.push("Top Contributor");
  if (acceptedAnswers >= 10) badges.push("Answerer");
  if (streakDays >= 7) badges.push("Streak Master");
  if (streakDays >= 3) badges.push("Consistent");
  if (bountiesWon >= 5) badges.push("Bounty Hunter");
  if (bountiesWon >= 1) badges.push("Bounty Winner");
  if (questionsAsked >= 10) badges.push("Curious Mind");
  return badges;
}

async function fetchOptional<T>(
  fn: () => Promise<{ data: T | null; error?: unknown }>,
  fallback: T
): Promise<T> {
  try {
    const res = await fn();
    if (res.error) return fallback;
    return (res.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export async function getPublicProfile(userId: string, client?: SupabaseClient): Promise<PublicProfile | null> {
  const db = client ?? supabase;
  const [profileRes, doubtsRes, answersRes, subjectStatsRes, payoutsRes, gauntletRes, playHistoryRes] = await Promise.all([
    db
      .from("profiles")
      .select("id, name, bio, rdm, created_at, avatar_url, lifetime_answer_rdm")
      .eq("id", userId)
      .maybeSingle(),
    db
      .from("doubts")
      .select("id, title, subject")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3),
    db
      .from("doubt_answers")
      .select("id, doubt_id, body")
      .eq("user_id", userId)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("doubts")
      .select("id, title, subject")
      .eq("user_id", userId),
    db
      .from("accepted_answer_payouts")
      .select("rdm_paid")
      .eq("user_id", userId),
    db
      .from("daily_gauntlet_attempts")
      .select("gauntlet_date")
      .eq("user_id", userId),
    db
      .from("play_history")
      .select("id")
      .eq("user_id", userId),
  ]);

  const profile = profileRes.data;
  if (!profile) return null;

  const academicsRes = await fetchOptional(
    async () => (await db.from("profile_academics").select("exam, board, score, verified").eq("user_id", userId).order("created_at", { ascending: true })),
    [] as { exam: string; board: string; score: string; verified: string }[]
  );
  const achievementsRes = await fetchOptional(
    async () => (await db.from("profile_achievements").select("name, level, year, result").eq("user_id", userId).order("year", { ascending: false })),
    [] as { name: string; level: string; year: number; result: string }[]
  );

  const doubts = doubtsRes.data ?? [];
  const questionsAskedRes = await db
    .from("doubts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const questionsAsked = questionsAskedRes.count ?? 0;
  const answers = answersRes.data ?? [];

  const answerDoubtIds = [...new Set(answers.map((a) => a.doubt_id))];
  const { data: answerDoubts } = answerDoubtIds.length
    ? await db.from("doubts").select("id, title, subject").in("id", answerDoubtIds)
    : { data: [] };
  const doubtTitleMap = Object.fromEntries((answerDoubts ?? []).map((d) => [d.id, d.title ?? ""]));

  const answersGivenRes = await db
    .from("doubt_answers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("hidden", false);
  const answersGiven = answersGivenRes.count ?? 0;
  const acceptedRes = await db
    .from("doubt_answers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_accepted", true)
    .eq("hidden", false);
  const acceptedAnswers = acceptedRes.count ?? 0;

  const subjectCounts: Record<string, number> = { physics: 0, chemistry: 0, math: 0, biology: 0 };
  const askedDoubts = subjectStatsRes.data ?? [];
  for (const d of askedDoubts) {
    const sub = ((d as { subject?: string }).subject || "").toLowerCase();
    if (sub in subjectCounts) subjectCounts[sub]++;
  }
  for (const d of answerDoubts ?? []) {
    const sub = (d.subject || "").toLowerCase();
    if (sub in subjectCounts) subjectCounts[sub]++;
  }

  const rdm = profile.rdm ?? 0;
  const rank = getRankFromRdm(rdm);
  const nextRankRdm = RANK_NEXT_RDM[rank];
  const lifetimeRdm = (profile as { lifetime_answer_rdm?: number }).lifetime_answer_rdm ?? 0;

  const payouts = payoutsRes.data ?? [];
  const bountiesWon = payouts.length;
  const acceptedBonusRdm = payouts.reduce((sum, p) => sum + (p.rdm_paid ?? 0), 0);
  const gauntletDates = (gauntletRes.data ?? []).map((g) => g.gauntlet_date);
  const streakDays = computeStreakDays(gauntletDates);
  const mockTestsCount = (playHistoryRes.data ?? []).length;
  const badges = deriveBadges(acceptedAnswers, streakDays, bountiesWon, questionsAsked);

  const rdmBreakdown: RdmBreakdown = {
    answersGiven: lifetimeRdm > 0 ? Math.max(0, Math.floor(lifetimeRdm - acceptedBonusRdm)) : 0,
    acceptedBonus: Math.round(acceptedBonusRdm),
    mockTests: mockTestsCount,
    streakBonus: Math.min(50, streakDays * 5),
    bountiesWon,
    doubtsAsked: questionsAsked,
  };

  const academics: AcademicRecord[] = (Array.isArray(academicsRes) ? academicsRes : []).map((a) => ({
    exam: a.exam ?? "",
    board: a.board ?? "",
    score: a.score ?? "",
    verified: (a.verified as AcademicRecord["verified"]) ?? "unverified",
  }));

  const achievements: Achievement[] = (Array.isArray(achievementsRes) ? achievementsRes : []).map((a) => ({
    name: a.name ?? "",
    level: (a.level as Achievement["level"]) ?? "School",
    year: a.year ?? new Date().getFullYear(),
    result: a.result ?? "",
  }));

  const recentAnswersWithTitles = answers.slice(0, 3).map((a) => ({
    id: a.id,
    doubtId: a.doubt_id,
    title: doubtTitleMap[a.doubt_id] || "Answer",
  }));

  return {
    id: profile.id,
    name: profile.name || "Unknown",
    initials: getInitials(profile.name),
    avatarColor: getAvatarColor(profile.id),
    avatarUrl: profile.avatar_url ?? null,
    bio: profile.bio ?? null,
    rdm,
    rank,
    memberSince: new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    questionsAsked,
    answersGiven,
    acceptedAnswers,
    strikeRate: answersGiven > 0 ? Math.round((acceptedAnswers / answersGiven) * 100) : 0,
    subjectStats: {
      physics: subjectCounts.physics || 0,
      chemistry: subjectCounts.chemistry || 0,
      math: subjectCounts.math || 0,
      biology: subjectCounts.biology || 0,
    },
    rdmFromDoubts: lifetimeRdm,
    bountiesWon,
    streakDays,
    badges,
    recentDoubts: doubts.map((d) => ({ id: d.id, title: d.title })),
    recentAnswers: recentAnswersWithTitles,
    nextRankRdm,
    academics,
    achievements,
    rdmBreakdown,
  };
}

/** Minimal profile row shape (from auth) - used when profile table read fails after backfill. */
export type MinimalProfileRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio?: string | null;
  rdm?: number;
  created_at: string;
  lifetime_answer_rdm?: number;
};

/**
 * Builds a full PublicProfile using a minimal profile row + real data from DB.
 * Fetches doubts, answers, academics, achievements, etc. - so the result has real stats.
 */
export async function getPublicProfileWithProfileRow(
  userId: string,
  profileRow: MinimalProfileRow,
  client?: SupabaseClient
): Promise<PublicProfile> {
  const db = client ?? supabase;
  const profile = {
    id: profileRow.id,
    name: profileRow.name || "Unknown",
    bio: profileRow.bio ?? null,
    rdm: profileRow.rdm ?? 0,
    created_at: profileRow.created_at,
    avatar_url: profileRow.avatar_url ?? null,
    lifetime_answer_rdm: profileRow.lifetime_answer_rdm ?? 0,
  };

  const [doubtsRes, answersRes, subjectStatsRes, payoutsRes, gauntletRes, playHistoryRes] = await Promise.all([
    db.from("doubts").select("id, title, subject").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
    db.from("doubt_answers").select("id, doubt_id, body").eq("user_id", userId).eq("hidden", false).order("created_at", { ascending: false }).limit(10),
    db.from("doubts").select("id, title, subject").eq("user_id", userId),
    db.from("accepted_answer_payouts").select("rdm_paid").eq("user_id", userId),
    db.from("daily_gauntlet_attempts").select("gauntlet_date").eq("user_id", userId),
    db.from("play_history").select("id").eq("user_id", userId),
  ]);

  const academicsRes = await fetchOptional(
    async () => (await db.from("profile_academics").select("exam, board, score, verified").eq("user_id", userId).order("created_at", { ascending: true })),
    [] as { exam: string; board: string; score: string; verified: string }[]
  );
  const achievementsRes = await fetchOptional(
    async () => (await db.from("profile_achievements").select("name, level, year, result").eq("user_id", userId).order("year", { ascending: false })),
    [] as { name: string; level: string; year: number; result: string }[]
  );

  const doubts = doubtsRes.data ?? [];
  const questionsAskedRes = await db.from("doubts").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const questionsAsked = questionsAskedRes.count ?? 0;
  const answers = answersRes.data ?? [];
  const answerDoubtIds = [...new Set(answers.map((a) => a.doubt_id))];
  const { data: answerDoubts } = answerDoubtIds.length ? await db.from("doubts").select("id, title, subject").in("id", answerDoubtIds) : { data: [] };
  const doubtTitleMap = Object.fromEntries((answerDoubts ?? []).map((d) => [d.id, d.title ?? ""]));
  const answersGivenRes = await db.from("doubt_answers").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("hidden", false);
  const answersGiven = answersGivenRes.count ?? 0;
  const acceptedRes = await db.from("doubt_answers").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_accepted", true).eq("hidden", false);
  const acceptedAnswers = acceptedRes.count ?? 0;

  const subjectCounts: Record<string, number> = { physics: 0, chemistry: 0, math: 0, biology: 0 };
  const askedDoubts = subjectStatsRes.data ?? [];
  for (const d of askedDoubts) {
    const sub = ((d as { subject?: string }).subject || "").toLowerCase();
    if (sub in subjectCounts) subjectCounts[sub]++;
  }
  for (const d of answerDoubts ?? []) {
    const sub = (d.subject || "").toLowerCase();
    if (sub in subjectCounts) subjectCounts[sub]++;
  }

  const rdm = profile.rdm ?? 0;
  const rank = getRankFromRdm(rdm);
  const nextRankRdm = RANK_NEXT_RDM[rank];
  const lifetimeRdm = profile.lifetime_answer_rdm ?? 0;
  const payouts = payoutsRes.data ?? [];
  const bountiesWon = payouts.length;
  const acceptedBonusRdm = payouts.reduce((sum, p) => sum + (p.rdm_paid ?? 0), 0);
  const gauntletDates = (gauntletRes.data ?? []).map((g) => g.gauntlet_date);
  const streakDays = computeStreakDays(gauntletDates);
  const mockTestsCount = (playHistoryRes.data ?? []).length;
  const badges = deriveBadges(acceptedAnswers, streakDays, bountiesWon, questionsAsked);

  const rdmBreakdown: RdmBreakdown = {
    answersGiven: lifetimeRdm > 0 ? Math.max(0, Math.floor(lifetimeRdm - acceptedBonusRdm)) : 0,
    acceptedBonus: Math.round(acceptedBonusRdm),
    mockTests: mockTestsCount,
    streakBonus: Math.min(50, streakDays * 5),
    bountiesWon,
    doubtsAsked: questionsAsked,
  };

  const academics: AcademicRecord[] = (Array.isArray(academicsRes) ? academicsRes : []).map((a) => ({
    exam: a.exam ?? "",
    board: a.board ?? "",
    score: a.score ?? "",
    verified: (a.verified as AcademicRecord["verified"]) ?? "unverified",
  }));

  const achievements: Achievement[] = (Array.isArray(achievementsRes) ? achievementsRes : []).map((a) => ({
    name: a.name ?? "",
    level: (a.level as Achievement["level"]) ?? "School",
    year: a.year ?? new Date().getFullYear(),
    result: a.result ?? "",
  }));

  const recentAnswersWithTitles = answers.slice(0, 3).map((a) => ({
    id: a.id,
    doubtId: a.doubt_id,
    title: doubtTitleMap[a.doubt_id] || "Answer",
  }));

  return {
    id: profile.id,
    name: profile.name || "Unknown",
    initials: getInitials(profile.name),
    avatarColor: getAvatarColor(profile.id),
    avatarUrl: profile.avatar_url ?? null,
    bio: profile.bio ?? null,
    rdm,
    rank,
    memberSince: new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    questionsAsked,
    answersGiven,
    acceptedAnswers,
    strikeRate: answersGiven > 0 ? Math.round((acceptedAnswers / answersGiven) * 100) : 0,
    subjectStats: {
      physics: subjectCounts.physics || 0,
      chemistry: subjectCounts.chemistry || 0,
      math: subjectCounts.math || 0,
      biology: subjectCounts.biology || 0,
    },
    rdmFromDoubts: lifetimeRdm,
    bountiesWon,
    streakDays,
    badges,
    recentDoubts: doubts.map((d) => ({ id: d.id, title: d.title })),
    recentAnswers: recentAnswersWithTitles,
    nextRankRdm,
    academics,
    achievements,
    rdmBreakdown,
  };
}
