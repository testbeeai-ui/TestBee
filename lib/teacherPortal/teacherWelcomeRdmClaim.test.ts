import { describe, expect, it } from "vitest";
import { shouldCreditTeacherWelcomeRdm } from "@/lib/teacherPortal/teacherWelcomeRdmClaim";

const userId = "teacher-1";

describe("shouldCreditTeacherWelcomeRdm", () => {
  it("credits the first time an onboarded teacher is stamped", () => {
    expect(
      shouldCreditTeacherWelcomeRdm({
        op: "UPDATE",
        userId,
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: null,
        justStampedUserId: userId,
      })
    ).toBe(true);
  });

  it("does not credit when onboarding_complete is flipped false then true after a claim", () => {
    expect(
      shouldCreditTeacherWelcomeRdm({
        op: "UPDATE",
        userId,
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: "2026-10-11T00:00:00.000Z",
        justStampedUserId: "",
      })
    ).toBe(false);
  });

  it("does not credit a restore insert that already has a claim stamp", () => {
    expect(
      shouldCreditTeacherWelcomeRdm({
        op: "INSERT",
        userId,
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: null,
        justStampedUserId: "",
      })
    ).toBe(false);
  });
});
