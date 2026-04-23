/** Five Funbrain Elo-backed lanes used in Play (Global Rating) — same set as `FUNBRAIN_DB_ELO_CATEGORIES` on `/play`. */
export const DAILYDOSE_STREAK_TRACK_IDS = [
  "verbal",
  "quantitative",
  "analytical",
  "puzzles",
  "gk",
] as const;

export type DailyDoseStreakTrackId = (typeof DAILYDOSE_STREAK_TRACK_IDS)[number];

export type DailyDoseStreakTrack = {
  id: DailyDoseStreakTrackId;
  label: string;
  blurb: string;
};

export const DAILYDOSE_STREAK_TRACKS: readonly DailyDoseStreakTrack[] = [
  {
    id: "verbal",
    label: "Verbal",
    blurb: "Vocabulary, comprehension, and verbal reasoning — Streak Survival pool (Funbrain).",
  },
  {
    id: "quantitative",
    label: "Quantitative",
    blurb: "Numbers, ratios, and quantitative reasoning — Streak Survival pool (Funbrain).",
  },
  {
    id: "analytical",
    label: "Analytical",
    blurb: "Logic and analytical puzzles — Streak Survival pool (Funbrain).",
  },
  {
    id: "puzzles",
    label: "Puzzles",
    blurb: "Pattern and puzzle-style items — Streak Survival pool (Funbrain).",
  },
  {
    id: "gk",
    label: "GK",
    blurb: "General knowledge — Streak Survival pool (Funbrain).",
  },
] as const;

export function isDailyDoseStreakTrackId(v: string): v is DailyDoseStreakTrackId {
  return (DAILYDOSE_STREAK_TRACK_IDS as readonly string[]).includes(v);
}

export function playHrefForDailyDoseStreak(trackId: DailyDoseStreakTrackId): string {
  return `/play?domain=funbrain&streakTrack=${encodeURIComponent(trackId)}`;
}

/** For server/client JSON round-trip. */
export function trackLabelById(id: string): string {
  const t = DAILYDOSE_STREAK_TRACKS.find((x) => x.id === id);
  return t?.label ?? id;
}

export type DailyDoseStreakRef = {
  trackId: DailyDoseStreakTrackId;
  trackLabel: string;
};
