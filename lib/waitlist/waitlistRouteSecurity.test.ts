import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  table: null as any,
  sendAmbassadorApplicationEmail: vi.fn(),
  sendWaitlistConfirmationEmail: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: vi.fn(() => mocks.table) })),
  createAdminClient: vi.fn(() => ({ from: vi.fn(() => mocks.table) })),
}));

vi.mock("@/lib/email/sendWaitlistEmails", () => ({
  sendAmbassadorApplicationEmail: mocks.sendAmbassadorApplicationEmail,
  sendWaitlistConfirmationEmail: mocks.sendWaitlistConfirmationEmail,
}));

vi.mock("@/lib/waitlist/waitlistId", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/waitlist/waitlistId")>();
  return {
    ...actual,
    generateNextWaitlistId: vi.fn(async () => "EB-2026-999"),
  };
});

import { POST } from "@/app/api/waitlist/route";

function makeAmbassadorBody(overrides: Record<string, unknown> = {}) {
  return {
    signupTier: "ambassador",
    waitlistId: "EB-2026-205",
    role: "student",
    firstName: "Asha",
    lastName: "Rao",
    email: "asha@example.com",
    phone: "+919999999999",
    city: "Bengaluru",
    state: "Karnataka",
    c1: true,
    c2: true,
    ...overrides,
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("https://www.edublast.in/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeTable({
  byId,
  byEmail,
}: {
  byId?: { id: string; email: string } | null;
  byEmail?: { waitlist_id: string } | null;
}) {
  const updateEq = vi.fn(() => updateBuilder);
  const updateBuilder = { eq: updateEq };
  const table = {
    insert: vi.fn(async () => ({ error: null })),
    update: vi.fn(() => updateBuilder),
    select: vi.fn(() => {
      const filters: Record<string, unknown> = {};
      const selectBuilder = {
        eq: vi.fn((field: string, value: unknown) => {
          filters[field] = value;
          return selectBuilder;
        }),
        maybeSingle: vi.fn(async () => {
          if (filters.waitlist_id) return { data: byId ?? null, error: null };
          if (filters.email) return { data: byEmail ?? null, error: null };
          return { data: null, error: null };
        }),
      };
      return selectBuilder;
    }),
  };

  return table;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.table = null;
  mocks.sendAmbassadorApplicationEmail.mockResolvedValue(true);
  mocks.sendWaitlistConfirmationEmail.mockResolvedValue(true);
});

describe("POST /api/waitlist ambassador ownership checks", () => {
  it("rejects a guessed waitlist ID when the submitted email differs from the stored row", async () => {
    const table = makeTable({
      byId: { id: "row-1", email: "victim@example.com" },
    });
    mocks.table = table;

    const res = await POST(
      makeRequest(
        makeAmbassadorBody({
          waitlistId: "EB-2026-205",
          email: "attacker@example.com",
        })
      )
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain("does not match");
    expect(table.update).not.toHaveBeenCalled();
    expect(mocks.sendAmbassadorApplicationEmail).not.toHaveBeenCalled();
  });

  it("updates only when waitlist ID and submitted email match", async () => {
    const table = makeTable({
      byId: { id: "row-1", email: "asha@example.com" },
    });
    mocks.table = table;

    const res = await POST(makeRequest(makeAmbassadorBody()));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, waitlistId: "EB-2026-205" });
    expect(table.update).toHaveBeenCalledWith(
      expect.objectContaining({ email: "asha@example.com", signup_tier: "ambassador" })
    );
    expect(mocks.sendAmbassadorApplicationEmail).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite an existing email without the issued waitlist ID", async () => {
    const table = makeTable({
      byEmail: { waitlist_id: "EB-2026-205" },
    });
    mocks.table = table;

    const res = await POST(makeRequest(makeAmbassadorBody({ waitlistId: "" })));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toContain("already on the waitlist");
    expect(table.update).not.toHaveBeenCalled();
    expect(mocks.sendAmbassadorApplicationEmail).not.toHaveBeenCalled();
  });
});
