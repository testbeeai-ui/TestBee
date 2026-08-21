import { describe, expect, it, vi } from "vitest";

import {
  EDUDECA_EMAIL_RE,
  buildEduDecaProfileUpsert,
  buildWaitlistUpsert,
  findExistingProfileUserId,
} from "@/lib/edudeca/register-interest";

describe("EDUDECA_EMAIL_RE", () => {
  it("accepts gmail and college domains", () => {
    expect(EDUDECA_EMAIL_RE.test("student@gmail.com")).toBe(true);
    expect(EDUDECA_EMAIL_RE.test("adwait.kamble23@pccoepune.org")).toBe(true);
    expect(EDUDECA_EMAIL_RE.test("principal@institution.edu")).toBe(true);
  });

  it("rejects incomplete addresses", () => {
    expect(EDUDECA_EMAIL_RE.test("student@")).toBe(false);
    expect(EDUDECA_EMAIL_RE.test("not-an-email")).toBe(false);
  });
});

describe("buildEduDecaProfileUpsert", () => {
  it("maps form fields onto edudeca_profiles columns including email", () => {
    expect(
      buildEduDecaProfileUpsert("user-1", {
        email: "student@pccoepune.org",
        classLevel: 12,
        institution: "viswa vignan",
        state: "Andhra Pradesh",
        city: "Vijayawada",
      }),
    ).toEqual({
      id: "user-1",
      email: "student@pccoepune.org",
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
        email: "student@college.edu",
        classLevel: 11,
        institution: "KV",
        state: "Delhi",
        city: "New Delhi",
      }),
    ).toEqual({
      email: "student@college.edu",
      class_level: 11,
      institution: "KV",
      state: "Delhi",
      city: "New Delhi",
    });
  });
});

describe("findExistingProfileUserId", () => {
  it("returns an existing auth user id for the same email", async () => {
    const findIdByEmail = vi.fn().mockResolvedValue("existing-id");

    await expect(
      findExistingProfileUserId("student@college.edu", { findIdByEmail }),
    ).resolves.toBe("existing-id");
  });

  it("returns null when the email has no Auth user yet", async () => {
    const findIdByEmail = vi.fn().mockResolvedValue(null);

    await expect(
      findExistingProfileUserId("new@college.edu", { findIdByEmail }),
    ).resolves.toBeNull();
  });
});
