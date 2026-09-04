import { describe, expect, it } from "vitest";

import {
  pickEduDecaMockAwareDestination,
  shouldFollowPostLoginNext,
} from "./post-login";

describe("shouldFollowPostLoginNext", () => {
  it("follows an EduDeca mock handoff even when EduBlast onboarding is incomplete", () => {
    expect(shouldFollowPostLoginNext("/edudeca-mock?level=2&set=1", false)).toBe(true);
  });

  it("does not send incomplete students to the rest of the app", () => {
    expect(shouldFollowPostLoginNext("/home", false)).toBe(false);
    expect(shouldFollowPostLoginNext("/mock-test?tab=mock&exam=jee-main", false)).toBe(false);
  });

  it("follows any safe next path after onboarding is complete", () => {
    expect(shouldFollowPostLoginNext("/home", true)).toBe(true);
    expect(shouldFollowPostLoginNext("/edudeca-mock?level=1&set=4", true)).toBe(true);
  });

  it("does nothing when there is no next path", () => {
    expect(shouldFollowPostLoginNext(null, true)).toBe(false);
  });
});

describe("pickEduDecaMockAwareDestination", () => {
  const onboardPath = "/onboarding?role=student";
  const postOnboardPath = "/home";

  it("sends an EduDeca mock deep link through instead of onboarding", () => {
    expect(
      pickEduDecaMockAwareDestination({
        onboardingComplete: false,
        pendingDeepLink: "/edudeca-mock?level=1&set=1",
        oauthStored: null,
        onboardPath,
        postOnboardPath,
      }),
    ).toBe("/edudeca-mock?level=1&set=1");
  });

  it("prefers the pending mock path over a stored OAuth fallback", () => {
    expect(
      pickEduDecaMockAwareDestination({
        onboardingComplete: false,
        pendingDeepLink: "/edudeca-mock?level=3&set=8",
        oauthStored: "/onboarding",
        onboardPath,
        postOnboardPath,
      }),
    ).toBe("/edudeca-mock?level=3&set=8");
  });

  it("still sends incomplete students to onboarding when the next path is not the mock", () => {
    expect(
      pickEduDecaMockAwareDestination({
        onboardingComplete: false,
        pendingDeepLink: "/home",
        oauthStored: null,
        onboardPath,
        postOnboardPath,
      }),
    ).toBe(onboardPath);
  });

  it("keeps completed students on their pending destination", () => {
    expect(
      pickEduDecaMockAwareDestination({
        onboardingComplete: true,
        pendingDeepLink: "/dive",
        oauthStored: "/home",
        onboardPath,
        postOnboardPath,
      }),
    ).toBe("/dive");
  });
});
