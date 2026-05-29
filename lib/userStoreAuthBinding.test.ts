import { beforeEach, describe, expect, it } from "vitest";
import { useUserStore } from "@/store/useUserStore";
import type { UserProfile } from "@/types";

function legacyUserProfile(): UserProfile {
  return {
    name: "Local Student",
    classLevel: 12,
    stream: "science",
    subjectCombo: "PCM",
    board: "CBSE",
    examType: null,
    rdm: 345,
    answeredQuestions: ["q1"],
    savedQuestions: ["q2"],
    savedRevisionCards: [{ id: "card-1", title: "Card", body: "Body" } as any],
    savedRevisionUnits: [{ id: "unit-1", title: "Unit" } as any],
    savedBits: [{ id: "bit-1", question: "Question" } as any],
    savedFormulas: [{ id: "formula-1", formula: "F=ma" } as any],
    savedCommunityPosts: [{ postId: "post-1", title: "Post" } as any],
    likedQuestions: ["q3"],
    streakMinutes: 42,
    isOnBreak: true,
    isSignedUp: true,
  };
}

describe("useUserStore bindToAuthUser", () => {
  beforeEach(() => {
    useUserStore.setState({
      user: null,
      linkedAuthUserId: null,
      currentRound: [],
      allResults: [],
    });
  });

  it("claims migrated local state for the first auth user without wiping local-only data", () => {
    useUserStore.setState({
      user: legacyUserProfile(),
      linkedAuthUserId: null,
      currentRound: [{ questionId: "round-q" } as any],
      allResults: [{ questionId: "all-q" } as any],
    });

    useUserStore.getState().bindToAuthUser("auth-1", "Server Student", 11, "science", "PCM");

    const state = useUserStore.getState();
    expect(state.linkedAuthUserId).toBe("auth-1");
    expect(state.user?.name).toBe("Server Student");
    expect(state.user?.classLevel).toBe(11);
    expect(state.user?.rdm).toBe(345);
    expect(state.user?.savedBits).toHaveLength(1);
    expect(state.user?.savedFormulas).toHaveLength(1);
    expect(state.user?.savedRevisionCards).toHaveLength(1);
    expect(state.user?.savedRevisionUnits).toHaveLength(1);
    expect(state.user?.savedCommunityPosts).toHaveLength(1);
    expect(state.currentRound).toHaveLength(1);
    expect(state.allResults).toHaveLength(1);
  });

  it("resets local study state when a different bound auth user signs in", () => {
    useUserStore.setState({
      user: legacyUserProfile(),
      linkedAuthUserId: "auth-1",
      currentRound: [{ questionId: "round-q" } as any],
      allResults: [{ questionId: "all-q" } as any],
    });

    useUserStore.getState().bindToAuthUser("auth-2", "Other Student", 12, "science", "PCM");

    const state = useUserStore.getState();
    expect(state.linkedAuthUserId).toBe("auth-2");
    expect(state.user?.name).toBe("Other Student");
    expect(state.user?.rdm).toBe(100);
    expect(state.user?.savedBits).toEqual([]);
    expect(state.currentRound).toEqual([]);
    expect(state.allResults).toEqual([]);
  });
});
