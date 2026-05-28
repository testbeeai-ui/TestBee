import { beforeEach, describe, expect, it } from "vitest";
import { useUserStore } from "@/store/useUserStore";

const resetStore = () => {
  useUserStore.setState({
    user: null,
    linkedAuthUserId: null,
    currentRound: [],
    allResults: [],
  });
};

describe("useUserStore auth binding", () => {
  beforeEach(() => {
    resetStore();
  });

  it("adopts legacy unlinked local state without wiping progress", () => {
    useUserStore.getState().signup("Legacy", 12, "science", "PCM");
    useUserStore.getState().recordAnswer({
      questionId: "q1",
      selectedAnswer: 2,
      isCorrect: true,
      timestamp: 1,
    });

    useUserStore
      .getState()
      .bindToAuthUser("auth-1", "Server Name", 11, "science", "PCM", 777);

    const state = useUserStore.getState();
    expect(state.linkedAuthUserId).toBe("auth-1");
    expect(state.user?.name).toBe("Server Name");
    expect(state.user?.classLevel).toBe(11);
    expect(state.user?.answeredQuestions).toEqual(["q1"]);
    expect(state.allResults).toHaveLength(1);
    expect(state.user?.rdm).toBe(777);
  });

  it("resets local progress on a real auth account switch", () => {
    useUserStore.getState().bindToAuthUser("auth-1", "A", 12, "science", "PCM", 200);
    useUserStore.getState().recordAnswer({
      questionId: "q1",
      selectedAnswer: 1,
      isCorrect: true,
      timestamp: 1,
    });

    useUserStore.getState().bindToAuthUser("auth-2", "B", 12, "science", "PCM", 50);

    const state = useUserStore.getState();
    expect(state.linkedAuthUserId).toBe("auth-2");
    expect(state.user?.name).toBe("B");
    expect(state.user?.answeredQuestions).toEqual([]);
    expect(state.allResults).toEqual([]);
    expect(state.user?.rdm).toBe(50);
  });

  it("uses the server RDM balance when creating a fresh local profile", () => {
    useUserStore.getState().bindToAuthUser("auth-1", "A", 12, "science", "PCM", 321);

    expect(useUserStore.getState().user?.rdm).toBe(321);
  });
});
