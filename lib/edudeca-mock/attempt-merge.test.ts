import { describe, expect, it } from "vitest";

import { mergeMockAttempt } from "./attempt-merge";

describe("mergeMockAttempt", () => {
  it("keeps the higher completed percent", () => {
    const merged = mergeMockAttempt(
      {
        level: 1,
        setNumber: 3,
        status: "completed",
        scorePct: 70,
        correct: 7,
        total: 10,
      },
      {
        level: 1,
        setNumber: 3,
        status: "completed",
        scorePct: 55,
        correct: 5,
        total: 10,
      },
    );
    expect(merged.status).toBe("completed");
    expect(merged.scorePct).toBe(70);
    expect(merged.correct).toBe(7);
  });

  it("never downgrades completed to inprogress", () => {
    const merged = mergeMockAttempt(
      {
        level: 1,
        setNumber: 2,
        status: "completed",
        scorePct: 90,
        correct: 9,
        total: 10,
      },
      { level: 1, setNumber: 2, status: "inprogress" },
    );
    expect(merged.status).toBe("completed");
    expect(merged.scorePct).toBe(90);
  });

  it("writes the first in-progress attempt when none exists", () => {
    const merged = mergeMockAttempt(null, {
      level: 2,
      setNumber: 1,
      status: "inprogress",
    });
    expect(merged.status).toBe("inprogress");
  });
});
