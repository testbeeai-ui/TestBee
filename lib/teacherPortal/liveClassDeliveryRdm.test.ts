import { describe, expect, it } from "vitest";
import {
  computeLiveClassDeliveryRdm,
  DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG,
  formatLiveClassDeliveryRdmBreakdown,
} from "./liveClassDeliveryRdm";

describe("computeLiveClassDeliveryRdm", () => {
  it("computes 100 + 30×10 for 30 students", () => {
    const result = computeLiveClassDeliveryRdm(30, DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG);
    expect(result.totalRdm).toBe(400);
    expect(result.baseRdm).toBe(100);
    expect(result.studentBonusRdm).toBe(300);
    expect(result.cappedStudentCount).toBe(30);
  });

  it("caps per-student bonus at 50 students", () => {
    const result = computeLiveClassDeliveryRdm(80, DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG);
    expect(result.cappedStudentCount).toBe(50);
    expect(result.studentBonusRdm).toBe(500);
    expect(result.totalRdm).toBe(600);
  });

  it("handles zero students as base only", () => {
    const result = computeLiveClassDeliveryRdm(0, DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG);
    expect(result.totalRdm).toBe(100);
  });
});

describe("formatLiveClassDeliveryRdmBreakdown", () => {
  it("mentions cap when students exceed cap", () => {
    const breakdown = computeLiveClassDeliveryRdm(80);
    expect(formatLiveClassDeliveryRdmBreakdown(breakdown)).toContain("cap 50");
  });
});
