import { describe, expect, it } from "vitest";
import { getQuizScoreFromPost, parseScoreFromText } from "./communityPostScore";
import type { RawPostRow } from "@/components/explore/rawFeedTypes";

function post(overrides: Partial<RawPostRow>): RawPostRow {
  return {
    id: "1",
    user_id: "u1",
    kind: "post",
    title: null,
    content: null,
    tags: null,
    subject: null,
    source_type: null,
    source_payload: null,
    upvote_count: 0,
    comment_count: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("parseScoreFromText", () => {
  it("parses percent-first quiz title", () => {
    expect(
      parseScoreFromText("Reality-check attempt complete 43% (3/7) - Types: row mat...")
    ).toEqual({ percent: 43, correct: 3, total: 7 });
  });

  it("parses refer-challenge loss body", () => {
    expect(parseScoreFromText("0/10 (0%) in 00:13. Pass bar: 6/10.")).toEqual({
      percent: 0,
      correct: 0,
      total: 10,
    });
  });

  it("parses middle-dot score lines", () => {
    expect(parseScoreFromText("Score 0/10 · 0% · target 6/10.")).toEqual({
      percent: 0,
      correct: 0,
      total: 10,
    });
  });
});

describe("getQuizScoreFromPost", () => {
  it("reads structured quiz payload", () => {
    expect(
      getQuizScoreFromPost(
        post({
          source_type: "quiz_post",
          source_payload: { correctCount: 3, totalQuestions: 7, scorePercent: 43 },
        })
      )
    ).toEqual({ percent: 43, correct: 3, total: 7 });
  });

  it("falls back to text for refer_challenge posts", () => {
    expect(
      getQuizScoreFromPost(
        post({
          source_type: "refer_challenge",
          title: "Still working toward MentaMill Blitz — this round did not pass.",
          content: "0/10 (0%) in 00:13. Pass bar: 6/10.",
          tags: ["challenge", "refer-earn"],
        })
      )
    ).toEqual({ percent: 0, correct: 0, total: 10 });
  });
});
