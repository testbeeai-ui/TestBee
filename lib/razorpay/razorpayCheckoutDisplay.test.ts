import { describe, expect, it } from "vitest";
import {
  isRazorpayEmiEligible,
  razorpayKeyModeFromKeyId,
  standardRazorpayCheckoutDisplayConfig,
} from "./razorpayCheckoutDisplay";

describe("standardRazorpayCheckoutDisplayConfig", () => {
  it("shows all default payment blocks with UPI first", () => {
    const config = standardRazorpayCheckoutDisplayConfig();
    expect(config.display.preferences.show_default_blocks).toBe(true);
    expect(config.display.sequence[0]).toBe("upi");
    expect(config.display.sequence).toContain("emi");
    expect(config.display.sequence).toContain("paylater");
  });
});

describe("isRazorpayEmiEligible", () => {
  it("requires at least ₹3000", () => {
    expect(isRazorpayEmiEligible(299_999)).toBe(false);
    expect(isRazorpayEmiEligible(300_000)).toBe(true);
  });
});

describe("razorpayKeyModeFromKeyId", () => {
  it("detects test and live prefixes", () => {
    expect(razorpayKeyModeFromKeyId("rzp_test_abc")).toBe("test");
    expect(razorpayKeyModeFromKeyId("rzp_live_xyz")).toBe("live");
  });
});
