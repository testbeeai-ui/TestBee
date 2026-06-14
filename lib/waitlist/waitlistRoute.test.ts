import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  sendAmbassadorApplicationEmail: vi.fn(),
  sendWaitlistConfirmationEmail: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/email/sendWaitlistEmails", () => ({
  sendAmbassadorApplicationEmail: mocks.sendAmbassadorApplicationEmail,
  sendWaitlistConfirmationEmail: mocks.sendWaitlistConfirmationEmail,
}));

import { POST } from "@/app/api/waitlist/route";

function ambassadorRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signupTier: "ambassador",
      waitlistId: "EB-2026-253",
      role: "student",
      firstName: "Arjun",
      lastName: "Sharma",
      email: "student@example.com",
      phone: "9876543210",
      city: "Delhi",
      state: "Delhi",
      c1: true,
      c2: true,
      ...overrides,
    }),
  });
}

function createWaitlistTableMock(existing: { id: string; email: string } | null) {
  const selectQuery = {
    eq: vi.fn(function eq(this: unknown) {
      return this;
    }),
    maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
  };
  const updateFilters: Array<{ column: string; value: unknown }> = [];
  const updateQuery = {
    eq: vi.fn(function eq(this: unknown, column: string, value: unknown) {
      updateFilters.push({ column, value });
      return this;
    }),
    select: vi.fn(function select(this: unknown) {
      return this;
    }),
    maybeSingle: vi.fn(async () => ({
      data: existing ? { waitlist_id: "EB-2026-253" } : null,
      error: null,
    })),
  };
  const table = {
    select: vi.fn(() => selectQuery),
    update: vi.fn(() => updateQuery),
  };
  const client = {
    from: vi.fn(() => table),
  };

  return { client, table, updateFilters };
}

describe("POST /api/waitlist ambassador upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendAmbassadorApplicationEmail.mockResolvedValue(true);
    mocks.sendWaitlistConfirmationEmail.mockResolvedValue(true);
  });

  it("rejects a public waitlist ID when the submitted email does not own it", async () => {
    const { client, table } = createWaitlistTableMock({
      id: "row-1",
      email: "victim@example.com",
    });
    mocks.createClient.mockResolvedValue(client);
    mocks.createAdminClient.mockReturnValue(client);

    const response = await POST(
      ambassadorRequest({ email: "attacker@example.com" })
    );

    expect(response.status).toBe(409);
    expect(table.update).not.toHaveBeenCalled();
    expect(mocks.sendAmbassadorApplicationEmail).not.toHaveBeenCalled();
  });

  it("still upgrades the waitlist row when the submitted email matches", async () => {
    const { client, table, updateFilters } = createWaitlistTableMock({
      id: "row-1",
      email: "STUDENT@example.com",
    });
    mocks.createClient.mockResolvedValue(client);
    mocks.createAdminClient.mockReturnValue(client);

    const response = await POST(ambassadorRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ ok: true, waitlistId: "EB-2026-253" });
    expect(table.update).toHaveBeenCalledTimes(1);
    expect(updateFilters).toEqual([
      { column: "waitlist_id", value: "EB-2026-253" },
      { column: "email", value: "student@example.com" },
    ]);
    expect(mocks.sendAmbassadorApplicationEmail).toHaveBeenCalledTimes(1);
  });
});
