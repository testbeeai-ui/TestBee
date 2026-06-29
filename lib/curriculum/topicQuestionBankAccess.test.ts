import { describe, expect, it } from "vitest";
import {
  canAccessAdvancedQuizSet,
  getAdvancedQuizSetLockState,
  isTeacherAssignmentQuizSet,
  parseQuizSetSearchParam,
  resolveTeacherAssignmentQuizAccess,
} from "./topicQuestionBankAccess";

describe("topicQuestionBankAccess assignment unlock", () => {
  it("parses quiz set params 1–6", () => {
    expect(parseQuizSetSearchParam("6")).toBe(6);
    expect(parseQuizSetSearchParam("0")).toBeNull();
    expect(parseQuizSetSearchParam("7")).toBeNull();
  });

  it("detects teacher assignment quiz context from URL params", () => {
    expect(
      resolveTeacherAssignmentQuizAccess({
        panel: "quiz",
        postId: "post-1",
        quizSetParam: "6",
      })
    ).toEqual({ active: true, assignedSet: 6 });

    expect(
      resolveTeacherAssignmentQuizAccess({
        panel: "quiz",
        postId: "",
        quizSetParam: "6",
      })
    ).toEqual({ active: false, assignedSet: null });
  });

  it("unlocks only the assigned set for free-plan learners", () => {
    const assignment = resolveTeacherAssignmentQuizAccess({
      panel: "quiz",
      postId: "post-1",
      quizSetParam: "6",
    });

    expect(isTeacherAssignmentQuizSet(6, assignment)).toBe(true);
    expect(isTeacherAssignmentQuizSet(5, assignment)).toBe(false);

    expect(
      getAdvancedQuizSetLockState(6, {
        plan: "free",
        questionBankUnlocked: false,
        isAssignmentSet: true,
      })
    ).toEqual({ locked: false, reason: "assignment" });

    expect(
      canAccessAdvancedQuizSet(6, {
        plan: "free",
        questionBankUnlocked: false,
        isAssignmentSet: true,
      })
    ).toBe(true);

    expect(
      canAccessAdvancedQuizSet(5, {
        plan: "free",
        questionBankUnlocked: false,
        isAssignmentSet: false,
      })
    ).toBe(false);
  });

  it("unlocks all advanced sets when teacher sponsored full subtopic", () => {
    expect(
      getAdvancedQuizSetLockState(6, {
        plan: "free",
        questionBankUnlocked: false,
        sponsoredFullSubtopic: true,
      })
    ).toEqual({ locked: false, reason: "sponsored_subtopic" });

    expect(
      canAccessAdvancedQuizSet(3, {
        plan: "free",
        questionBankUnlocked: false,
        sponsoredFullSubtopic: true,
      })
    ).toBe(true);
  });

  it("keeps starter/pro question-bank rules when not an assignment set", () => {
    expect(
      getAdvancedQuizSetLockState(6, {
        plan: "starter",
        questionBankUnlocked: false,
      })
    ).toEqual({ locked: true, reason: "needs_question_bank_unlock" });
  });
});
