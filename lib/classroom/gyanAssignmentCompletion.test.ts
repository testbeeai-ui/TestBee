import { describe, expect, it } from "vitest";
import {
  gyanDoubtMeetsMinimumBar,
  parseGyanAssignmentContext,
} from "@/lib/classroom/gyanAssignmentCompletion";

describe("parseGyanAssignmentContext", () => {
  it("accepts valid uuids", () => {
    const ctx = parseGyanAssignmentContext({
      classroomId: "a1b2c3d4-e5f6-4178-9abc-def012345678",
      postId: "b2c3d4e5-f6a7-4289-abcd-ef0123456789",
      taskId: "gyan-task-1",
    });
    expect(ctx?.classroomId).toBe("a1b2c3d4-e5f6-4178-9abc-def012345678");
    expect(ctx?.postId).toBe("b2c3d4e5-f6a7-4289-abcd-ef0123456789");
    expect(ctx?.taskId).toBe("gyan-task-1");
  });

  it("rejects placeholder post id", () => {
    expect(
      parseGyanAssignmentContext({
        classroomId: "a1b2c3d4-e5f6-4178-9abc-def012345678",
        postId: "{{POST_ID}}",
        taskId: "t1",
      })
    ).toBeNull();
  });
});

describe("gyanDoubtMeetsMinimumBar", () => {
  it("requires meaningful content", () => {
    expect(gyanDoubtMeetsMinimumBar("Hi", "")).toBe(false);
    expect(gyanDoubtMeetsMinimumBar("Why is force zero?", "At equilibrium")).toBe(true);
  });
});
