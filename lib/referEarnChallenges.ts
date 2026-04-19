import type { PlayDomain } from "@/types";

export type ReferClaimKey = "5" | "10" | "20" | "50";

/** Refer & Earn RDM targets — separate rules from /play Daily Gauntlet or streak. */
export type ReferChallengePublicSpec = {
  key: ReferClaimKey;
  rdm: number;
  domain: PlayDomain;
  /** Supabase `get_adaptive_play_questions` sentinel or tab category (academic refer = `academic_all`, same cycle as Play Streak Survival). */
  playCategory: string;
  questionCount: number;
  sessionMinutes: number;
  /** Minimum correct answers required to “win” (RDM copy / investor spec). */
  minCorrect: number;
  typeLabel: string;
  name: string;
  /** Primary line on selection cards */
  cardDesc: string;
  cardSubline: string;
  accent: string;
  selClass: string;
  headerEmoji: string;
  /** Lower pill in detail header row */
  categoryPill: string;
};

export const REFER_CHALLENGE_SPECS: ReferChallengePublicSpec[] = [
  {
    key: "5",
    rdm: 5,
    domain: "funbrain",
    playCategory: "mental_math",
    questionCount: 10,
    sessionMinutes: 5,
    minCorrect: 6,
    typeLabel: "Non-Academic",
    name: "MentaMill Blitz",
    cardDesc: "Mental math only · 10 questions · 5 minutes",
    cardSubline: "Medium difficulty",
    accent: "text-sky-400",
    selClass: "ring-sky-500/50 after:bg-sky-500/20",
    headerEmoji: "⚡",
    categoryPill: "Non-academic",
  },
  {
    key: "10",
    rdm: 10,
    domain: "funbrain",
    /** Mixed pool; refer fetch uses `funbrain_all` (see `fetchReferChallengeQuestions`). */
    playCategory: "funbrain_all",
    questionCount: 15,
    sessionMinutes: 7,
    minCorrect: 9,
    typeLabel: "Non-Academic",
    name: "FunBrain Quiz",
    cardDesc: "All Funbrain topics — verbal, quant, analytical, puzzles, GK, mental math",
    cardSubline: "15 questions · 7 minutes",
    accent: "text-emerald-400",
    selClass: "ring-emerald-500/50 after:bg-emerald-500/20",
    headerEmoji: "🧠",
    categoryPill: "Non-academic",
  },
  {
    key: "20",
    rdm: 20,
    domain: "academic",
    playCategory: "academic_all",
    questionCount: 10,
    sessionMinutes: 10,
    minCorrect: 6,
    typeLabel: "Academic",
    name: "Academic Arena",
    cardDesc: "PCM assorted · Medium difficulty",
    cardSubline: "10 questions · 10 minutes",
    accent: "text-violet-400",
    selClass: "ring-violet-500/50 after:bg-violet-500/20",
    headerEmoji: "🎓",
    categoryPill: "PCM academic",
  },
  {
    key: "50",
    rdm: 50,
    domain: "academic",
    playCategory: "academic_all",
    questionCount: 25,
    sessionMinutes: 25,
    minCorrect: 15,
    typeLabel: "Academic",
    name: "Academic Arena Pro",
    cardDesc: "PCM assorted · Medium + tough difficulty",
    cardSubline: "25 questions · 25 minutes",
    accent: "text-amber-400",
    selClass: "ring-amber-500/50 after:bg-amber-500/20",
    headerEmoji: "🏆",
    categoryPill: "PCM academic",
  },
];

export function referChallengeSpec(key: ReferClaimKey): ReferChallengePublicSpec | undefined {
  return REFER_CHALLENGE_SPECS.find((s) => s.key === key);
}

export function referChallengeDayKey(userId: string, day: string): string {
  return `testbee_refer_rdm_challenge_${userId}_${day}`;
}

export function readReferChallengesDone(userId: string, day: string): Partial<Record<ReferClaimKey, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(referChallengeDayKey(userId, day));
    if (!raw) return {};
    const p = JSON.parse(raw) as Partial<Record<ReferClaimKey, boolean>>;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

export function markReferChallengeDone(userId: string, day: string, key: ReferClaimKey): void {
  try {
    const cur = readReferChallengesDone(userId, day);
    cur[key] = true;
    localStorage.setItem(referChallengeDayKey(userId, day), JSON.stringify(cur));
  } catch {
    /* ignore */
  }
}
