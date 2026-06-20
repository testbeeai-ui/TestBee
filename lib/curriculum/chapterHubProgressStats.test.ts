import { describe, expect, it } from "vitest";
import type { TopicNode } from "@/data/topicTaxonomy";
import { buildChapterHubActivityStats } from "@/lib/curriculum/chapterHubProgressStats";

const topics: TopicNode[] = [
  {
    subject: "physics",
    classLevel: 11,
    topic: "Motion",
    chapterTitle: "Kinematics",
    unitLabel: "Unit 1",
    subtopics: [{ name: "Speed" }, { name: "Velocity" }],
    examRelevance: ["JEE"],
  },
];

const board = "cbse";
const baseKey = "cbse||physics||11||Motion||Speed||advanced";

describe("buildChapterHubActivityStats", () => {
  it("counts advanced quiz sets from storage keys with ||set:N suffix", () => {
    const stats = buildChapterHubActivityStats({
      topics,
      boardNormalized: board,
      subject: "physics",
      classLevel: 11,
      bitsAttemptsJson: {
        [`${baseKey}||set:1`]: {
          subject: "physics",
          classLevel: 11,
          level: "advanced",
          topic: "Motion",
          subtopicName: "Speed",
          bitsSignature: "sig",
          submittedAt: "2026-06-18T10:00:00.000Z",
          totalQuestions: 10,
          correctCount: 8,
          wrongCount: 2,
        },
        [`${baseKey}||set:2`]: {
          subject: "physics",
          classLevel: 11,
          level: "advanced",
          topic: "Motion",
          subtopicName: "Speed",
          bitsSignature: "sig",
          submittedAt: "2026-06-18T11:00:00.000Z",
          totalQuestions: 10,
          correctCount: 5,
          wrongCount: 5,
        },
      },
      subtopicEngagementJson: {},
    });

    expect(stats.quizSetsTaken).toBe(2);
    expect(stats.quizSetsTotal).toBe(6);
  });

  it("sums InstaCue flipped cards for advanced subtopics in the chapter", () => {
    const stats = buildChapterHubActivityStats({
      topics,
      boardNormalized: board,
      subject: "physics",
      classLevel: 11,
      bitsAttemptsJson: {},
      subtopicEngagementJson: {
        [baseKey]: {
          v: 1,
          bitsSignature: "sig",
          updatedAt: "2026-06-18T10:00:00.000Z",
          instaCue: { navVisited: [0, 1], flipped: [0, 1, 2] },
        },
        "cbse||physics||11||Motion||Velocity||advanced": {
          v: 1,
          bitsSignature: "sig2",
          updatedAt: "2026-06-18T10:00:00.000Z",
          instaCue: { navVisited: [0], flipped: [0] },
        },
      },
    });

    expect(stats.instaCueCardsCreated).toBe(4);
  });

  it("ignores basics attempts and other chapters", () => {
    const stats = buildChapterHubActivityStats({
      topics,
      boardNormalized: board,
      subject: "physics",
      classLevel: 11,
      bitsAttemptsJson: {
        "cbse||physics||11||Motion||Speed||basics": {
          subject: "physics",
          classLevel: 11,
          level: "basics",
          topic: "Motion",
          subtopicName: "Speed",
          bitsSignature: "sig",
          submittedAt: "2026-06-18T10:00:00.000Z",
          totalQuestions: 5,
          correctCount: 5,
          wrongCount: 0,
        },
        "cbse||physics||11||OtherTopic||Speed||advanced": {
          subject: "physics",
          classLevel: 11,
          level: "advanced",
          topic: "OtherTopic",
          subtopicName: "Speed",
          bitsSignature: "sig",
          submittedAt: "2026-06-18T10:00:00.000Z",
          totalQuestions: 5,
          correctCount: 5,
          wrongCount: 0,
        },
      },
      subtopicEngagementJson: {},
    });

    expect(stats.quizSetsTaken).toBe(0);
  });
});
