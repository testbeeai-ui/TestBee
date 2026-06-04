import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("keeps the reconcile migration compatible with wallet integrity", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260801120400_fix_reconcile_wallet_integrity.sql"),
      "utf8"
    );

    expect(migration).toContain("subscription_started_at IS NULL");
    expect(migration).toContain("set_config('app.allow_profile_rdm_mutation', '1', true)");
    expect(migration).toContain("set_config('app.allow_profile_rdm_mutation', '0', true)");
    expect(migration).toContain("coalesce(v_subscription_started_at, now())");
  });
});
