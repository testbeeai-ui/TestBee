import { describe, expect, it } from "vitest";

import {
  EDUDECA_EDUBITE_PRACTICE_APP_URL,
  EDUDECA_REGISTRATION_SUCCESS_MESSAGE,
  EDUDECA_REGISTRATION_SUCCESS_WAIT_MESSAGE,
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
  it("mentions app-open notification and invitations before start", () => {
    expect(EDUDECA_REGISTRATION_SUCCESS_MESSAGE).toBe(
      "Notification will be sent once the app is open for use. An invitation will be sent before they start.",
    );
  });
});

describe("EDUDECA_REGISTRATION_SUCCESS_WAIT_MESSAGE", () => {
  it("points people to Edubite practice while waiting", () => {
    expect(EDUDECA_REGISTRATION_SUCCESS_WAIT_MESSAGE).toBe(
      "While waiting, please download the Edubite app for practice for now. In the future we will share a Play Store QR.",
    );
  });
});

describe("EDUDECA_EDUBITE_PRACTICE_APP_URL", () => {
  it("uses the Expo internal distribution build", () => {
    expect(EDUDECA_EDUBITE_PRACTICE_APP_URL).toBe(
      "https://expo.dev/accounts/edublast/projects/edubite-mobile/builds/7c5b40f7-1c10-4cbe-9893-e1cf4a61f171",
    );
  });
});
