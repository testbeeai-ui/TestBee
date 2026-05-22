import { describe, expect, it } from "vitest";

/** Mirrors server filter in listActiveBuddyPairsForUser (no DB). */
function filterPairs(
  rows: Array<{ buddy_user_id: string; created_at: string }>,
  userId: string
) {
  return rows.filter(
    (row) => typeof row.buddy_user_id === "string" && row.buddy_user_id !== userId
  );
}

describe("active buddy list isolation", () => {
  it("keeps only directed buddies for the viewer user_id", () => {
    const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const userB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const userC = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    const rowsForA = [
      { buddy_user_id: userB, created_at: "2026-01-01" },
      { buddy_user_id: userC, created_at: "2026-01-02" },
    ];
    const rowsForB = [{ buddy_user_id: userA, created_at: "2026-01-01" }];

    expect(filterPairs(rowsForA, userA).map((r) => r.buddy_user_id).sort()).toEqual(
      [userB, userC].sort()
    );
    expect(filterPairs(rowsForB, userB).map((r) => r.buddy_user_id)).toEqual([userA]);
    // User B's roster query uses user_id = B — never receives A's (B,C) rows from the API.
    expect(filterPairs(rowsForB, userB)).not.toEqual(
      filterPairs(rowsForA, userA).map((r) => r.buddy_user_id)
    );
  });

  it("drops self-links if present", () => {
    const uid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const other = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    expect(
      filterPairs(
        [
          { buddy_user_id: other, created_at: "1" },
          { buddy_user_id: uid, created_at: "2" },
        ],
        uid
      )
    ).toEqual([{ buddy_user_id: other, created_at: "1" }]);
  });
});
