import { describe, expect, it } from "vitest";
import {
  inactivePenaltyRdmForPlan,
  INACTIVE_PENALTY_RDM_DEFAULTS,
} from "./inactivePenaltyRdm";

describe("inactivePenaltyRdmForPlan", () => {
  it("returns separate defaults per plan tier", () => {
    expect(inactivePenaltyRdmForPlan("free_trial")).toBe(50);
    expect(inactivePenaltyRdmForPlan("free")).toBe(50);
    expect(inactivePenaltyRdmForPlan("starter")).toBe(50);
    expect(inactivePenaltyRdmForPlan("pro")).toBe(25);
  });

  it("uses admin config per tier without merging", () => {
    expect(
      inactivePenaltyRdmForPlan("starter", {
        starter_inactive_penalty_rdm: 80,
        pro_inactive_penalty_rdm: 10,
      })
    ).toBe(80);
    expect(inactivePenaltyRdmForPlan("pro", { pro_inactive_penalty_rdm: 10 })).toBe(10);
    expect(inactivePenaltyRdmForPlan("free_trial", {})).toBe(
      INACTIVE_PENALTY_RDM_DEFAULTS.free_trial
    );
  });

  it("treats 0 as disabled", () => {
    expect(inactivePenaltyRdmForPlan("pro", { pro_inactive_penalty_rdm: 0 })).toBe(0);
  });
});
