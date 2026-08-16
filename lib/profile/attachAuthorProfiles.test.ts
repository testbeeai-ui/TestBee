import { describe, expect, it, vi } from "vitest";
import {
  attachAuthorProfiles,
  attachGyanFeedAuthors,
  mergeAuthorProfiles,
  unwrapProfileEmbed,
} from "./attachAuthorProfiles";

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
  it("does not call RPC when every row already has a name", async () => {
    const rpc = vi.fn();
    const rows = await attachAuthorProfiles({ rpc }, [
      { user_id: "u1", profiles: { name: "San L.", avatar_url: null } },
    ]);
    expect(rpc).not.toHaveBeenCalled();
    expect(rows[0]?.profiles).toEqual({ name: "San L.", avatar_url: null });
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
  });
});
