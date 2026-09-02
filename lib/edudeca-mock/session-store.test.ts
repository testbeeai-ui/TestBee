import { describe, expect, it } from "vitest";

import {
  applyHandoffQuery,
  createEmptySession,
  formatSetNumber,
  parseHandoffQuery,
} from "./session-store";

describe("parseHandoffQuery", () => {
  it("reads level and set from the URL", () => {
    expect(parseHandoffQuery(new URLSearchParams("level=2&set=1"))).toEqual({
      level: 2,
      set: 1,
    });
  });

  it("keeps a valid level when set is missing", () => {
    expect(parseHandoffQuery(new URLSearchParams("level=3"))).toEqual({
      level: 3,
      set: null,
    });
  });

  it("ignores invalid level or set", () => {
    expect(parseHandoffQuery(new URLSearchParams("level=9&set=1"))).toEqual({
      level: null,
      set: null,
    });
  });
});

describe("applyHandoffQuery", () => {
  it("remembers both level and set", () => {
    const next = applyHandoffQuery(createEmptySession(), { level: 2, set: 1 });
    expect(next.lastLevel).toBe(2);
    expect(next.lastSet).toBe(1);
  });

  it("updates lastLevel only when set is absent", () => {
    const started = applyHandoffQuery(createEmptySession(), { level: 1, set: 5 });
    const next = applyHandoffQuery(started, { level: 3, set: null });
    expect(next.lastLevel).toBe(3);
    expect(next.lastSet).toBe(5);
  });
});

describe("formatSetNumber", () => {
  it("pads single-digit sets", () => {
    expect(formatSetNumber(1)).toBe("01");
    expect(formatSetNumber(9)).toBe("09");
  });

  it("leaves two-digit sets unpadded", () => {
    expect(formatSetNumber(10)).toBe("10");
    expect(formatSetNumber(20)).toBe("20");
  });
});
