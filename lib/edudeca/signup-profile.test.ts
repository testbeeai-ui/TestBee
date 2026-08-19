import { describe, expect, it } from "vitest";

import {
  EDUDECA_REGISTRATION_SUCCESS_MESSAGE,
  isSignupProfileReady,
} from "@/lib/edudeca/signup-profile";

describe("isSignupProfileReady", () => {
  it("requires class, college, institution acknowledgement, and location", () => {
    expect(
      isSignupProfileReady({
        classLevel: 11,
        college: "Example PU College",
        institutionAck: true,
        state: "Karnataka",
        city: "Bengaluru",
      }),
    ).toBe(true);
  });

  it("rejects incomplete profiles", () => {
    expect(
      isSignupProfileReady({
        classLevel: 12,
        college: "Example PU College",
        institutionAck: false,
        state: "Karnataka",
        city: "Bengaluru",
      }),
    ).toBe(false);
  });
});

describe("EDUDECA_REGISTRATION_SUCCESS_MESSAGE", () => {
  it("mentions mid September and invitations before start", () => {
    expect(EDUDECA_REGISTRATION_SUCCESS_MESSAGE).toMatch(/mid September/i);
    expect(EDUDECA_REGISTRATION_SUCCESS_MESSAGE).toMatch(/invitation/i);
  });
});
