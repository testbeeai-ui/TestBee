import { describe, expect, it } from "vitest";

import { DOUBT_SUPPORTED_LANGUAGE_COUNT } from "@/lib/gyan/doubtSupportedLanguages";

describe("doubtSupportedLanguages", () => {
  it("lists five lesson-chat languages", () => {
    expect(DOUBT_SUPPORTED_LANGUAGE_COUNT).toBe(5);
  });
});
