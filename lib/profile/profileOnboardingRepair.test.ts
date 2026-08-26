import { describe, expect, it } from "vitest";
import { profileShouldForceOnboardingComplete } from "@/lib/profile/profileOnboardingRepair";

const namedTeacher = {
  role: "teacher",
  onboarding_complete: false,
  name: "EM Edublast",
  subjects: [] as string[],
  teaching_levels: [] as number[],
  exam_tags: [] as string[],
};

describe("profileShouldForceOnboardingComplete", () => {
  it("does not complete an empty teacher row just because the flow is sign-in", () => {
    expect(profileShouldForceOnboardingComplete(namedTeacher, { isSignIn: true })).toBe(false);
  });

  it("still completes a teacher who already saved teaching data", () => {
    expect(
      profileShouldForceOnboardingComplete(
        { ...namedTeacher, subjects: ["Physics"] },
        { isSignIn: true }
      )
    ).toBe(true);
  });
});
