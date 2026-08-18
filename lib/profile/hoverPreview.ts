import { getAvatarColor, type PublicProfile, type ProfileRank } from "@/lib/profile/publicProfileService";

export const HOVER_PREVIEW_MAX_IDS = 50;

/** Cap unique authors warmed per feed attach (page-scoped, not the whole user table). */
export const HOVER_PREVIEW_MAX_PAGE_IDS = 200;

export type HoverPreviewRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  role?: string | null;
  rdm: number;
  created_at: string | null;
  questions_asked: number;
  answers_given: number;
};

export type HoverPreviewBatchFn = (ids: string[]) => Promise<HoverPreviewRow[]>;

function rankFromRdm(rdm: number): ProfileRank {
  if (rdm >= 500) return "Master";
  if (rdm >= 250) return "Expert";
  if (rdm >= 100) return "Scholar";
  return "Novice";
}

function initialsFromName(name: string | null): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function memberSinceLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const EMPTY_RDM = {
  answersGiven: 0,
  acceptedBonus: 0,
  mockTests: 0,
  streakBonus: 0,
  bountiesWon: 0,
  doubtsAsked: 0,
};

/** Map a batched hover row onto the public profile card shape (no extra queries). */
export function hoverPreviewToPublicProfile(row: HoverPreviewRow): PublicProfile {
  const name = row.name?.trim() || "Learner";
  const rdm = Number.isFinite(row.rdm) ? row.rdm : 0;
  const rank = rankFromRdm(rdm);
  const asked = Number.isFinite(row.questions_asked) ? row.questions_asked : 0;
  const answered = Number.isFinite(row.answers_given) ? row.answers_given : 0;
  return {
    id: row.id,
    name,
    initials: initialsFromName(name),
    avatarColor: getAvatarColor(row.id),
    avatarUrl: row.avatar_url,
    bio: null,
    rdm,
    rank,
    memberSince: memberSinceLabel(row.created_at),
    questionsAsked: asked,
    answersGiven: answered,
    acceptedAnswers: 0,
    strikeRate: 0,
    subjectStats: { physics: 0, chemistry: 0, math: 0 },
    rdmFromDoubts: 0,
    bountiesWon: 0,
    streakDays: 0,
    badges: [],
    recentDoubts: [],
    recentAnswers: [],
    nextRankRdm: rank === "Master" ? 1000 : rank === "Expert" ? 500 : rank === "Scholar" ? 250 : 100,
    academics: [],
    achievements: [],
    rdmBreakdown: { ...EMPTY_RDM, answersGiven: answered, doubtsAsked: asked },
  };
}

export function parseHoverPreviewRows(data: unknown): HoverPreviewRow[] {
  if (!Array.isArray(data)) return [];
  const rows: HoverPreviewRow[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object" || !("id" in item)) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== "string") continue;
    rows.push({
      id: rec.id,
      name: typeof rec.name === "string" ? rec.name : null,
      avatar_url: typeof rec.avatar_url === "string" ? rec.avatar_url : null,
      rdm: typeof rec.rdm === "number" ? rec.rdm : Number(rec.rdm) || 0,
      created_at: typeof rec.created_at === "string" ? rec.created_at : null,
      questions_asked:
        typeof rec.questions_asked === "number" ? rec.questions_asked : Number(rec.questions_asked) || 0,
      answers_given:
        typeof rec.answers_given === "number" ? rec.answers_given : Number(rec.answers_given) || 0,
      role: typeof rec.role === "string" ? rec.role : null,
    });
  }
  return rows;
}

export function hoverPreviewHasSubjectBreakdown(profile: PublicProfile): boolean {
  const stats = profile.subjectStats;
  return stats.physics > 0 || stats.chemistry > 0 || stats.math > 0;
}

export function uniqueUserIds(ids: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function chunkIds(ids: string[], size = HOVER_PREVIEW_MAX_IDS): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}
