import { beforeEach, describe, expect, it } from "vitest";
import { useUserStore } from "@/store/useUserStore";
import type { AnswerResult, UserProfile } from "@/types";

const localAnswer: AnswerResult = {
  questionId: "q-local",
  selectedAnswer: 1,
  isCorrect: true,
  timestamp: 1,
};

function userProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: "Local User",
    classLevel: 11,
    stream: "science",
    subjectCombo: "PCM",
    board: "CBSE",
    examType: null,
    rdm: 321,
    answeredQuestions: ["q-local"],
    savedQuestions: ["q-saved"],
    savedRevisionCards: [],
    savedRevisionUnits: [],
    savedBits: [{ id: "bit-local" } as UserProfile["savedBits"][number]],
    savedFormulas: [],
    savedCommunityPosts: [],
    likedQuestions: [],
    streakMinutes: 42,
    isOnBreak: false,
    isSignedUp: true,
    ...overrides,
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

  it("adopts a migrated unlinked profile without clearing local saved state", () => {
    useUserStore.setState({
      user: userProfile(),
      linkedAuthUserId: null,
      currentRound: [localAnswer],
      allResults: [localAnswer],
    });

    useUserStore.getState().bindToAuthUser("auth-user-1", "Server User", 12, "science", "PCM");

    const state = useUserStore.getState();
    expect(state.linkedAuthUserId).toBe("auth-user-1");
    expect(state.user?.name).toBe("Server User");
    expect(state.user?.classLevel).toBe(12);
    expect(state.user?.savedBits).toHaveLength(1);
    expect(state.user?.answeredQuestions).toEqual(["q-local"]);
    expect(state.currentRound).toHaveLength(1);
    expect(state.allResults).toHaveLength(1);
  });

  it("clears local state when a store already belongs to a different auth user", () => {
    useUserStore.setState({
      user: userProfile(),
      linkedAuthUserId: "auth-user-1",
      currentRound: [localAnswer],
      allResults: [localAnswer],
    });

    useUserStore.getState().bindToAuthUser("auth-user-2", "Other User", 12, "science", "PCM");

    const state = useUserStore.getState();
    expect(state.linkedAuthUserId).toBe("auth-user-2");
    expect(state.user?.name).toBe("Other User");
    expect(state.user?.savedBits).toEqual([]);
    expect(state.user?.answeredQuestions).toEqual([]);
    expect(state.currentRound).toEqual([]);
    expect(state.allResults).toEqual([]);
  });
});
