import { describe, expect, it } from "vitest";
import { isAiTutorAnswer, isAiTutorDoubtAuthor } from "@/components/doubts/doubtTypes";
import { PROF_PI_USER_ID } from "@/lib/gyanBotPersonas";

const studentAnswer = {
  id: "a1",
  body: "x = -1, -4",
  upvotes: 0,
  downvotes: 0,
  is_accepted: false,
  created_at: "2026-08-16T00:00:00Z",
  user_id: "11111111-1111-4111-8111-111111111111",
  profiles: null as { name: string | null; avatar_url: string | null; role?: string | null } | null,
};

describe("isAiTutorAnswer", () => {
  it("recognizes Prof-Pi by user id when the profile embed is missing", () => {
    expect(
      isAiTutorAnswer({
        ...studentAnswer,
        user_id: PROF_PI_USER_ID,
        profiles: null,
      })
    ).toBe(true);
  });

  it("does not treat a real student as the AI tutor when the profile embed is missing", () => {
    expect(isAiTutorAnswer(studentAnswer)).toBe(false);
  });

  it("still recognizes Prof-Pi from a loaded profile name", () => {
    expect(
      isAiTutorAnswer({
        ...studentAnswer,
        profiles: { name: "Prof-Pi", role: "ai", avatar_url: null },
      })
    ).toBe(true);
  });
});

describe("isAiTutorDoubtAuthor", () => {
  it("recognizes Prof-Pi by user id when the profile embed is missing", () => {
    expect(isAiTutorDoubtAuthor(null, PROF_PI_USER_ID)).toBe(true);
  });

  it("does not treat a student as AI from a missing profile alone", () => {
    expect(isAiTutorDoubtAuthor(null, studentAnswer.user_id)).toBe(false);
  });
});
