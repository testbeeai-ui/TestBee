import { describe, expect, it } from "vitest";
import {
  computeAssignmentPublishRdm,
  computeLiveClassScheduleRdm,
  resolveMonthlyQuota,
} from "./teacherPlanQuotaPolicy";

describe("resolveMonthlyQuota", () => {
  it("allows free within cap", () => {
    const o = resolveMonthlyQuota({
      tier: "free",
      used: 11,
      cap: 12,
      resource: "assignment",
      overageRdm: 20,
    });
    expect(o.kind).toBe("allowed_included");
    if (o.kind === "allowed_included") expect(o.remaining).toBe(1);
  });

  it("blocks free at cap with starter upgrade", () => {
    const o = resolveMonthlyQuota({
      tier: "free",
      used: 12,
      cap: 12,
      resource: "assignment",
      overageRdm: 20,
    });
    expect(o.kind).toBe("blocked_upgrade");
    if (o.kind === "blocked_upgrade") expect(o.upgradeTo).toBe("starter");
  });

  it("blocks starter at cap with pro upgrade", () => {
    const o = resolveMonthlyQuota({
      tier: "starter",
      used: 24,
      cap: 24,
      resource: "live_class",
      overageRdm: 100,
    });
    expect(o.kind).toBe("blocked_upgrade");
    if (o.kind === "blocked_upgrade") expect(o.upgradeTo).toBe("pro");
  });

  it("allows pro overage at cap", () => {
    const o = resolveMonthlyQuota({
      tier: "pro",
      used: 60,
      cap: 60,
      resource: "assignment",
      overageRdm: 20,
    });
    expect(o.kind).toBe("allowed_overage");
    if (o.kind === "allowed_overage") expect(o.overageRdm).toBe(20);
  });
});

describe("computeAssignmentPublishRdm", () => {
  it("charges flat fee for free within cap", () => {
    const quota = resolveMonthlyQuota({
      tier: "free",
      used: 0,
      cap: 12,
      resource: "assignment",
      overageRdm: 20,
    });
    expect(computeAssignmentPublishRdm({ tier: "free", quota, flatPublishFee: 10 })).toBe(10);
  });

  it("waives flat fee for pro within cap", () => {
    const quota = resolveMonthlyQuota({
      tier: "pro",
      used: 0,
      cap: 60,
      resource: "assignment",
      overageRdm: 20,
    });
    expect(computeAssignmentPublishRdm({ tier: "pro", quota, flatPublishFee: 10 })).toBe(0);
  });

  it("charges overage for pro beyond cap", () => {
    const quota = resolveMonthlyQuota({
      tier: "pro",
      used: 60,
      cap: 60,
      resource: "assignment",
      overageRdm: 20,
    });
    expect(computeAssignmentPublishRdm({ tier: "pro", quota, flatPublishFee: 10 })).toBe(20);
  });
});

describe("computeLiveClassScheduleRdm", () => {
  it("waives flat schedule fee within cap (delivery RDM earned on book instead)", () => {
    const quota = resolveMonthlyQuota({
      tier: "starter",
      used: 0,
      cap: 24,
      resource: "live_class",
      overageRdm: 100,
    });
    expect(computeLiveClassScheduleRdm({ quota, flatScheduleFee: 30 })).toBe(0);
  });

  it("charges overage instead of flat fee for pro beyond cap", () => {
    const quota = resolveMonthlyQuota({
      tier: "pro",
      used: 60,
      cap: 60,
      resource: "live_class",
      overageRdm: 100,
    });
    expect(computeLiveClassScheduleRdm({ quota, flatScheduleFee: 30 })).toBe(100);
  });
});
