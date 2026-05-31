import { describe, expect, it } from "vitest";
import {
  INITIAL_TRIAL_ONBOARDING_ANSWERS,
  TRIAL_PRIMARY_SCHOOL_ONLY,
} from "@/components/dashboard/free-trial-onboarding/types";
import {
  displayPrimaryPlatform,
  isSchoolOnlyPrimary,
  validateScreen3,
} from "@/components/dashboard/free-trial-onboarding/validation";
import { parseTrialOnboardingAnswersFromProfile } from "./trialOnboardingAnswers";

describe("school-only free trial onboarding", () => {
  it("isSchoolOnlyPrimary matches constant label", () => {
    expect(
      isSchoolOnlyPrimary({
        ...INITIAL_TRIAL_ONBOARDING_ANSWERS,
        primaryPlatform: TRIAL_PRIMARY_SCHOOL_ONLY,
      })
    ).toBe(true);
    expect(
      isSchoolOnlyPrimary({
        ...INITIAL_TRIAL_ONBOARDING_ANSWERS,
        primaryPlatform: "Self-study",
      })
    ).toBe(false);
  });

  it("validateScreen3 does not require schoolName when School only", () => {
    const errors = validateScreen3({
      ...INITIAL_TRIAL_ONBOARDING_ANSWERS,
      primaryPlatform: TRIAL_PRIMARY_SCHOOL_ONLY,
      schoolName: "",
    });
    expect(errors.schoolName).toBeUndefined();
    expect(errors.primaryPlatform).toBeUndefined();
  });

  it("displayPrimaryPlatform appends school name when provided", () => {
    const withSchool = displayPrimaryPlatform({
      ...INITIAL_TRIAL_ONBOARDING_ANSWERS,
      primaryPlatform: TRIAL_PRIMARY_SCHOOL_ONLY,
      schoolName: "  Kendriya Vidyalaya  ",
    });
    expect(withSchool).toBe("School only (Kendriya Vidyalaya)");

    const withoutSchool = displayPrimaryPlatform({
      ...INITIAL_TRIAL_ONBOARDING_ANSWERS,
      primaryPlatform: TRIAL_PRIMARY_SCHOOL_ONLY,
      schoolName: "",
    });
    expect(withoutSchool).toBe("School only");
  });

  it("parseTrialOnboardingAnswersFromProfile trims and caps schoolName", () => {
    const parsed = parseTrialOnboardingAnswersFromProfile({
      primaryPlatform: TRIAL_PRIMARY_SCHOOL_ONLY,
      schoolName: `  ${"x".repeat(250)}  `,
    });
    expect(parsed.schoolName).toHaveLength(200);
    expect(parsed.schoolName).not.toMatch(/^\s/);
  });
});
