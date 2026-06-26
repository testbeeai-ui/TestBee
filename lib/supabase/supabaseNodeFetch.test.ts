import { describe, expect, it } from "vitest";
import { isSupabaseNetworkError } from "./supabaseNodeFetch";

describe("isSupabaseNetworkError", () => {
  it("detects ECONNRESET", () => {
    expect(isSupabaseNetworkError({ cause: { code: "ECONNRESET" } })).toBe(true);
  });

  it("detects AbortError", () => {
    expect(isSupabaseNetworkError({ name: "AbortError" })).toBe(true);
  });

  it("ignores generic application errors", () => {
    expect(isSupabaseNetworkError(new Error("invalid input"))).toBe(false);
  });
});
