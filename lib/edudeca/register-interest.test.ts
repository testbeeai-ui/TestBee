import { describe, expect, it } from "vitest";

import { EDUDECA_GMAIL_RE } from "@/lib/edudeca/register-interest";

describe("EDUDECA_GMAIL_RE", () => {
  it("accepts gmail addresses", () => {
    expect(EDUDECA_GMAIL_RE.test("student@gmail.com")).toBe(true);
  });

  it("rejects non-gmail addresses", () => {
    expect(EDUDECA_GMAIL_RE.test("student@yahoo.com")).toBe(false);
  });
});
