import { describe, expect, it, vi } from "vitest";

import {
  buildEduDecaProfileUpsert,
  resolveProfileUserId,
} from "@/lib/edudeca/register-interest";

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
