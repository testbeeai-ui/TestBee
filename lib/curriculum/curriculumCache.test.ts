import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The full-curriculum load fans out to one query per (subject, class) pair, so a cache miss
 * is ~6 round trips to Tokyo. These tests pin the cache/dedupe behaviour that keeps a
 * Learn Hub -> chapter -> lesson walk down to a single fan-out.
 */

type SelectResult = { data: unknown; error: { message: string; code?: string } | null };

/** physics, chemistry, math x class 11, 12 */
const EXPECTED_FAN_OUT = 6;

const state = {
  selects: 0,
  result: (): SelectResult => ({ data: [], error: null }),
  gate: null as null | Promise<void>,
};

vi.mock("@/integrations/supabase/client", () => {
  const builder = () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: async () => {
        state.selects += 1;
        if (state.gate) await state.gate;
        return state.result();
      },
    };
    return chain;
  };
  return { supabase: { from: builder } };
});

const { fetchFullCurriculumFromSupabase, invalidateFullCurriculumCache } = await import(
  "@/lib/curriculum/curriculumService"
);

function unitRows() {
  return [
    {
      id: "u1",
      subject: "physics",
      class_level: 11,
      unit_label: "Unit 1",
      unit_title: "Mechanics",
      exam_relevance: ["jee"],
      sort_order: 1,
      curriculum_chapters: [
        {
          id: "c1",
          title: "Units and Measurements",
          sort_order: 1,
          curriculum_topics: [
            { id: "t1", title: "Significant Figures", sort_order: 1, curriculum_subtopics: [] },
          ],
        },
      ],
    },
  ];
}

beforeEach(() => {
  state.selects = 0;
  state.gate = null;
  state.result = () => ({ data: unitRows(), error: null });
  invalidateFullCurriculumCache();
});

afterEach(() => {
  invalidateFullCurriculumCache();
  vi.useRealTimers();
});

describe("fetchFullCurriculumFromSupabase caching", () => {
  it("fans out once and serves later navigations from memory", async () => {
    const first = await fetchFullCurriculumFromSupabase();
    expect(state.selects).toBe(EXPECTED_FAN_OUT);

    const second = await fetchFullCurriculumFromSupabase();
    expect(state.selects).toBe(EXPECTED_FAN_OUT);
    expect(second).toBe(first);
  });

  it("shares one fan-out across concurrent mounts", async () => {
    let release: () => void = () => {};
    state.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const all = Promise.all([
      fetchFullCurriculumFromSupabase(),
      fetchFullCurriculumFromSupabase(),
      fetchFullCurriculumFromSupabase(),
    ]);
    release();
    const [a, b, c] = await all;

    expect(a).toBe(b);
    expect(b).toBe(c);
    // 3 subjects x 2 class levels: one fan-out, not three.
    expect(state.selects).toBe(EXPECTED_FAN_OUT);
  });

  it("does not cache a failed load, so a retry hits the database", async () => {
    state.result = () => ({ data: null, error: { message: "unreachable", code: "PGRST000" } });
    const failed = await fetchFullCurriculumFromSupabase();
    expect(failed).toBeNull();
    const afterFail = state.selects;

    state.result = () => ({ data: unitRows(), error: null });
    const retried = await fetchFullCurriculumFromSupabase();
    expect(state.selects).toBeGreaterThan(afterFail);
    expect(retried?.length).toBeGreaterThan(0);
  });

  it("does not cache an empty result", async () => {
    state.result = () => ({ data: [], error: null });
    await fetchFullCurriculumFromSupabase();
    const afterEmpty = state.selects;

    await fetchFullCurriculumFromSupabase();
    expect(state.selects).toBeGreaterThan(afterEmpty);
  });

  it("re-reads once the TTL expires", async () => {
    vi.useFakeTimers();
    await fetchFullCurriculumFromSupabase();
    const fanOut = state.selects;

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    await fetchFullCurriculumFromSupabase();
    expect(state.selects).toBe(fanOut * 2);
  });

  it("re-reads after an explicit invalidation", async () => {
    await fetchFullCurriculumFromSupabase();
    const fanOut = state.selects;

    invalidateFullCurriculumCache();
    await fetchFullCurriculumFromSupabase();
    expect(state.selects).toBe(fanOut * 2);
  });
});
