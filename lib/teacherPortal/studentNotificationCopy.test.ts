import { describe, expect, it } from "vitest";
import {
  buildAssignmentReminderMessage,
  buildNudgeMessage,
  buildStudentNotificationTitle,
  resolveStudentMessageKind,
} from "@/lib/teacherPortal/studentNotificationCopy";
import { personalizeTeacherMotivationMessage } from "@/lib/teacherPortal/motivationMessagePersonalization";

describe("studentNotificationCopy", () => {
  it("uses [name] token in assignment reminders", () => {
    const body = buildAssignmentReminderMessage({
      assignmentTitle: "Physics Mock 2",
      dueLabel: "today",
      totalRdm: 25,
      extraRdm: 5,
    });
    expect(body).toContain("[name]");
    expect(personalizeTeacherMotivationMessage(body, "Asha")).toContain("Asha");
  });

  it("builds student-facing assignment titles without teacher jargon", () => {
    expect(
      buildStudentNotificationTitle({
        kind: "assignment_reminder",
        nudgeGoal: "complete_pending_assignment",
        relatedPostTitle: "Organic Chemistry Worksheet",
      })
    ).toBe("Organic Chemistry Worksheet");
  });

  it("resolves assignment reminders from legacy motivation rows", () => {
    expect(
      resolveStudentMessageKind({
        relatedPostId: "post-1",
        nudgeGoal: "complete_pending_assignment",
        actionKind: "nudge",
      })
    ).toBe("assignment_reminder");
  });

  it("builds distinct nudge copy per goal", () => {
    const streak = buildNudgeMessage({ nudgeGoal: "restart_streak", rdmDelta: 10 });
    const doubt = buildNudgeMessage({ nudgeGoal: "answer_doubts", rdmDelta: 0 });
    expect(streak).not.toEqual(doubt);
    expect(streak).toContain("streak");
  });
});
