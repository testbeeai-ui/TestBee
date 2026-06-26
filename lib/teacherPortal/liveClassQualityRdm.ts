// Live-class quality bonus RDM — pure scoring + quorum logic (no DB).
// CREDIT ONLY: this module decides whether to grant +bonus RDM. It never returns
// a negative amount and there are no penalties for low ratings. The SQL RPC
// `award_teacher_section_schedule_quality_rdm` mirrors this math exactly.

export const TEACHER_LIVE_CLASS_QUALITY_BONUS_KEY = "teacher_live_class_quality_bonus_rdm";
export const TEACHER_LIVE_CLASS_QUALITY_MIN_AVG_X10_KEY = "teacher_live_class_quality_min_avg_x10";
export const TEACHER_LIVE_CLASS_QUALITY_MIN_RATINGS_KEY = "teacher_live_class_quality_min_ratings";
export const TEACHER_LIVE_CLASS_QUALITY_MIN_COVERAGE_PCT_KEY =
  "teacher_live_class_quality_min_coverage_pct";
export const TEACHER_LIVE_CLASS_QUALITY_SMOOTHING_M_KEY = "teacher_live_class_quality_smoothing_m";
export const TEACHER_LIVE_CLASS_QUALITY_PRIOR_AVG_X10_KEY =
  "teacher_live_class_quality_prior_avg_x10";
export const TEACHER_LIVE_CLASS_QUALITY_WINDOW_HOURS_KEY =
  "teacher_live_class_quality_window_hours";
export const TEACHER_LIVE_CLASS_QUALITY_MONTHLY_CAP_KEY =
  "teacher_live_class_quality_monthly_cap";

export const TEACHER_LIVE_CLASS_QUALITY_RDM_KEYS = [
  TEACHER_LIVE_CLASS_QUALITY_BONUS_KEY,
  TEACHER_LIVE_CLASS_QUALITY_MIN_AVG_X10_KEY,
  TEACHER_LIVE_CLASS_QUALITY_MIN_RATINGS_KEY,
  TEACHER_LIVE_CLASS_QUALITY_MIN_COVERAGE_PCT_KEY,
  TEACHER_LIVE_CLASS_QUALITY_SMOOTHING_M_KEY,
  TEACHER_LIVE_CLASS_QUALITY_PRIOR_AVG_X10_KEY,
  TEACHER_LIVE_CLASS_QUALITY_WINDOW_HOURS_KEY,
  TEACHER_LIVE_CLASS_QUALITY_MONTHLY_CAP_KEY,
] as const;

export type LiveClassQualityRdmConfig = {
  /** Flat RDM credited when a class qualifies. */
  bonusRdm: number;
  /** Threshold the smoothed score must reach, in tenths (45 = 4.5). */
  minAvgX10: number;
  /** Absolute minimum number of raters. */
  minRatings: number;
  /** Minimum share of the enrolled roster that must rate, 0–100. */
  minCoveragePct: number;
  /** Bayesian smoothing weight (m). Higher = stricter on small samples. */
  smoothingM: number;
  /** Bayesian prior average in tenths (40 = 4.0). */
  priorAvgX10: number;
  /** Hours after class end that ratings stay open before the bonus is decided. */
  windowHours: number;
  /** Max quality bonuses a teacher can earn per IST month (economy guard). */
  monthlyCap: number;
};

export const DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG: LiveClassQualityRdmConfig = {
  bonusRdm: 200,
  minAvgX10: 45,
  minRatings: 5,
  minCoveragePct: 50,
  smoothingM: 8,
  priorAvgX10: 40,
  windowHours: 24,
  monthlyCap: 20,
};

