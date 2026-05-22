import { describe, expect, it } from "vitest";
import { buddyCommunityPostHref } from "./buddyCommunityPostHref";
import { resolveBuddyRightNow } from "./resolveBuddyRightNow";

describe("resolveBuddyRightNow", () => {
  it("prefers recent Gyan++ doubt over stale subtopic presence", () => {
    const now = Date.now();
    const doubtAt = new Date(now - 2 * 60_000).toISOString();
    const subtopicAt = new Date(now - 25 * 60_000).toISOString();

    const out = resolveBuddyRightNow({
      presence: {
        board: "cbse",
        subject: "chemistry",
        classLevel: 12,
        topic: "Thermo",
        subtopicName: "Entropy",
        level: "advanced",
        panel: "theory",
        occurredAt: subtopicAt,
      },
      dwell: null,
      bitsAttemptsJson: null,
      activityRecentMs: 10 * 60_000,
      latestGyanDoubt: {
        id: "d1",
        title: "Evaluate $$x=1$$",
        subject: "Math",
        createdAt: doubtAt,
      },
      latestCommunityPost: null,
      gyanPresenceUpdatedAt: null,
    });

    expect(out.kind).toBe("gyan_active");
    if (out.kind === "gyan_active") {
      expect(out.href).toBe("/doubts/d1");
    }
  });

  it("shows recent community post with deep link to explore feed", () => {
    const now = Date.now();
    const postAt = new Date(now - 3 * 60_000).toISOString();

    const out = resolveBuddyRightNow({
      presence: null,
      dwell: null,
      bitsAttemptsJson: null,
      activityRecentMs: 10 * 60_000,
      latestGyanDoubt: null,
      latestCommunityPost: {
        id: "p1",
        title: "Check this derivation",
        subject: "Physics",
        createdAt: postAt,
      },
      gyanPresenceUpdatedAt: null,
    });

    expect(out.kind).toBe("community_posted");
    if (out.kind === "community_posted") {
      expect(out.href).toBe(buddyCommunityPostHref("p1"));
      expect(out.title).toBe("Check this derivation");
    }
  });

  it("prefers newer community post over older Gyan++ doubt within 15m", () => {
    const now = Date.now();
    const doubtAt = new Date(now - 10 * 60_000).toISOString();
    const postAt = new Date(now - 2 * 60_000).toISOString();

    const out = resolveBuddyRightNow({
      presence: null,
      dwell: null,
      bitsAttemptsJson: null,
      activityRecentMs: 10 * 60_000,
      latestGyanDoubt: {
        id: "d1",
        title: "Older doubt",
        subject: "Math",
        createdAt: doubtAt,
      },
      latestCommunityPost: {
        id: "p2",
        title: "Fresh community note",
        subject: "Chemistry",
        createdAt: postAt,
      },
      gyanPresenceUpdatedAt: null,
    });

    expect(out.kind).toBe("community_posted");
  });
});
