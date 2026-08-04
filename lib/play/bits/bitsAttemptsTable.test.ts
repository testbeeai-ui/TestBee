import { describe, it, expect, vi } from "vitest";
import { readBitsAttemptRows } from "@/lib/play/bits/bitsAttemptsTable";

type Row = { attempt_key: string; attempt: unknown };

function fakeClient(
  rows: Row[],
  error: { message: string } | null = null
): { client: unknown; seen: { table?: string; col?: string; val?: string; keys?: string[] } } {
  const seen: { table?: string; col?: string; val?: string; keys?: string[] } = {};
  const client = {
    from: (table: string) => {
      seen.table = table;
      return {
        select: () => ({
          eq: (col: string, val: string) => {
            seen.col = col;
            seen.val = val;
            return {
              in: async (_col2: string, keys: string[]) => {
                seen.keys = keys;
                return { data: error ? null : rows, error };
              },
            };
          },
        }),
      };
    },
  };
  return { client, seen };
}

describe("readBitsAttemptRows", () => {
  it("returns rows keyed by attempt_key", async () => {
    const { client, seen } = fakeClient([
      { attempt_key: "a", attempt: { correctCount: 1 } },
      { attempt_key: "b", attempt: { correctCount: 2 } },
    ]);

    const out = await readBitsAttemptRows(client, "user-1", ["a", "b"]);

    expect(out).toEqual({ a: { correctCount: 1 }, b: { correctCount: 2 } });
    expect(seen.table).toBe("student_bits_attempts");
    expect(seen.col).toBe("user_id");
    expect(seen.val).toBe("user-1");
  });

  it("omits keys with no row so callers can fall back", async () => {
    const { client } = fakeClient([{ attempt_key: "a", attempt: { correctCount: 1 } }]);

    const out = await readBitsAttemptRows(client, "user-1", ["a", "missing"]);

    expect(Object.keys(out)).toEqual(["a"]);
  });

  it("skips rows whose attempt payload is not an object", async () => {
    const { client } = fakeClient([
      { attempt_key: "a", attempt: null },
      { attempt_key: "b", attempt: "oops" },
      { attempt_key: "c", attempt: { correctCount: 3 } },
    ]);

    const out = await readBitsAttemptRows(client, "user-1", ["a", "b", "c"]);

    expect(out).toEqual({ c: { correctCount: 3 } });
  });

  it("dedupes keys before querying", async () => {
    const { client, seen } = fakeClient([]);

    await readBitsAttemptRows(client, "user-1", ["a", "a", "b"]);

    expect(seen.keys).toEqual(["a", "b"]);
  });

  it("does not hit the database for an empty key list", async () => {
    const from = vi.fn();

    const out = await readBitsAttemptRows({ from }, "user-1", []);

    expect(out).toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it("throws the database error message", async () => {
    const { client } = fakeClient([], { message: "boom" });

    await expect(readBitsAttemptRows(client, "user-1", ["a"])).rejects.toThrow("boom");
  });
});
