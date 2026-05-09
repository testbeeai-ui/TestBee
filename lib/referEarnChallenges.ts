import type { PlayDomain } from "@/types";
import { type RdmConfigParams } from "@/lib/rdmConfig";

export type ReferClaimKey = "5" | "10" | "20" | "50";

/** Earn & Learn (refer-earn) RDM targets — separate rules from /play Daily Gauntlet or streak. */
export type ReferChallengePublicSpec = {
  key: ReferClaimKey;
  /** Win reward (auto-credited once/day/challenge after passing). */
  winRdm: number;
  /** Share reward (auto-credited once/day/challenge after you share). */
  shareRdm: number;
  /** Total potential reward = win + share; used for daily cap UX. */
  totalRdm: number;
  domain: PlayDomain;
  /** Supabase `get_adaptive_play_questions` sentinel or tab category (academic refer = `academic_all`, same cycle as Play Streak Survival). */
  playCategory: string;
  questionCount: number;
  sessionMinutes: number;
  /** Added to `sessionMinutes * 60` so sessions can be e.g. 07:20 (FunBrain Quiz). */
  sessionTailSeconds?: number;
  /** Stem-only phase before options appear (wall-clock, same pattern as mentamill doc). */
  readPhaseSec: number;
  /** Options visible for this many seconds at the end of each question window. */
  optionsPhaseSec: number;
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

// Base definitions without the dynamic RDM values
const BASE_SPECS = [
  {
    key: "5" as ReferClaimKey,
    domain: "funbrain" as PlayDomain,
    playCategory: "mental_math",
    questionCount: 10,
    sessionMinutes: 5,
    readPhaseSec: 20,
    optionsPhaseSec: 10,
    minCorrect: 6,
    typeLabel: "Non-Academic",
    name: "MentaMill Blitz",
    cardDesc: "Mental math only · 10 questions · 05:00",
    cardSubline: "Medium difficulty",
    accent: "text-sky-400",
    selClass: "ring-sky-500/50 after:bg-sky-500/20",
    headerEmoji: "⚡",
    categoryPill: "Non-academic",
  },
  {
    key: "10" as ReferClaimKey,
    domain: "funbrain" as PlayDomain,
    playCategory: "funbrain_all",
    questionCount: 15,
    sessionMinutes: 7,
    sessionTailSeconds: 20,
    readPhaseSec: 20,
    optionsPhaseSec: 10,
    minCorrect: 9,
    typeLabel: "Non-Academic",
    name: "FunBrain Quiz",
    cardDesc: "All Funbrain topics — verbal, quant, analytical, puzzles, GK, mental math",
    cardSubline: "15 questions · 07:20",
    accent: "text-emerald-400",
    selClass: "ring-emerald-500/50 after:bg-emerald-500/20",
    headerEmoji: "🧠",
    categoryPill: "Non-academic",
  },
  {
    key: "20" as ReferClaimKey,
    domain: "academic" as PlayDomain,
    playCategory: "academic_all",
    questionCount: 10,
    sessionMinutes: 10,
    readPhaseSec: 50,
    optionsPhaseSec: 10,
    minCorrect: 6,
    typeLabel: "Academic",
    name: "Academic Arena",
    cardDesc: "PCM assorted · Medium difficulty",
    cardSubline: "10 questions · 10:00",
    accent: "text-violet-400",
    selClass: "ring-violet-500/50 after:bg-violet-500/20",
    headerEmoji: "🎓",
    categoryPill: "PCM academic",
  },
  {
    key: "50" as ReferClaimKey,
    domain: "academic" as PlayDomain,
    playCategory: "academic_all",
    questionCount: 25,
    sessionMinutes: 25,
    readPhaseSec: 50,
    optionsPhaseSec: 10,
    minCorrect: 15,
    typeLabel: "Academic",
    name: "Academic Arena Pro",
    cardDesc: "PCM assorted · Medium + tough difficulty",
    cardSubline: "25 questions · 25:00",
    accent: "text-amber-400",
    selClass: "ring-amber-500/50 after:bg-amber-500/20",
    headerEmoji: "🏆",
    categoryPill: "PCM academic",
  },
];

/** Total session length in seconds (includes optional tail, e.g. 7×60+20 for FunBrain). */
export function referChallengeSessionDurationSec(
  spec: Pick<ReferChallengePublicSpec, "sessionMinutes" | "sessionTailSeconds">
): number {
  return spec.sessionMinutes * 60 + (spec.sessionTailSeconds ?? 0);
}

/** Per-question wall-clock window: read phase + options phase. */
export function referChallengePerQuestionTotalSec(
  spec: Pick<ReferChallengePublicSpec, "readPhaseSec" | "optionsPhaseSec">
): number {
  return spec.readPhaseSec + spec.optionsPhaseSec;
}

/** MM:SS for timers and cards (keep digits in clock tokens, not spelled-out units). */
export function formatReferDurationMmSs(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function getReferChallengeSpecs(config: RdmConfigParams): ReferChallengePublicSpec[] {
  return BASE_SPECS.map(base => {
    let winRdm = 0;
    let shareRdm = 0;
    if (base.key === "5") { winRdm = config.challenge_5_win; shareRdm = config.challenge_5_share; }
    if (base.key === "10") { winRdm = config.challenge_10_win; shareRdm = config.challenge_10_share; }
    if (base.key === "20") { winRdm = config.challenge_20_win; shareRdm = config.challenge_20_share; }
    if (base.key === "50") { winRdm = config.challenge_50_win; shareRdm = config.challenge_50_share; }

    return {
      ...base,
      winRdm,
      shareRdm,
      totalRdm: winRdm + shareRdm
    };
  });
}

export function referChallengeSpec(key: ReferClaimKey, config: RdmConfigParams): ReferChallengePublicSpec | undefined {
  return getReferChallengeSpecs(config).find((s) => s.key === key);
}

export function referChallengeDayKey(userId: string, day: string): string {
  return `testbee_refer_rdm_challenge_${userId}_${day}`;
}

export function readReferChallengesDone(
  userId: string,
  day: string
): Partial<Record<ReferClaimKey, boolean>> {
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
