import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/dashboard/studyDaysClient", () => ({
  invalidateStudyDaysCache: vi.fn(),
}));

import {
  EDUBLAST_STUDY_DAYS_REFRESH,
  dispatchStudyDayBumped,
  notifyStudyDaysRefresh,
  studyDaysRefreshReason,
} from "@/lib/dashboard/studyDayBumpEvents";

type Listener = (event: Event) => void;

/** Minimal window stand-in: the module only needs event dispatch and CustomEvent. */
function installWindow(): { reasons: string[]; listeners: Listener[] } {
  const listeners: Listener[] = [];
  const reasons: string[] = [];
  const win = {
    addEventListener: (type: string, fn: Listener) => {
      if (type === EDUBLAST_STUDY_DAYS_REFRESH) listeners.push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: (event: Event) => {
      for (const fn of listeners) fn(event);
      return true;
    },
  };
  vi.stubGlobal("window", win);
  win.addEventListener(EDUBLAST_STUDY_DAYS_REFRESH, (event) => {
    reasons.push(studyDaysRefreshReason(event));
  });
  return { reasons, listeners };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("notifyStudyDaysRefresh", () => {
  it("debounces a burst into a single event", () => {
    const { reasons } = installWindow();
    notifyStudyDaysRefresh("presence");
    notifyStudyDaysRefresh("presence");
    notifyStudyDaysRefresh("presence");
    expect(reasons).toEqual([]);

    vi.advanceTimersByTime(1_500);
    expect(reasons).toEqual(["presence"]);
  });

  it("tags presence-only waves as presence so checklist listeners can skip them", () => {
    const { reasons } = installWindow();
    notifyStudyDaysRefresh("presence");
    vi.advanceTimersByTime(1_500);
    expect(reasons).toEqual(["presence"]);
  });

  it("escalates a coalesced wave to activity if any bump was activity", () => {
    const { reasons } = installWindow();
    notifyStudyDaysRefresh("presence");
    notifyStudyDaysRefresh("activity");
    notifyStudyDaysRefresh("presence");
    vi.advanceTimersByTime(1_500);
    expect(reasons).toEqual(["activity"]);
  });

  it("does not leak an escalated reason into the next wave", () => {
    const { reasons } = installWindow();
    notifyStudyDaysRefresh("activity");
    vi.advanceTimersByTime(1_500);
    notifyStudyDaysRefresh("presence");
    vi.advanceTimersByTime(1_500);
    expect(reasons).toEqual(["activity", "presence"]);
  });

  it("defaults to activity when no reason is given", () => {
    const { reasons } = installWindow();
    notifyStudyDaysRefresh();
    vi.advanceTimersByTime(1_500);
    expect(reasons).toEqual(["activity"]);
  });

  it("treats study day bumps as activity", () => {
    const { reasons } = installWindow();
    dispatchStudyDayBumped({ day: "2026-07-31", deltaMs: 5_000 });
    vi.advanceTimersByTime(1_500);
    expect(reasons).toEqual(["activity"]);
  });
});

describe("studyDaysRefreshReason", () => {
  it("falls back to activity for events without a detail", () => {
    // Older tabs (or a manual dispatch) can emit the event with no detail; treating that as
    // activity keeps the previous always-refresh behaviour rather than silently skipping.
    const bare = { detail: undefined } as unknown as Event;
    expect(studyDaysRefreshReason(bare)).toBe("activity");
  });

  it("reads an explicit presence reason", () => {
    const event = { detail: { reason: "presence" } } as unknown as Event;
    expect(studyDaysRefreshReason(event)).toBe("presence");
  });
});
