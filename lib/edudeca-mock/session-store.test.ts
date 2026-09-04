import { describe, expect, it } from "vitest";

import {
  applyHandoffQuery,
  collectPapers,
  createEmptySession,
  EDUDECA_MOCK_SET_COUNT,
  formatSetNumber,
  loadSession,
  matchingInProgress,
  mergeAttemptChipStatuses,
  paperStorageKey,
  paperToPauseOnSwitch,
  parseHandoffQuery,
  saveSession,
  scheduleSessionPersist,
  sessionAfterSelectingSet,
  withInProgress,
  withoutPaper,
  type EduDecaMockInProgress,
  type StorageLike,
} from "./session-store";

const SAMPLE_PAPER: EduDecaMockInProgress["questions"] = [
  {
    id: "mock-l1-s04-phy-01",
    tag: "PHYSICS",
    q: "Sample",
    options: ["A", "B"],
    correctIndex: 0,
  },
];

describe("parseHandoffQuery", () => {
  it("reads level and set from the URL", () => {
    expect(parseHandoffQuery(new URLSearchParams("level=2&set=1"))).toEqual({
      level: 2,
      set: 1,
    });
  });

  it("keeps a valid level when set is missing", () => {
    expect(parseHandoffQuery(new URLSearchParams("level=3"))).toEqual({
      level: 3,
      set: null,
    });
  });

  it("ignores invalid level or set", () => {
    expect(parseHandoffQuery(new URLSearchParams("level=9&set=1"))).toEqual({
      level: null,
      set: null,
    });
  });
});

describe("applyHandoffQuery", () => {
  it("remembers both level and set", () => {
    const next = applyHandoffQuery(createEmptySession(), { level: 2, set: 1 });
    expect(next.lastLevel).toBe(2);
    expect(next.lastSet).toBe(1);
  });

  it("updates lastLevel only when set is absent", () => {
    const started = applyHandoffQuery(createEmptySession(), { level: 1, set: 5 });
    const next = applyHandoffQuery(started, { level: 3, set: null });
    expect(next.lastLevel).toBe(3);
    expect(next.lastSet).toBe(5);
  });

  it("keeps a paused paper when the featured set changes", () => {
    const inProgress: EduDecaMockInProgress = {
      level: 1,
      set: 4,
      idx: 2,
      score: 1,
      questions: SAMPLE_PAPER,
    };
    const next = applyHandoffQuery(
      { lastLevel: 1, lastSet: 4, inProgress },
      { level: 2, set: 8 },
    );
    expect(next.lastLevel).toBe(2);
    expect(next.lastSet).toBe(8);
    expect(next.inProgress).toEqual(inProgress);
    expect(matchingInProgress(next)).toBeNull();
    expect(matchingInProgress({ lastLevel: 1, lastSet: 4, inProgress })).toEqual(inProgress);
  });
});

describe("switching EduDeca sets", () => {
  const paperA: EduDecaMockInProgress = {
    level: 1,
    set: 4,
    idx: 2,
    score: 1,
    questions: SAMPLE_PAPER,
    answers: { "mock-l1-s04-phy-01": "Sample" },
  };
  const paperB: EduDecaMockInProgress = {
    level: 2,
    set: 8,
    idx: 0,
    score: 0,
    questions: [
      {
        id: "mock-l2-s08-phy-01",
        tag: "PHYSICS",
        q: "Other",
        options: ["A", "B"],
        correctIndex: 0,
      },
    ],
  };

  it("keeps a started paper when the featured set changes", () => {
    const started = withInProgress({ lastLevel: 1, lastSet: 4 }, paperA);
    const featuredOther = sessionAfterSelectingSet(started, 2, 8);
    expect(paperToPauseOnSwitch(started, 2, 8)).toEqual(paperA);
    expect(matchingInProgress(featuredOther)).toBeNull();
    expect(collectPapers(featuredOther)[paperStorageKey(1, 4)]).toEqual(paperA);
    expect(matchingInProgress({ ...featuredOther, lastLevel: 1, lastSet: 4 })).toEqual(paperA);
  });

  it("pauses the live quiz, not only the featured landing paper", () => {
    const featuredB = { lastLevel: 2 as const, lastSet: 8, inProgress: paperA, papers: { "1-4": paperA } };
    expect(paperToPauseOnSwitch(featuredB, 3, 1, paperA)).toEqual(paperA);
  });

  it("does not pause when picking the same set again", () => {
    const started = withInProgress({ lastLevel: 1, lastSet: 4 }, paperA);
    expect(paperToPauseOnSwitch(started, 1, 4, paperA)).toBeNull();
  });

  it("keeps the first paper after a second paper is started and finished", () => {
    const startedA = withInProgress({ lastLevel: 1, lastSet: 4 }, paperA);
    const featuredB = sessionAfterSelectingSet(startedA, 2, 8);
    const startedB = withInProgress(featuredB, paperB);
    expect(collectPapers(startedB)[paperStorageKey(1, 4)]).toEqual(paperA);
    const finishedB = withoutPaper(startedB, 2, 8);
    expect(collectPapers(finishedB)[paperStorageKey(1, 4)]).toEqual(paperA);
    expect(collectPapers(finishedB)[paperStorageKey(2, 8)]).toBeUndefined();
  });

  it("round-trips paused papers through localStorage", () => {
    const data: Record<string, string> = {};
    const storage: StorageLike = {
      getItem: (key) => data[key] ?? null,
      setItem: (key, value) => {
        data[key] = value;
      },
    };
    const started = withInProgress({ lastLevel: 1, lastSet: 4 }, paperA);
    const switched = sessionAfterSelectingSet(started, 2, 8);
    saveSession(storage, switched);
    const loaded = loadSession(storage);
    expect(matchingInProgress({ ...loaded, lastLevel: 1, lastSet: 4 })).toEqual(paperA);
  });

  it("does not write localStorage until after the scheduled turn", () => {
    const data: Record<string, string> = {};
    const storage: StorageLike = {
      getItem: (key) => data[key] ?? null,
      setItem: (key, value) => {
        data[key] = value;
      },
    };
    const queued: Array<() => void> = [];
    const started = withInProgress({ lastLevel: 1, lastSet: 4 }, paperA);
    scheduleSessionPersist(storage, started, (write) => queued.push(write));
    expect(Object.keys(data)).toHaveLength(0);
    expect(queued).toHaveLength(1);
    queued[0]!();
    expect(matchingInProgress(loadSession(storage))).toEqual(paperA);
  });

  it("marks local papers in progress and lets completed remote rows win", () => {
    const started = withInProgress({ lastLevel: 1, lastSet: 4 }, paperA);
    expect(mergeAttemptChipStatuses(collectPapers(started), [])).toEqual({
      "1-4": "inprogress",
    });
    expect(
      mergeAttemptChipStatuses(collectPapers(started), [
        { level: 1, set: 4, status: "completed" },
        { level: 1, set: 9, status: "inprogress" },
      ]),
    ).toEqual({
      "1-4": "completed",
      "1-9": "inprogress",
    });
  });
});

describe("EDUDECA_MOCK_SET_COUNT", () => {
  it("exposes all 20 paper sets", () => {
    expect(EDUDECA_MOCK_SET_COUNT).toBe(20);
  });
});

describe("formatSetNumber", () => {
  it("pads single-digit sets", () => {
    expect(formatSetNumber(1)).toBe("01");
    expect(formatSetNumber(9)).toBe("09");
  });

  it("leaves two-digit sets unpadded", () => {
    expect(formatSetNumber(10)).toBe("10");
    expect(formatSetNumber(20)).toBe("20");
  });
});
