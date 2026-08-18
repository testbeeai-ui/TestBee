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
        justStampedUserIds: userId,
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
        justStampedUserIds: "",
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
        justStampedUserIds: "",
      })
    ).toBe(false);
  });

  it("credits every id stamped in a multi-row statement, not only the last", () => {
    const justStampedUserIds = "teacher-1,teacher-2,teacher-3";
    expect(
      shouldCreditTeacherWelcomeRdm({
        op: "INSERT",
        userId: "teacher-1",
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: null,
        justStampedUserIds,
      })
    ).toBe(true);
    expect(
      shouldCreditTeacherWelcomeRdm({
        op: "INSERT",
        userId: "teacher-2",
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: null,
        justStampedUserIds,
      })
    ).toBe(true);
    expect(
      shouldCreditTeacherWelcomeRdm({
        op: "INSERT",
        userId: "teacher-3",
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: null,
        justStampedUserIds,
      })
    ).toBe(true);
  });
});
