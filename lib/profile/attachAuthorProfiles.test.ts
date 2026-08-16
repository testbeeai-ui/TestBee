import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachAuthorProfiles,
  attachGyanFeedAuthors,
  mergeAuthorProfiles,
  unwrapProfileEmbed,
} from "./attachAuthorProfiles";
import {
  invalidatePublicProfileClientCache,
  peekPublicProfile,
} from "./publicProfileClientCache";

afterEach(() => {
  invalidatePublicProfileClientCache();
});

describe("unwrapProfileEmbed", () => {
  it("reads a many-to-one object", () => {
    expect(unwrapProfileEmbed({ name: "SHRUTI DHUPAD", avatar_url: "https://img" })).toEqual({
      name: "SHRUTI DHUPAD",
      avatar_url: "https://img",
    });
  });

  it("unwraps a one-to-many array from PostgREST", () => {
    expect(unwrapProfileEmbed([{ name: "SHRUTI DHUPAD", avatar_url: null }])).toEqual({
      name: "SHRUTI DHUPAD",
      avatar_url: null,
    });
  });

  it("returns null when the embed is missing", () => {
    expect(unwrapProfileEmbed(null)).toBeNull();
    expect(unwrapProfileEmbed(undefined)).toBeNull();
    expect(unwrapProfileEmbed([])).toBeNull();
  });
});

describe("mergeAuthorProfiles", () => {
  it("fills Learner fallbacks from public previews", () => {
    const merged = mergeAuthorProfiles(
      [{ user_id: "u1", profiles: null, title: "post" }],
      [{ id: "u1", name: "SHRUTI DHUPAD", avatar_url: "https://img" }]
    );
    expect(merged[0]?.profiles).toEqual({
      name: "SHRUTI DHUPAD",
      avatar_url: "https://img",
    });
  });

  it("keeps an embedded name when present", () => {
    const merged = mergeAuthorProfiles(
      [{ user_id: "u1", profiles: { name: "San L.", avatar_url: null } }],
      [{ id: "u1", name: "Ignored", avatar_url: "https://img" }]
    );
    expect(merged[0]?.profiles?.name).toBe("San L.");
  });

  it("copies public role from the preview so Gyan++ can tell AI from students", () => {
    const merged = mergeAuthorProfiles(
      [{ user_id: "bot", profiles: null }],
      [{ id: "bot", name: "Prof-Pi", avatar_url: null, role: "ai" }]
    );
    expect(merged[0]?.profiles).toEqual({
      name: "Prof-Pi",
      avatar_url: null,
      role: "ai",
    });
  });
});

describe("attachAuthorProfiles", () => {
  it("still batches one RPC so hover can paint from cache", async () => {
    invalidatePublicProfileClientCache();
    const rpc = vi.fn(async () => ({
      data: [
        {
          id: "u1",
          name: "San L.",
          avatar_url: null,
          rdm: 12,
          questions_asked: 3,
          answers_given: 1,
        },
      ],
      error: null,
    }));
    const rows = await attachAuthorProfiles({ rpc }, [
      { user_id: "u1", profiles: { name: "San L.", avatar_url: null } },
    ]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rows[0]?.profiles).toEqual({ name: "San L.", avatar_url: null });
    expect(peekPublicProfile("u1")?.rdm).toBe(12);
    expect(peekPublicProfile("u1")?.questionsAsked).toBe(3);

    await attachAuthorProfiles({ rpc }, [
      { user_id: "u1", profiles: { name: "San L.", avatar_url: null } },
    ]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("loads missing names in one RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ id: "u1", name: "SHRUTI DHUPAD", avatar_url: "https://img" }],
      error: null,
    }));
    const rows = await attachAuthorProfiles({ rpc }, [{ user_id: "u1", profiles: null }]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("profile_public_previews", { p_ids: ["u1"] });
    expect(rows[0]?.profiles).toEqual({
      name: "SHRUTI DHUPAD",
      avatar_url: "https://img",
    });
  });
});

describe("attachGyanFeedAuthors", () => {
  it("fills the asker and nested answers in one RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        { id: "u1", name: "SHRUTI DHUPAD", avatar_url: null, role: "student" },
        { id: "bot", name: "Prof-Pi", avatar_url: null, role: "ai" },
      ],
      error: null,
    }));
    const rows = await attachGyanFeedAuthors({ rpc }, [
      {
        user_id: "u1",
        profiles: null,
        doubt_answers: [{ user_id: "bot", profiles: null, body: "Answer:" }],
      },
    ]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rows[0]?.profiles).toEqual({
      name: "SHRUTI DHUPAD",
      avatar_url: null,
      role: "student",
    });
    expect(rows[0]?.doubt_answers?.[0]?.profiles).toEqual({
      name: "Prof-Pi",
      avatar_url: null,
      role: "ai",
    });
    expect(peekPublicProfile("bot")?.name).toBe("Prof-Pi");
  });

  it("chunks unique authors into batches of 50", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `u${i}`);
    const rpc = vi.fn(async (_fn: string, args: { p_ids: string[] }) => ({
      data: args.p_ids.map((id) => ({ id, name: id, avatar_url: null })),
      error: null,
    }));
    await attachAuthorProfiles(
      { rpc },
      ids.map((user_id) => ({ user_id, profiles: null }))
    );
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]?.[1]?.p_ids).toHaveLength(50);
    expect(rpc.mock.calls[1]?.[1]?.p_ids).toHaveLength(1);
  });
});
