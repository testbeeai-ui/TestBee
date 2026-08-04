import { describe, expect, it } from "vitest";
import { isAdminUser } from "@/lib/admin/admin";

type Row = Record<string, unknown> | null;

function makeClient(opts: {
  roleRow?: Row;
  profileRole?: string | null;
  roleError?: boolean;
  profileError?: boolean;
  track?: { tables: string[] };
}) {
  const track = opts.track ?? { tables: [] };
  return {
    from(table: string) {
      track.tables.push(table);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          if (table === "user_roles") {
            if (opts.roleError) return { data: null, error: { message: "roles boom" } };
            return { data: opts.roleRow ?? null, error: null };
          }
          if (opts.profileError) return { data: null, error: { message: "profile boom" } };
          return {
            data: opts.profileRole != null ? { role: opts.profileRole } : { role: null },
            error: null,
          };
        },
      };
    },
  };
}

describe("isAdminUser", () => {
  it("fires user_roles and profiles lookups in parallel", async () => {
    const track = { tables: [] as string[] };
    const client = makeClient({ track, profileRole: "student" });
    await isAdminUser(client as never, "u1");
    expect(track.tables).toEqual(["user_roles", "profiles"]);
  });

  it("returns true when user_roles has an admin row", async () => {
    const client = makeClient({ roleRow: { id: "r1" }, profileRole: "student" });
    await expect(isAdminUser(client as never, "u1")).resolves.toBe(true);
  });

  it("returns true when profiles.role is admin", async () => {
    const client = makeClient({ profileRole: "admin" });
    await expect(isAdminUser(client as never, "u1")).resolves.toBe(true);
  });

  it("returns false for non-admins", async () => {
    const client = makeClient({ profileRole: "student" });
    await expect(isAdminUser(client as never, "u1")).resolves.toBe(false);
  });

  it("returns false when the profile read fails and roles missed", async () => {
    const client = makeClient({ profileError: true });
    await expect(isAdminUser(client as never, "u1")).resolves.toBe(false);
  });
});
