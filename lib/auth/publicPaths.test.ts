import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/auth/publicPaths";

describe("isPublicPath", () => {
  it("allows the EduDeca marketing page without a session", () => {
    expect(isPublicPath("/edudeca")).toBe(true);
    expect(isPublicPath("/edudeca/")).toBe(true);
  });

  it("still requires login for student app routes", () => {
    expect(isPublicPath("/home")).toBe(false);
    expect(isPublicPath("/dive")).toBe(false);
    expect(isPublicPath("/edudeca-mock")).toBe(false);
  });
});
