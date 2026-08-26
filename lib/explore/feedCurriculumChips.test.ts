import { describe, expect, it } from "vitest";
import {
  chapterRefDistinctFromTopic,
  feedCurriculumChipValues,
} from "./feedCurriculumChips";

describe("feedCurriculumChipValues", () => {
  it("hides chapter when it duplicates the topic title", () => {
    expect(
      feedCurriculumChipValues({
        chapterRef: "14.5 Simple Pendulum",
        topicRef: "14.5 Simple Pendulum",
        subtopicRef: "T = 2π√(L/g); derivation and conditions",
      })
    ).toEqual({
      chapter: null,
      topic: "14.5 Simple Pendulum",
      subtopic: "T = 2π√(L/g); derivation and conditions",
    });
  });

  it("keeps a distinct chapter next to topic and subtopic", () => {
    expect(
      feedCurriculumChipValues({
        chapterRef: "Oscillations",
        topicRef: "14.5 Simple Pendulum",
        subtopicRef: "Time period",
      })
    ).toEqual({
      chapter: "Oscillations",
      topic: "14.5 Simple Pendulum",
      subtopic: "Time period",
    });
  });

  it("shows chapter alone when topic is missing", () => {
    expect(
      feedCurriculumChipValues({
        chapterRef: "Oscillations",
        topicRef: null,
        subtopicRef: null,
      })
    ).toEqual({
      chapter: "Oscillations",
      topic: null,
      subtopic: null,
    });
  });
});

describe("chapterRefDistinctFromTopic", () => {
  it("returns null when chapter is the topic title", () => {
    expect(chapterRefDistinctFromTopic("14.5 Simple Pendulum", "14.5 Simple Pendulum")).toBeNull();
  });

  it("returns the chapter when it is a real parent", () => {
    expect(chapterRefDistinctFromTopic("Oscillations", "14.5 Simple Pendulum")).toBe("Oscillations");
  });
});
