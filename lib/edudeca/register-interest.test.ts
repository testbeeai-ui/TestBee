import { describe, expect, it, vi } from "vitest";

import {
  EDUDECA_GMAIL_RE,
  buildEduDecaProfileUpsert,
  buildWaitlistUpsert,
  resolveProfileUserId,
} from "@/lib/edudeca/register-interest";

describe("EDUDECA_GMAIL_RE", () => {
  it("accepts gmail addresses", () => {
    expect(EDUDECA_GMAIL_RE.test("student@gmail.com")).toBe(true);
  });

  it("rejects non-gmail addresses", () => {
    expect(EDUDECA_GMAIL_RE.test("student@yahoo.com")).toBe(false);
  });
});

describe("buildEduDecaProfileUpsert", () => {
  it("maps form fields onto edudeca_profiles columns including email", () => {
    expect(
      buildEduDecaProfileUpsert("user-1", {
        email: "student@gmail.com",
        classLevel: 12,
        institution: "viswa vignan",
        state: "Andhra Pradesh",
        city: "Vijayawada",
      }),
    ).toEqual({
      id: "user-1",
      email: "student@gmail.com",
      class_level: 12,
      institution_name: "viswa vignan",
      state: "Andhra Pradesh",
      city: "Vijayawada",
    });
  });
});

describe("buildWaitlistUpsert", () => {
  it("maps form fields onto waitlist columns", () => {
    expect(
      buildWaitlistUpsert({
        email: "student@gmail.com",
        classLevel: 11,
        institution: "KV",
        state: "Delhi",
        city: "New Delhi",
      }),
    ).toEqual({
      email: "student@gmail.com",
      class_level: 11,
      institution: "KV",
      state: "Delhi",
      city: "New Delhi",
    });
  });
});

describe("resolveProfileUserId", () => {
  it("reuses an existing auth user for the same email", async () => {
    const findIdByEmail = vi.fn().mockResolvedValue("existing-id");
    const createIdForEmail = vi.fn();

    await expect(
      resolveProfileUserId("student@gmail.com", { findIdByEmail, createIdForEmail }),
    ).resolves.toBe("existing-id");
    expect(createIdForEmail).not.toHaveBeenCalled();
  });

  it("creates an auth user when the email is new", async () => {
    const findIdByEmail = vi.fn().mockResolvedValue(null);
    const createIdForEmail = vi.fn().mockResolvedValue("new-id");

    await expect(
      resolveProfileUserId("new@gmail.com", { findIdByEmail, createIdForEmail }),
    ).resolves.toBe("new-id");
    expect(createIdForEmail).toHaveBeenCalledWith("new@gmail.com");
  });
});
