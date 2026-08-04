import { describe, it, expect, vi, beforeEach } from "vitest";

const getSupabaseAndUser = vi.fn();

vi.mock("@/lib/auth/apiAuth", () => ({
  getSupabaseAndUser: (request: Request) => getSupabaseAndUser(request),
}));

vi.mock("@/lib/classroom/syncAssignmentTaskProgress", () => ({
  syncAssignmentTasksForKinds: vi.fn(),
}));

const { GET } = await import("@/app/api/user/bits-attempts/route");

const SCOPE = {
  board: "CBSE",
  subject: "physics",
  classLevel: "11",
  topic: "Units and Measurements",
  subtopicName: "Significant Figures",
  level: "advanced",
};

/** Mirrors makeAttemptKey in the route. */
function key(opts: { set?: number; formulaPracticeIndex?: number } = {}): string {
  const base = [
    "cbse",
    "physics",
    "11",
    SCOPE.topic.toLowerCase(),
    SCOPE.subtopicName.toLowerCase(),
    "advanced",
  ].join("||");
  if (opts.set != null) return `${base}||set:${opts.set}`;
  if (opts.formulaPracticeIndex != null) return `${base}||fp:${opts.formulaPracticeIndex}`;
  return base;
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    board: "CBSE",
    subject: "physics",
    classLevel: 11,
    topic: SCOPE.topic,
    subtopicName: SCOPE.subtopicName,
    level: "advanced",
    bitsSignature: "sig-1",
    totalQuestions: 5,
    correctCount: 3,
    wrongCount: 2,
    selectedAnswers: {},
    submittedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

type Counts = { batchSelects: number; singleSelects: number; profileSelects: number };

function fakeSupabase(opts: {
  tableRows?: Record<string, unknown>;
  profileAttempts?: Record<string, unknown> | null;
}): { supabase: unknown; counts: Counts } {
  const tableRows = opts.tableRows ?? {};
  const counts: Counts = { batchSelects: 0, singleSelects: 0, profileSelects: 0 };

  const supabase = {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                counts.profileSelects += 1;
                return {
                  data: { bits_test_attempts: opts.profileAttempts ?? null },
                  error: null,
                };
              },
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            in: async (_col: string, keys: string[]) => {
              counts.batchSelects += 1;
              return {
                data: keys
                  .filter((k) => tableRows[k])
                  .map((k) => ({ attempt_key: k, attempt: tableRows[k] })),
                error: null,
              };
            },
            eq: (_col: string, attemptKey: string) => ({
              maybeSingle: async () => {
                counts.singleSelects += 1;
                return { data: { attempt: tableRows[attemptKey] ?? null }, error: null };
              },
            }),
          }),
        }),
      };
    },
  };

  return { supabase, counts };
}

function url(extra: Record<string, string>): string {
  const search = new URLSearchParams({ ...SCOPE, ...extra });
  return `https://example.test/api/user/bits-attempts?${search.toString()}`;
}

beforeEach(() => {
  getSupabaseAndUser.mockReset();
});

function authAs(supabase: unknown) {
  getSupabaseAndUser.mockResolvedValue({ supabase, user: { id: "user-1" } });
}

