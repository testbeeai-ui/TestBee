import { describe, expect, it } from "vitest";
import {
  clearPyqAttempt,
  loadPyqAttempts,
  parsePyqAttemptMap,
  recordPyqAttempt,
  tallyChapterAttempts,
  type PyqAttemptMap,
} from "./pyqAttemptStore";

function memoryStorage() {
  const bag = new Map<string, string>();
  return {
    getItem: (key: string) => bag.get(key) ?? null,
    setItem: (key: string, value: string) => {
      bag.set(key, value);
    },
    removeItem: (key: string) => {
      bag.delete(key);
    },
  };
}

const right = {
  questionId: "q1",
  subject: "math",
  chapterSlug: "application-of-derivatives",
  verdict: "right" as const,
};

describe("pyq attempt store", () => {
  it("ignores malformed payloads", () => {
    expect(parsePyqAttemptMap(null)).toEqual({});
    expect(parsePyqAttemptMap("not-json")).toEqual({});
    expect(parsePyqAttemptMap('{"q1":{"questionId":"other","subject":"math","chapterSlug":"x","verdict":"right"}}')).toEqual({});
  });

  it("tallies one chapter and replaces a changed answer", () => {
    const storage = memoryStorage();
    recordPyqAttempt("user-1", right, storage);
    recordPyqAttempt(
      "user-1",
      {
        questionId: "q2",
        subject: "math",
        chapterSlug: "application-of-derivatives",
        verdict: "wrong",
      },
      storage
    );
    recordPyqAttempt(
      "user-1",
      {
        questionId: "q3",
        subject: "physics",
        chapterSlug: "laws-of-motion",
        verdict: "right",
      },
      storage
    );
    recordPyqAttempt("user-1", { ...right, verdict: "wrong" }, storage);

    expect(tallyChapterAttempts(load(storage, "user-1"), "math", "application-of-derivatives")).toEqual({
      attempted: 2,
      right: 0,
      wrong: 2,
    });
  });

  it("drops a cleared answer from the tally", () => {
    const storage = memoryStorage();
    recordPyqAttempt("user-1", right, storage);
    clearPyqAttempt("user-1", "q1", storage);
    expect(tallyChapterAttempts(load(storage, "user-1"), "math", "application-of-derivatives")).toEqual({
      attempted: 0,
      right: 0,
      wrong: 0,
    });
  });

  it("keeps accounts separate", () => {
    const storage = memoryStorage();
    recordPyqAttempt("user-1", right, storage);
    expect(load(storage, "user-2")).toEqual({});
  });

  it("folds guest answers into the signed-in tally once", () => {
    const storage = memoryStorage();
    recordPyqAttempt(null, right, storage);
    const first = loadPyqAttempts("user-1", storage);
    expect(tallyChapterAttempts(first, "math", "application-of-derivatives").attempted).toBe(1);
    expect(loadPyqAttempts("user-1", storage)).toEqual(first);
    expect(storage.getItem("edublast.chapterPyqAttempts.v1:local")).toBeNull();
  });
});

function load(storage: ReturnType<typeof memoryStorage>, userId: string): PyqAttemptMap {
  const raw = storage.getItem(`edublast.chapterPyqAttempts.v1:${userId}`);
  return parsePyqAttemptMap(raw);
}
