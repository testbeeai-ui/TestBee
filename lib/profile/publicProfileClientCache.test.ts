import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicProfile } from "@/lib/profile/publicProfileService";
import {
  getPublicProfileCached,
  invalidatePublicProfileClientCache,
  peekPublicProfile,
  prefetchPublicProfile,
} from "@/lib/profile/publicProfileClientCache";

const SAMPLE: PublicProfile = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Learner",
  initials: "L",
  avatarColor: "bg-blue-500",
  avatarUrl: null,
  bio: null,
  rdm: 10,
  rank: "Novice",
  memberSince: "Jan 2026",
  questionsAsked: 1,
  answersGiven: 0,
  acceptedAnswers: 0,
  strikeRate: 0,
  subjectStats: { physics: 1, chemistry: 0, math: 0 },
  rdmFromDoubts: 0,
  bountiesWon: 0,
  streakDays: 0,
  badges: [],
  recentDoubts: [],
  recentAnswers: [],
  nextRankRdm: 100,
  academics: [],
  achievements: [],
  rdmBreakdown: {
    answersGiven: 0,
    acceptedBonus: 0,
    mockTests: 0,
    streakBonus: 0,
    bountiesWon: 0,
    doubtsAsked: 0,
  },
};

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  invalidatePublicProfileClientCache();
});

afterEach(() => {
  invalidatePublicProfileClientCache();
  vi.useRealTimers();
});

describe("public profile client cache", () => {
  it("fetches once within the TTL and peeks the stored profile", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(SAMPLE));

    const first = await getPublicProfileCached(SAMPLE.id, fetchFn);
    const second = await getPublicProfileCached(SAMPLE.id, fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(first).toEqual(SAMPLE);
    expect(second).toEqual(SAMPLE);
    expect(peekPublicProfile(SAMPLE.id)).toEqual(SAMPLE);
  });

  it("shares one in-flight request across concurrent callers", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const all = Promise.all([
      getPublicProfileCached(SAMPLE.id, fetchFn),
      getPublicProfileCached(SAMPLE.id, fetchFn),
      prefetchPublicProfile(SAMPLE.id, fetchFn),
    ]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    resolveFetch(jsonResponse(SAMPLE));
    const [a, b, c] = await all;
    expect(a).toEqual(SAMPLE);
    expect(b).toEqual(SAMPLE);
    expect(c).toEqual(SAMPLE);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after the TTL expires", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(async () => jsonResponse(SAMPLE));

    await getPublicProfileCached(SAMPLE.id, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_001);
    expect(peekPublicProfile(SAMPLE.id)).toBeUndefined();

    await getPublicProfileCached(SAMPLE.id, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
