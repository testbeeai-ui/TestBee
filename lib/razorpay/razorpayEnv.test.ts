import { describe, expect, it } from "vitest";
import {
  getRazorpayEnvStatus,
  normalizeRazorpayEnvValue,
  razorpayKeyMode,
} from "./razorpayEnv";

describe("normalizeRazorpayEnvValue", () => {
  it("strips wrapping double quotes", () => {
    expect(normalizeRazorpayEnvValue('"rzp_test_abc"')).toBe("rzp_test_abc");
  });

  it("strips wrapping single quotes and whitespace", () => {
    expect(normalizeRazorpayEnvValue("  'secret'  ")).toBe("secret");
  });

  it("returns null for empty", () => {
    expect(normalizeRazorpayEnvValue("   ")).toBeNull();
  });
});

describe("razorpayKeyMode", () => {
  it("detects test and live prefixes", () => {
    expect(razorpayKeyMode("rzp_test_abc")).toBe("test");
    expect(razorpayKeyMode("rzp_live_xyz")).toBe("live");
    expect(razorpayKeyMode("bad")).toBe("unknown");
  });
});

describe("getRazorpayEnvStatus", () => {
  it("reports mismatch when public key differs from server key id", () => {
    const prevId = process.env.RAZORPAY_KEY_ID;
    const prevSecret = process.env.RAZORPAY_KEY_SECRET;
    const prevPublic = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    process.env.RAZORPAY_KEY_ID = "rzp_test_server";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_public";

    const status = getRazorpayEnvStatus();
    expect(status.publicKeyMatchesServer).toBe(false);
    expect(status.keyMode).toBe("test");

    process.env.RAZORPAY_KEY_ID = prevId;
    process.env.RAZORPAY_KEY_SECRET = prevSecret;
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = prevPublic;
  });
});