describe("GET /api/user/bits-attempts — batched sets", () => {
  it("returns every requested set from a single table query", async () => {
    const { supabase, counts } = fakeSupabase({
      tableRows: {
        [key({ set: 1 })]: record({ correctCount: 1 }),
        [key({ set: 3 })]: record({ correctCount: 3 }),
      },
    });
    authAs(supabase);

    const res = await GET(new Request(url({ sets: "1,2,3" })));
    const body = (await res.json()) as { attempts: Record<string, { correctCount: number } | null> };

    expect(res.status).toBe(200);
    expect(body.attempts["1"]?.correctCount).toBe(1);
    expect(body.attempts["2"]).toBeNull();
    expect(body.attempts["3"]?.correctCount).toBe(3);
    expect(counts.batchSelects).toBe(1);
    expect(counts.singleSelects).toBe(0);
  });

  it("falls back to the legacy un-suffixed key for set 1", async () => {
    const { supabase } = fakeSupabase({
      tableRows: { [key()]: record({ correctCount: 4 }) },
    });
    authAs(supabase);

    const res = await GET(new Request(url({ sets: "1,2" })));
    const body = (await res.json()) as { attempts: Record<string, { correctCount: number } | null> };

    expect(body.attempts["1"]?.correctCount).toBe(4);
    expect(body.attempts["2"]).toBeNull();
  });

  it("prefers the set-suffixed row over the legacy row", async () => {
    const { supabase } = fakeSupabase({
      tableRows: {
        [key({ set: 1 })]: record({ correctCount: 9 }),
        [key()]: record({ correctCount: 4 }),
      },
    });
    authAs(supabase);

    const res = await GET(new Request(url({ sets: "1" })));
    const body = (await res.json()) as { attempts: Record<string, { correctCount: number } | null> };

    expect(body.attempts["1"]?.correctCount).toBe(9);
  });

  it("falls back to the legacy profile store for set 1", async () => {
    const { supabase } = fakeSupabase({
      profileAttempts: { [key()]: record({ correctCount: 7 }) },
    });
    authAs(supabase);

    const res = await GET(new Request(url({ sets: "1,2" })));
    const body = (await res.json()) as { attempts: Record<string, { correctCount: number } | null> };

    expect(body.attempts["1"]?.correctCount).toBe(7);
    expect(body.attempts["2"]).toBeNull();
  });

  it("reads the profile at most once no matter how many keys miss", async () => {
    const { supabase, counts } = fakeSupabase({ profileAttempts: {} });
    authAs(supabase);

    await GET(new Request(url({ sets: "1,2,3,4,5,6" })));

    expect(counts.batchSelects).toBe(1);
    expect(counts.profileSelects).toBe(1);
  });

  it("rejects out-of-range sets", async () => {
    authAs(fakeSupabase({}).supabase);

    const res = await GET(new Request(url({ sets: "1,7" })));

    expect(res.status).toBe(400);
  });

  it("rejects sets on non-advanced levels", async () => {
    authAs(fakeSupabase({}).supabase);

    const res = await GET(new Request(url({ level: "basics", sets: "1,2" })));

    expect(res.status).toBe(400);
  });
});

describe("GET /api/user/bits-attempts — batched formula indices", () => {
  it("returns every requested index from a single table query", async () => {
    const { supabase, counts } = fakeSupabase({
      tableRows: {
        [key({ formulaPracticeIndex: 0 })]: record({ correctCount: 1 }),
        [key({ formulaPracticeIndex: 2 })]: record({ correctCount: 2 }),
      },
    });
    authAs(supabase);

    const res = await GET(new Request(url({ formulaPracticeIndices: "0,1,2" })));
    const body = (await res.json()) as {
      formulaAttempts: Record<string, { correctCount: number } | null>;
    };

    expect(body.formulaAttempts["0"]?.correctCount).toBe(1);
    expect(body.formulaAttempts["1"]).toBeNull();
    expect(body.formulaAttempts["2"]?.correctCount).toBe(2);
    expect(counts.batchSelects).toBe(1);
  });

  it("rejects a malformed index list", async () => {
    authAs(fakeSupabase({}).supabase);

    const res = await GET(new Request(url({ formulaPracticeIndices: "0,abc" })));

    expect(res.status).toBe(400);
  });

  it("rejects an index list longer than the cap", async () => {
    authAs(fakeSupabase({}).supabase);

    const indices = Array.from({ length: 61 }, (_, i) => i).join(",");
    const res = await GET(new Request(url({ formulaPracticeIndices: indices })));

    expect(res.status).toBe(400);
  });
});

describe("GET /api/user/bits-attempts — single-key paths still work", () => {
  it("serves a single advanced set", async () => {
    const { supabase, counts } = fakeSupabase({
      tableRows: { [key({ set: 2 })]: record({ correctCount: 5 }) },
    });
    authAs(supabase);

    const res = await GET(new Request(url({ set: "2" })));
    const body = (await res.json()) as { attempt: { correctCount: number } | null };

    expect(body.attempt?.correctCount).toBe(5);
    expect(counts.singleSelects).toBe(1);
    expect(counts.batchSelects).toBe(0);
  });

  it("returns 401 without a session", async () => {
    getSupabaseAndUser.mockResolvedValue(null);

    const res = await GET(new Request(url({ sets: "1" })));

    expect(res.status).toBe(401);
  });
});
