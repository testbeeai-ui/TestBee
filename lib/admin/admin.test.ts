import { afterEach, describe, expect, it } from "vitest";
import { isAdminUser } from "@/lib/admin/admin";

type FakeSupabaseOptions = {
  userRoleRow?: { id: string } | null;
  profileRole?: string | null;
};

function makeSupabase({ userRoleRow = null, profileRole = null }: FakeSupabaseOptions) {
  const queries: string[] = [];

  return {
    queries,
    client: {
      from(table: string) {
        queries.push(table);
        const result =
          table === "user_roles"
            ? { data: userRoleRow, error: null }
            : { data: profileRole == null ? null : { role: profileRole }, error: null };

        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          maybeSingle() {
            return Promise.resolve(result);
          },
        };
        return builder;
      },
    },
  };
}

describe("isAdminUser", () => {
  const originalFallback = process.env.ALLOW_PROFILE_ROLE_ADMIN_FALLBACK;

  afterEach(() => {
    if (originalFallback == null) {
      delete process.env.ALLOW_PROFILE_ROLE_ADMIN_FALLBACK;
    } else {
      process.env.ALLOW_PROFILE_ROLE_ADMIN_FALLBACK = originalFallback;
    }
  });

  it("accepts admin membership from user_roles", async () => {
    const { client } = makeSupabase({ userRoleRow: { id: "role-row" } });

    await expect(isAdminUser(client as never, "user-1")).resolves.toBe(true);
  });

  it("does not trust profiles.role by default", async () => {
    delete process.env.ALLOW_PROFILE_ROLE_ADMIN_FALLBACK;
    const { client, queries } = makeSupabase({ profileRole: "admin" });

    await expect(isAdminUser(client as never, "user-1")).resolves.toBe(false);
    expect(queries).toEqual(["user_roles"]);
  });

  it("keeps profile-role fallback behind an explicit escape hatch", async () => {
    process.env.ALLOW_PROFILE_ROLE_ADMIN_FALLBACK = "true";
    const { client, queries } = makeSupabase({ profileRole: "admin" });

    await expect(isAdminUser(client as never, "user-1")).resolves.toBe(true);
    expect(queries).toEqual(["user_roles", "profiles"]);
  });
});
