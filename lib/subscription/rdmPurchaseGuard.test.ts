import { describe, expect, it } from "vitest";
import { isRdmCouponPurchaseSimulationEnabled } from "@/lib/subscription/rdmPurchaseGuard";

describe("isRdmCouponPurchaseSimulationEnabled", () => {
  it("blocks production coupon minting even when the simulation flag is set", () => {
    expect(
      isRdmCouponPurchaseSimulationEnabled({
        NODE_ENV: "production",
        RDM_COUPON_PURCHASE_SIMULATION_ENABLED: "1",
      })
    ).toBe(false);
  });

  it("requires an explicit non-production simulation flag", () => {
    expect(
      isRdmCouponPurchaseSimulationEnabled({
        NODE_ENV: "development",
      })
    ).toBe(false);

    expect(
      isRdmCouponPurchaseSimulationEnabled({
        NODE_ENV: "development",
        RDM_COUPON_PURCHASE_SIMULATION_ENABLED: "1",
      })
    ).toBe(true);
  });
});
