import { describe, expect, it } from "vitest";
import { shouldCreditTeacherWelcomeRdm } from "@/lib/teacherPortal/teacherWelcomeRdmClaim";

describe("shouldCreditTeacherWelcomeRdm", () => {
  it("credits the first time an onboarded teacher is stamped", () => {
    expect(
      shouldCreditTeacherWelcomeRdm({
        op: "UPDATE",
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: null,
        newClaimedAt: "2026-10-18T00:00:00.000Z",
      })
    ).toBe(true);
  });

  it("credits every row in a multi-row statement that just got its own stamp", () => {
    const rows = ["2026-10-18T00:00:01.000Z", "2026-10-18T00:00:02.000Z"].map((newClaimedAt) =>
      shouldCreditTeacherWelcomeRdm({
        op: "UPDATE",
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: null,
        newClaimedAt,
      })
    );
    expect(rows).toEqual([true, true]);
  });

  it("does not credit when onboarding_complete is flipped false then true after a claim", () => {
    expect(
      shouldCreditTeacherWelcomeRdm({
        op: "UPDATE",
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: "2026-10-11T00:00:00.000Z",
        newClaimedAt: "2026-10-11T00:00:00.000Z",
      })
    ).toBe(false);
  });

  it("credits an insert that becomes an onboarded teacher with a new stamp", () => {
    expect(
      shouldCreditTeacherWelcomeRdm({
        op: "INSERT",
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: null,
        newClaimedAt: "2026-10-18T00:00:00.000Z",
      })
    ).toBe(true);
  });

  it("does not credit a restore insert that already has a claim stamp", () => {
    expect(
      shouldCreditTeacherWelcomeRdm({
        op: "INSERT",
        qualifying: true,
        wasQualifying: false,
        oldClaimedAt: "2026-10-11T00:00:00.000Z",
        newClaimedAt: "2026-10-11T00:00:00.000Z",
      })
    ).toBe(false);
  });
});
