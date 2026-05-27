import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUDDY_PRIVACY,
  maskBuddyProfileForPrivacy,
  maskDashboardForPrivacy,
  parseBuddyPrivacySettings,
  type BuddyAdvancedDashboardPayload,
} from "./buddyPrivacy";

function minimalPayload(
  visibility: Partial<typeof DEFAULT_BUDDY_PRIVACY> = {}
): BuddyAdvancedDashboardPayload {
  const v = { ...DEFAULT_BUDDY_PRIVACY, ...visibility };
  return {
    buddy: { id: "b1", name: "Test", avatarUrl: null, classLevel: 11, rdm: 500 },
    buddyOnline: true,
    rightNow: { kind: "studying", lastActiveAt: new Date().toISOString() },
    gyanRecent: [{ id: "g1", kind: "doubt", title: "Q", createdAt: "", href: "/doubts/g1" }],
    subtopic: {
      current: null,
      lastOn: {
        board: "cbse",
        subject: "chemistry",
        classLevel: 12,
        topic: "T",
        subtopic: "S",
        level: "basics",
        panel: "theory",
        updatedAt: "",
        href: "/lessons",
        isRecent: true,
      },
      completedRecent: [{ board: null, subject: "math", classLevel: 11, topic: "T", subtopic: "S", level: "basics", completedAt: "", href: "/lessons" }],
    },
    playArena: {
      rdmEarnedToday: 10,
      rdmEarnedLast7Days: 50,
      gauntletStreakDays: 3,
      gauntletDaysLast30: 5,
      challengesAttemptedToday: 0,
      challengesClaimedLast7Days: 0,
      recent: [],
      playRdmMissedToday: 0,
      blitzRoundsToday: 1,
    },
    mcqRecent: [
      {
        id: "m1",
        source: "mock",
        paperName: "Mock",
        scorePercent: 80,
        correct: 8,
        total: 10,
        takenAt: "",
        href: "/mock-test",
      },
    ],
    generatedAt: "",
    visibility: v,
    privacyNotice: "",
    advanced: {
      streak: { dayStreak: 5, activeDays60d: 10, avgDailyMs: 1000, last10Days: [] },
      mocks: { recent: [], mocksThisMonth: 2, avgAccuracy: 70 },
      edufund: {
        rdm: 500,
        nextTierName: "Sprout",
        nextTierNeed: 1000,
        nextTierProgressPct: 50,
        activeDays60d: 10,
        activeDaysGoal: 60,
        earnedTodayRdm: 5,
      },
      subjectAccuracy: {
        subjects: [{ subject: "chemistry", name: "Chemistry", pct: 40, hasData: true }],
      },
    },
  };
}

describe("parseBuddyPrivacySettings", () => {
  it("defaults when null", () => {
    expect(parseBuddyPrivacySettings(null)).toEqual(DEFAULT_BUDDY_PRIVACY);
  });

  it("merges saved toggles and ignores unknown keys", () => {
    const parsed = parseBuddyPrivacySettings({
      share_mocks: false,
      share_instacue: true,
      share_classes: true,
      extra: true,
    });
    expect(parsed.share_mocks).toBe(false);
    expect(parsed.share_streak).toBe(true);
    expect("share_instacue" in parsed).toBe(false);
    expect("share_classes" in parsed).toBe(false);
  });
});

describe("maskDashboardForPrivacy", () => {
  it("masks mock and streak when toggles off", () => {
    const masked = maskDashboardForPrivacy(
      minimalPayload({ share_mocks: false, share_streak: false })
    );
    expect(masked.mcqRecent).toEqual([]);
    expect(masked.advanced.mocks).toBeNull();
    expect(masked.advanced.subjectAccuracy).toBeNull();
    expect(masked.advanced.streak).toBeNull();
    expect(masked.buddyOnline).toBe(false);
    expect(masked.rightNow.kind).toBe("studying");
  });

  it("masks gyan, subtopics, play, rdm, edufund", () => {
    const masked = maskDashboardForPrivacy(
      minimalPayload({
        share_gyan: false,
        share_subtopics: false,
        share_play: false,
        share_rdm: false,
        share_edufund: false,
      })
    );
    expect(masked.gyanRecent).toEqual([]);
    expect(masked.subtopic.lastOn).toBeNull();
    expect(masked.playArena.recent).toEqual([]);
    expect(masked.buddy.rdm).toBe(0);
    expect(masked.rightNow.kind).toBe("online");
    expect("subject" in masked.rightNow).toBe(false);
    expect(masked.advanced.edufund).toBeNull();
  });

  it("removes right-now study scope when subtopics are private", () => {
    const masked = maskDashboardForPrivacy(
      minimalPayload({
        share_subtopics: false,
      })
    );
    expect(masked.rightNow.kind).toBe("online");
    expect("topic" in masked.rightNow).toBe(false);
    expect("subtopic" in masked.rightNow).toBe(false);
    expect(masked.subtopic.current).toBeNull();
    expect(masked.subtopic.completedRecent).toEqual([]);
  });

  it("masks private buddy RDM in state-sized profiles", () => {
    const buddy = { id: "b1", rdm: 750, name: "Test" };
    expect(
      maskBuddyProfileForPrivacy(buddy, {
        ...DEFAULT_BUDDY_PRIVACY,
        share_rdm: false,
      })
    ).toEqual({ id: "b1", rdm: 0, name: "Test" });
  });

  it("leaves data visible when all shares on", () => {
    const raw = minimalPayload();
    const masked = maskDashboardForPrivacy(raw);
    expect(masked.mcqRecent).toHaveLength(1);
    expect(masked.advanced.streak?.dayStreak).toBe(5);
    expect(masked.buddyOnline).toBe(true);
  });
});
