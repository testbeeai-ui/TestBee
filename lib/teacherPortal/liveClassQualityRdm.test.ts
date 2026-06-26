import { describe, expect, it } from "vitest";
import {
  computeQualityScore,
  DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG,
  evaluateQualityBonus,
  liveClassQualityRdmConfigFromRows,
  requiredRaterCount,
  TEACHER_LIVE_CLASS_QUALITY_BONUS_KEY,
  TEACHER_LIVE_CLASS_QUALITY_MIN_RATINGS_KEY,
} from "./liveClassQualityRdm";

function nStars(count: number, value: number): number[] {
  return Array.from({ length: count }, () => value);
}

/** Build a star array of size `count` whose mean is as close as possible to `avg`. */
function starsWithAvg(count: number, avg: number): number[] {
  const out: number[] = [];
  let remaining = Math.round(avg * count);
  for (let i = 0; i < count; i += 1) {
    const slotsLeft = count - i;
    const ideal = Math.round(remaining / slotsLeft);
    const v = Math.max(1, Math.min(5, ideal));
    out.push(v);
    remaining -= v;
  }
  return out;
}

describe("computeQualityScore (Bayesian shrinkage, credit-only)", () => {
  it("returns the prior when there are no ratings", () => {
    const score = computeQualityScore([], DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG);
    expect(score.ratingCount).toBe(0);
    expect(score.adjustedX10).toBe(DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG.priorAvgX10);
  });

  it("pulls tiny samples toward the prior", () => {
    // 5 × 4.6 raw -> adjusted ~4.23 (below 4.5)
    const score = computeQualityScore(starsWithAvg(5, 4.6));
    expect(score.adjustedX10).toBeLessThan(45);
  });

  it("lets a large genuinely-loved sample exceed the threshold", () => {
    // 20 × 4.7 -> adjusted ~4.5
    const score = computeQualityScore(nStars(20, 4.7 >= 5 ? 5 : 4.7));
    expect(score.adjustedX10).toBeGreaterThanOrEqual(45);
  });
});

describe("requiredRaterCount (quorum: max of floor and coverage)", () => {
  it("uses the absolute floor for small classes", () => {
    expect(requiredRaterCount(6, DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG)).toBe(5);
  });

  it("uses coverage for big classes (50% of 30 = 15)", () => {
    expect(requiredRaterCount(30, DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG)).toBe(15);
  });
});

describe("evaluateQualityBonus (the investor gate)", () => {
  it("does NOT pay when only 5 people rate at 4.5/4.6 (over-conclusion guard)", () => {
    const d = evaluateQualityBonus({ stars: nStars(5, 5).slice(0, 0).concat(starsWithAvg(5, 4.6)), rosterCount: 8 });
    expect(d.qualifies).toBe(false);
    expect(d.bonusRdm).toBe(0);
  });

  it("does NOT pay a perfect but tiny class (5 × 5.0) — shrinkage keeps it below 4.5", () => {
    const d = evaluateQualityBonus({ stars: nStars(5, 5), rosterCount: 8 });
    expect(d.qualifies).toBe(false);
    expect(d.reason).toBe("below_threshold");
  });

  it("pays +200 for the smallest perfect class that clears (10 × 5.0)", () => {
    const d = evaluateQualityBonus({ stars: nStars(10, 5), rosterCount: 10 });
    expect(d.qualifies).toBe(true);
    expect(d.bonusRdm).toBe(200);
  });

  it("pays +200 for a large well-rated class (20 × 5.0, roster 30 needs 15)", () => {
    const d = evaluateQualityBonus({ stars: nStars(20, 5), rosterCount: 30 });
    expect(d.qualifies).toBe(true);
    expect(d.bonusRdm).toBe(200);
  });

  it("fails quorum when coverage is too low (10 raters, roster 30 needs 15)", () => {
    const d = evaluateQualityBonus({ stars: nStars(10, 5), rosterCount: 30 });
    expect(d.qualifies).toBe(false);
    expect(d.reason).toBe("below_quorum");
  });

  it("a couple of troll 1-stars cannot push a big class into a DEBIT (credit-only)", () => {
    const stars = nStars(28, 5).concat([1, 1]); // 30 raters, mean 4.73
    const d = evaluateQualityBonus({ stars, rosterCount: 30 });
    expect(d.bonusRdm).toBeGreaterThanOrEqual(0);
    expect(d.qualifies).toBe(true);
  });

  it("never returns a negative bonus even for an all-1-star class", () => {
    const d = evaluateQualityBonus({ stars: nStars(20, 1), rosterCount: 30 });
    expect(d.qualifies).toBe(false);
    expect(d.bonusRdm).toBe(0);
  });

  it("respects the monthly cap", () => {
    const d = evaluateQualityBonus({ stars: nStars(20, 5), rosterCount: 30, monthlyAwardsSoFar: 20 });
    expect(d.qualifies).toBe(false);
    expect(d.reason).toBe("monthly_cap_reached");
  });
});

describe("liveClassQualityRdmConfigFromRows", () => {
  it("falls back to defaults and clamps overrides", () => {
    const config = liveClassQualityRdmConfigFromRows([
      { key: TEACHER_LIVE_CLASS_QUALITY_BONUS_KEY, value: 300 },
      { key: TEACHER_LIVE_CLASS_QUALITY_MIN_RATINGS_KEY, value: 0 },
    ]);
    expect(config.bonusRdm).toBe(300);
    expect(config.minRatings).toBe(1); // clamped up from 0
    expect(config.minAvgX10).toBe(DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG.minAvgX10);
  });
});
