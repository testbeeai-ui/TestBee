import { describe, expect, it } from "vitest";

import { edudecaMockReturnUrl } from "./return-url";

describe("edudecaMockReturnUrl", () => {
  it("sends completed score back to EduDeca mock-test", () => {
    expect(
      edudecaMockReturnUrl(
        {
          level: 2,
          set: 1,
          status: "completed",
          scorePct: 80,
          correct: 16,
          total: 20,
        },
        "http://localhost:3001",
      ),
    ).toBe(
      "http://localhost:3001/mock-test?level=2&set=1&score=80&correct=16&total=20&status=completed",
    );
  });

  it("can return in-progress without a score", () => {
    expect(
      edudecaMockReturnUrl(
        { level: 1, set: 4, status: "inprogress" },
        "https://edu-deca.vercel.app/",
      ),
    ).toBe("https://edu-deca.vercel.app/mock-test?level=1&set=4&status=inprogress");
  });
});
