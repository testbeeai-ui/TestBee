import { describe, expect, it } from "vitest";
import { buildClassroomInviteEmail } from "./classroomInviteEmail";

describe("buildClassroomInviteEmail", () => {
  it("includes teacher, class, and join link", () => {
    const invite = buildClassroomInviteEmail({
      studentEmail: "student@school.com",
      teacherName: "Priya Sharma",
      classroomName: "JEE Batch A",
      joinCode: "QT69YK",
    });

    expect(invite.subject).toContain("Priya Sharma");
    expect(invite.subject).toContain("JEE Batch A");
    expect(invite.joinUrl).toContain("code=QT69YK");
    expect(invite.text).toContain("student@school.com");
    expect(invite.html).toContain("Accept invitation");
  });
});
