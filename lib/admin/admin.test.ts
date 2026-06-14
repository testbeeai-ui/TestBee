import { describe, expect, it, vi } from "vitest";
import { isAdminUser } from "@/lib/admin/admin";

function createSupabaseMock(rows: Array<{ id: string }>, error: Error | null = null) {
  const query = {
    select: vi.fn(function select(this: unknown) {
      return this;
    }),
    eq: vi.fn(function eq(this: unknown) {
      return this;
    }),
    limit: vi.fn(async () => ({ data: rows, error })),
  };
  const from = vi.fn(() => query);

  return { supabase: { from }, from };
}

describe("isAdminUser", () => {
  it("returns true when the user has an admin user_roles row", async () => {
    const { supabase } = createSupabaseMock([{ id: "role-1" }]);

    await expect(isAdminUser(supabase as never, "user-1")).resolves.toBe(true);
  });

  it("does not treat an editable profile role as admin authority", async () => {
    const { supabase, from } = createSupabaseMock([]);

    await expect(isAdminUser(supabase as never, "user-1")).resolves.toBe(false);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("user_roles");
  });

  it("fails closed when the role lookup errors", async () => {
    const { supabase } = createSupabaseMock([], new Error("lookup failed"));

    await expect(isAdminUser(supabase as never, "user-1")).resolves.toBe(false);
  });
});
