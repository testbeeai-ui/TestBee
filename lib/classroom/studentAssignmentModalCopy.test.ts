import { describe, expect, it } from "vitest";
import { studentAssignmentActionHint } from "@/lib/classroom/studentAssignmentModalCopy";

describe("studentAssignmentActionHint", () => {
  it("Concept Focus does not mention Mark as done in this modal", () => {
    const hint = studentAssignmentActionHint("Concept Focus", [
      { kind: "topic_path", href: "/lesson/x", visible_to_student: true },
    ]);
    expect(hint).not.toMatch(/mark as done/i);
    expect(hint).toMatch(/checklist/i);
    expect(hint).toMatch(/automatically/i);
  });

  it("chapter quiz is auto-tracked on submit", () => {
    const hint = studentAssignmentActionHint("quiz", [{ kind: "chapter_quiz", href: "/exam" }]);
    expect(hint).toMatch(/submit/i);
    expect(hint).toMatch(/automatically/i);
    expect(hint).not.toMatch(/mark as done/i);
  });

  it("custom free_text mentions Mark as done", () => {
    const hint = studentAssignmentActionHint("assignment", [
      { kind: "free_text", href: null, visible_to_student: true },
    ]);
    expect(hint).toMatch(/mark as done/i);
  });
});
