import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchBitsAttemptsBySet,
  fetchFormulaPracticeAttempts,
} from "@/lib/play/bits/bitsAttemptService";

vi.mock("@/lib/auth/safeSession", () => ({
  safeGetSession: async () => ({ session: { access_token: "token-1" } }),
}));

const scope = {
  board: "CBSE",
  subject: "physics",
  classLevel: 11,
  topic: "Units and Measurements",
  subtopicName: "Significant Figures",
  level: "advanced",
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function requestedUrl(call = 0): URL {
  return new URL(String(fetchMock.mock.calls[call][0]), "https://example.test");
}

describe("fetchBitsAttemptsBySet", () => {
  it("requests every set in one call and keys the result by set", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        attempts: { "1": { bitsSignature: "sig-1" }, "2": null, "3": { bitsSignature: "sig-3" } },
      })
    );

    const out = await fetchBitsAttemptsBySet(scope, [1, 2, 3]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = requestedUrl();
    expect(url.searchParams.get("sets")).toBe("1,2,3");
    expect(url.searchParams.get("level")).toBe("advanced");
    expect(url.searchParams.get("set")).toBeNull();
    expect(out).toEqual({
      1: { bitsSignature: "sig-1" },
      2: null,
      3: { bitsSignature: "sig-3" },
    });
  });

  it("fills missing sets with null", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ attempts: {} }));

    expect(await fetchBitsAttemptsBySet(scope, [1, 4])).toEqual({ 1: null, 4: null });
  });

  it("treats 401 as no attempts rather than throwing", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));

    expect(await fetchBitsAttemptsBySet(scope, [1, 2])).toEqual({});
  });

  it("throws on other failures", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Server error" }, 500));

    await expect(fetchBitsAttemptsBySet(scope, [1])).rejects.toThrow("Failed to fetch quiz attempts");
  });

  it("skips the request entirely when no sets are asked for", async () => {
    expect(await fetchBitsAttemptsBySet(scope, [])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchFormulaPracticeAttempts", () => {
  it("requests every index in one call", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ formulaAttempts: { "0": { bitsSignature: "sig-0" }, "2": null } })
    );

    const out = await fetchFormulaPracticeAttempts(scope, [0, 1, 2]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl().searchParams.get("formulaPracticeIndices")).toBe("0,1,2");
    expect(out).toEqual({ 0: { bitsSignature: "sig-0" }, 1: null, 2: null });
  });

  it("splits oversized index lists into chunks the route accepts", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ formulaAttempts: {} }));
    const indices = Array.from({ length: 120 }, (_, i) => i);

    const out = await fetchFormulaPracticeAttempts(scope, indices);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestedUrl(0).searchParams.get("formulaPracticeIndices")?.split(",")).toHaveLength(50);
    expect(requestedUrl(2).searchParams.get("formulaPracticeIndices")?.split(",")).toHaveLength(20);
    expect(Object.keys(out)).toHaveLength(120);
  });

  it("treats 401 as no attempts", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));

    expect(await fetchFormulaPracticeAttempts(scope, [0, 1])).toEqual({});
  });

  it("skips the request entirely when no indices are asked for", async () => {
    expect(await fetchFormulaPracticeAttempts(scope, [])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