function clampInt(raw: number | null | undefined, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? Math.round(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function liveClassQualityRdmConfigFromRows(
  rows: Array<{ key: string; value: number | null }>
): LiveClassQualityRdmConfig {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const d = DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG;
  return {
    bonusRdm: clampInt(byKey.get(TEACHER_LIVE_CLASS_QUALITY_BONUS_KEY), d.bonusRdm, 0, 5000),
    minAvgX10: clampInt(byKey.get(TEACHER_LIVE_CLASS_QUALITY_MIN_AVG_X10_KEY), d.minAvgX10, 10, 50),
    minRatings: clampInt(byKey.get(TEACHER_LIVE_CLASS_QUALITY_MIN_RATINGS_KEY), d.minRatings, 1, 1000),
    minCoveragePct: clampInt(
      byKey.get(TEACHER_LIVE_CLASS_QUALITY_MIN_COVERAGE_PCT_KEY),
      d.minCoveragePct,
      0,
      100
    ),
    smoothingM: clampInt(byKey.get(TEACHER_LIVE_CLASS_QUALITY_SMOOTHING_M_KEY), d.smoothingM, 0, 1000),
    priorAvgX10: clampInt(byKey.get(TEACHER_LIVE_CLASS_QUALITY_PRIOR_AVG_X10_KEY), d.priorAvgX10, 10, 50),
    windowHours: clampInt(byKey.get(TEACHER_LIVE_CLASS_QUALITY_WINDOW_HOURS_KEY), d.windowHours, 0, 720),
    monthlyCap: clampInt(byKey.get(TEACHER_LIVE_CLASS_QUALITY_MONTHLY_CAP_KEY), d.monthlyCap, 0, 10_000),
  };
}

/** How many raters are required given the roster size and config. */
export function requiredRaterCount(rosterCount: number, config: LiveClassQualityRdmConfig): number {
  const safeRoster = Math.max(0, Math.floor(rosterCount));
  const byCoverage = Math.ceil((config.minCoveragePct / 100) * safeRoster);
  return Math.max(config.minRatings, byCoverage);
}

export type LiveClassQualityScore = {
  ratingCount: number;
  /** Raw mean of stars, in tenths (e.g. 46 = 4.6). 0 when no ratings. */
  rawAvgX10: number;
  /** Bayesian-smoothed mean, in tenths. Equals priorAvgX10 when no ratings. */
  adjustedX10: number;
};

/** Smoothed score: adjusted = (sumStars + m*prior) / (n + m). Credit-only context. */
export function computeQualityScore(
  stars: number[],
  config: LiveClassQualityRdmConfig = DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG
): LiveClassQualityScore {
  const valid = stars.filter((s) => Number.isFinite(s) && s >= 1 && s <= 5);
  const n = valid.length;
  const sum = valid.reduce((acc, s) => acc + s, 0);
  const prior = config.priorAvgX10 / 10;
  const m = config.smoothingM;
  const rawAvg = n > 0 ? sum / n : 0;
  const adjusted = n + m > 0 ? (sum + m * prior) / (n + m) : prior;
  return {
    ratingCount: n,
    rawAvgX10: Math.round(rawAvg * 10),
    adjustedX10: Math.round(adjusted * 10),
  };
}

export type LiveClassQualityDecision = LiveClassQualityScore & {
  qualifies: boolean;
  /** RDM to credit. Always >= 0 (credit-only). */
  bonusRdm: number;
  requiredRaters: number;
  reason: "qualifies" | "below_quorum" | "below_threshold" | "monthly_cap_reached";
};

/**
 * Decide the quality bonus for one class occurrence. CREDIT ONLY: `bonusRdm` is
 * `config.bonusRdm` when it qualifies, otherwise 0 — never negative.
 */
export function evaluateQualityBonus(input: {
  stars: number[];
  rosterCount: number;
  monthlyAwardsSoFar?: number;
  config?: LiveClassQualityRdmConfig;
}): LiveClassQualityDecision {
  const config = input.config ?? DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG;
  const score = computeQualityScore(input.stars, config);
  const requiredRaters = requiredRaterCount(input.rosterCount, config);
  const awardsSoFar = Math.max(0, Math.floor(input.monthlyAwardsSoFar ?? 0));

  const noBonus = (reason: LiveClassQualityDecision["reason"]): LiveClassQualityDecision => ({
    ...score,
    qualifies: false,
    bonusRdm: 0,
    requiredRaters,
    reason,
  });

  if (config.monthlyCap > 0 && awardsSoFar >= config.monthlyCap) return noBonus("monthly_cap_reached");
  if (score.ratingCount < requiredRaters) return noBonus("below_quorum");
  if (score.adjustedX10 < config.minAvgX10) return noBonus("below_threshold");

  return {
    ...score,
    qualifies: true,
    bonusRdm: config.bonusRdm,
    requiredRaters,
    reason: "qualifies",
  };
}

export function formatStarsX10(x10: number): string {
  return (Math.round(x10) / 10).toFixed(1);
}

/** Shape returned by award_teacher_section_schedule_quality_rdm. */
export type LiveClassQualityAwardResult = {
  ok?: boolean;
  error?: string;
  already_awarded?: boolean;
  section_id?: string;
  occurrence_at?: string;
  title?: string;
  classroom_id?: string;
  qualifies?: boolean;
  quality_bonus_rdm?: number;
  rating_count?: number;
  roster_count?: number;
  required_raters?: number;
  avg_x10?: number;
  adjusted_x10?: number;
  balance?: number;
  source?: "section_schedule_quality";
};

/** Shape returned by award_eligible_teacher_live_class_quality_rdm. */
export type LiveClassQualityBatchAwardResult = {
  ok?: boolean;
  error?: string;
  awarded_count?: number;
  awards?: LiveClassQualityAwardResult[];
};
