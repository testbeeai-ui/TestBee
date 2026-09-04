import { describe, expect, it } from "vitest";

import { parseHandoffQuery } from "./session-store";
import { edudecaMockReturnUrl } from "./return-url";

describe("EduDeca ↔ EduBlast URL contract", () => {
  it("parses the handoff URL EduDeca actually opens", () => {
    const url = new URL("http://localhost:3000/edudeca-mock?level=2&set=1");
    expect(url.pathname).toBe("/edudeca-mock");
    expect(parseHandoffQuery(url.searchParams)).toEqual({ level: 2, set: 1 });
  });

  it("builds a completed return URL EduDeca parseReturnQuery accepts", () => {
    const href = edudecaMockReturnUrl(
      {
        level: 2,
        set: 1,
        status: "completed",
        scorePct: 80,
        correct: 16,
        total: 20,
      },
      "http://localhost:3001",
    );
    const url = new URL(href);
    expect(url.pathname).toBe("/mock-test");
    expect(url.searchParams.get("level")).toBe("2");
    expect(url.searchParams.get("set")).toBe("1");
    expect(url.searchParams.get("status")).toBe("completed");
    expect(url.searchParams.get("score")).toBe("80");
    expect(url.searchParams.get("correct")).toBe("16");
    expect(url.searchParams.get("total")).toBe("20");
  });

  it("builds an in-progress return URL without a score", () => {
    const href = edudecaMockReturnUrl(
      { level: 1, set: 4, status: "inprogress" },
      "http://localhost:3001",
    );
    const url = new URL(href);
    expect(url.searchParams.get("status")).toBe("inprogress");
    expect(url.searchParams.get("score")).toBeNull();
  });
});
