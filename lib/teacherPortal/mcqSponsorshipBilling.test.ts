import { describe, expect, it } from "vitest";
import {
  assignmentRequiresMcqSponsorshipCharge,
  mcqSponsorshipChargeTotal,
  splitStudentIdsByMcqSponsorshipNeed,
  studentNeedsMcqSponsorship,
} from "@/lib/teacherPortal/mcqSponsorshipBilling";

describe("studentNeedsMcqSponsorship", () => {
  it("treats starter and pro as premium (no teacher charge)", () => {
    expect(studentNeedsMcqSponsorship("starter")).toBe(false);
    expect(studentNeedsMcqSponsorship("pro")).toBe(false);
  });

  it("treats free and trial as billable", () => {
    expect(studentNeedsMcqSponsorship("free")).toBe(true);
    expect(studentNeedsMcqSponsorship("free_trial")).toBe(true);
  });
});

describe("splitStudentIdsByMcqSponsorshipNeed", () => {
  it("splits mixed audience", () => {
    const planByStudentId = new Map([
      ["a", "free" as const],
      ["b", "starter" as const],
      ["c", "pro" as const],
      ["d", "free_trial" as const],
    ]);
    const split = splitStudentIdsByMcqSponsorshipNeed(["a", "b", "c", "d"], planByStudentId);
    expect(split.billableStudentIds).toEqual(["a", "d"]);
    expect(split.premiumStudentIds).toEqual(["b", "c"]);
  });
});

describe("assignmentRequiresMcqSponsorshipCharge", () => {
  it("requires sponsorship for Concept Focus", () => {
    expect(
      assignmentRequiresMcqSponsorshipCharge({ assignmentType: "Concept Focus", chapterQuiz: null })
    ).toBe(true);
  });

  it("requires sponsorship for chapter quiz bank sets 2–6 only", () => {
    const base = {
      board: "CBSE" as const,
      subject: "physics" as const,
      classLevel: 12 as const,
      chapterTitle: "Electrostatics",
      topic: "Electric Charges",
      subtopicName: "Coulomb Law",
      level: "advanced" as const,
    };
    expect(
      assignmentRequiresMcqSponsorshipCharge({
        assignmentType: "quiz",
        chapterQuiz: { ...base, advancedSet: 1 },
      })
    ).toBe(false);
    expect(
      assignmentRequiresMcqSponsorshipCharge({
        assignmentType: "quiz",
        chapterQuiz: { ...base, advancedSet: 6 },
      })
    ).toBe(true);
  });
});

describe("mcqSponsorshipChargeTotal", () => {
  it("multiplies per-student rate by billable count only", () => {
    expect(mcqSponsorshipChargeTotal(10, 3)).toBe(30);
    expect(mcqSponsorshipChargeTotal(10, 0)).toBe(0);
  });
});
