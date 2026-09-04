import { describe, expect, it } from "vitest";

import { parsePauseRequest } from "./pause-attempt";

describe("parsePauseRequest", () => {
  it("accepts a level, set, and answer map", () => {
    expect(
      parsePauseRequest({
        level: 2,
        set: 1,
        answers: { "mock-l2-s01-phy-01": "Newton" },
      }),
    ).toEqual({
      level: 2,
      set: 1,
      answers: { "mock-l2-s01-phy-01": "Newton" },
    });
  });

  it("rejects invalid level or set", () => {
    expect(parsePauseRequest({ level: 9, set: 1, answers: {} })).toBeNull();
    expect(parsePauseRequest({ level: 1, set: 0, answers: {} })).toBeNull();
    expect(parsePauseRequest({ level: 1, set: 21, answers: {} })).toBeNull();
  });

  it("drops non-string answers", () => {
    expect(
      parsePauseRequest({
        level: 1,
        set: 4,
        answers: { a: "ok", b: 3, c: null },
      }),
    ).toEqual({
      level: 1,
      set: 4,
      answers: { a: "ok" },
    });
  });

  it("drops empty-string answers", () => {
    expect(
      parsePauseRequest({
        level: 1,
        set: 4,
        answers: { a: "ok", b: "" },
      }),
    ).toEqual({
      level: 1,
      set: 4,
      answers: { a: "ok" },
    });
  });
});
