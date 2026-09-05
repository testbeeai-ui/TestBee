import { describe, expect, it } from "vitest";

import {
  mergePaperKeys,
  paperCacheKey,
  paperQuestionsHaveKeys,
  parsePaperResponse,
  requestMockPaper,
} from "./paper-client";

const paper = [
  { id: "mock-l1-s01-phy-01", tag: "Physics", q: "Which law?", options: ["a", "b", "c", "d"], correctIndex: 1 },
  { id: "mock-l1-s01-che-01", tag: "Chemistry", q: "Bond?", options: ["w", "x", "y", "z"], correctIndex: 0 },
];

describe("parsePaperResponse", () => {
  it("accepts a live mock paper with preloaded keys", () => {
    expect(parsePaperResponse({ questions: paper })).toEqual({ questions: paper, attempt: undefined });
    expect(paperQuestionsHaveKeys(paper)).toBe(true);
  });

  it("rejects a paper that is missing the answer key", () => {
    const stripped = paper.map(({ correctIndex: _key, ...question }) => question);
    expect(paperQuestionsHaveKeys(stripped)).toBe(false);
    expect(parsePaperResponse({ questions: stripped })).toEqual({
      questions: stripped,
      attempt: undefined,
    });
  });

  it("rejects sample or empty banks", () => {
    expect(parsePaperResponse({ questions: [] })).toBeNull();
    expect(parsePaperResponse({ questions: [{ id: "sample-1", tag: "X", q: "?", options: ["a", "b", "c", "d"] }] })).toBeNull();
  });
});

describe("mergePaperKeys", () => {
  it("copies preloaded keys onto a resumed paper that omitted them", () => {
    const stripped = paper.map(({ correctIndex: _key, ...question }) => question);
    const merged = mergePaperKeys(stripped, paper);
    expect(paperQuestionsHaveKeys(merged)).toBe(true);
    expect(merged[0]?.correctIndex).toBe(1);
  });
});

describe("paperCacheKey", () => {
  it("keys a prefetch by level and set", () => {
    expect(paperCacheKey(1, 1)).toBe("1:1");
    expect(paperCacheKey(3, 15)).toBe("3:15");
  });
});

describe("requestMockPaper", () => {
  it("maps a keyed paper onto ready", async () => {
    const result = await requestMockPaper(
      async () =>
        new Response(JSON.stringify({ questions: paper }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      1,
      1,
    );
    expect(result).toEqual({ status: "ready", paper: { questions: paper, attempt: undefined } });
    if (result.status === "ready") {
      expect(paperQuestionsHaveKeys(result.paper.questions)).toBe(true);
    }
  });

  it("maps 401 to auth so Start can send the student to login", async () => {
    const result = await requestMockPaper(async () => new Response("{}", { status: 401 }), 1, 1);
    expect(result).toEqual({ status: "auth" });
  });
});
