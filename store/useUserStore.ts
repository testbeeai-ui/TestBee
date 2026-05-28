import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  UserProfile,
  AnswerResult,
  ClassLevel,
  Stream,
  SubjectCombo,
  SavedRevisionCard,
  SavedRevisionUnit,
  SavedBit,
  SavedFormula,
  SavedCommunityPost,
  Board,
  ExamType,
} from "@/types";

function emptySavedUserProfile(
  name: string,
  classLevel: ClassLevel,
  stream: Stream,
  subjectCombo: SubjectCombo,
  rdm = 100
): UserProfile {
  return {
    name,
    classLevel,
    stream,
    subjectCombo,
    board: "CBSE",
    examType: null,
    rdm,
    answeredQuestions: [],
    savedQuestions: [],
    savedRevisionCards: [],
    savedRevisionUnits: [],
    savedBits: [],
    savedFormulas: [],
    savedCommunityPosts: [],
    likedQuestions: [],
    streakMinutes: 0,
    isOnBreak: false,
    isSignedUp: true,
  };
}

interface UserState {
  user: UserProfile | null;
  /** Supabase auth user id this local store belongs to — prevents cross-account bleed from persist. */
  linkedAuthUserId: string | null;
  currentRound: AnswerResult[];
  allResults: AnswerResult[];

  signup: (
    name: string,
    classLevel: ClassLevel,
    stream: Stream,
    subjectCombo: SubjectCombo
  ) => void;
  /** Initialize or reset local profile when the signed-in Supabase user changes. */
  bindToAuthUser: (
    authUserId: string,
    name: string,
    classLevel: ClassLevel,
    stream: Stream,
    subjectCombo: SubjectCombo,
    rdm?: number
  ) => void;
  setBoard: (board: Board) => void;
  setExamType: (examType: ExamType | null) => void;
  logout: () => void;
  addRdm: (amount: number) => void;
  deductRdm: (amount: number) => void;
  recordAnswer: (result: AnswerResult) => void;
  saveQuestion: (questionId: string) => void;
  unsaveQuestion: (questionId: string) => void;
  saveRevisionCard: (card: SavedRevisionCard) => void;
  unsaveRevisionCard: (cardId: string) => void;
  updateRevisionCardStatus: (
    cardId: string,
    status: "unsure" | "tomorrow" | "know_it" | "new"
  ) => void;
  saveRevisionUnit: (unit: SavedRevisionUnit) => void;
  unsaveRevisionUnit: (unitId: string) => void;
  saveBit: (bit: SavedBit) => void;
  unsaveBit: (bitId: string) => void;
  saveFormula: (formula: SavedFormula) => void;
  unsaveFormula: (formulaId: string) => void;
  saveCommunityPost: (post: SavedCommunityPost) => void;
  unsaveCommunityPost: (postId: string) => void;
  setSavedFromServer: (
    savedBits: SavedBit[],
    savedFormulas: SavedFormula[],
    savedRevisionCards: SavedRevisionCard[],
    savedRevisionUnits: SavedRevisionUnit[],
    savedCommunityPosts: SavedCommunityPost[]
  ) => void;
  likeQuestion: (questionId: string) => void;
  unlikeQuestion: (questionId: string) => void;
  clearRound: () => void;
  setStreakMinutes: (minutes: number) => void;
  setOnBreak: (onBreak: boolean) => void;
  topUpRdm: (amount: number) => void;
  setRdmFromProfile: (rdm: number) => void;
}

const EMPTY_SAVED_COMMUNITY_POSTS: SavedCommunityPost[] = [];

/** Stable selector — do not use `?? []` inline in useUserStore hooks (causes infinite re-renders). */
export const selectSavedCommunityPosts = (s: UserState): SavedCommunityPost[] =>
  s.user?.savedCommunityPosts ?? EMPTY_SAVED_COMMUNITY_POSTS;

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      linkedAuthUserId: null,
      currentRound: [],
      allResults: [],

      signup: (name, classLevel, stream, subjectCombo) =>
        set({
          user: emptySavedUserProfile(name, classLevel, stream, subjectCombo),
        }),

      bindToAuthUser: (authUserId, name, classLevel, stream, subjectCombo, rdm) => {
        const { linkedAuthUserId, user } = get();
        const knownRdm = typeof rdm === "number" ? rdm : undefined;
        if (linkedAuthUserId === authUserId && user) {
          set({
            user: {
              ...user,
              name,
              classLevel,
              stream,
              subjectCombo,
              ...(knownRdm !== undefined ? { rdm: knownRdm } : {}),
            },
          });
          return;
        }
        if (linkedAuthUserId === null && user) {
          set({
            linkedAuthUserId: authUserId,
            user: {
              ...user,
              name,
              classLevel,
              stream,
              subjectCombo,
              ...(knownRdm !== undefined ? { rdm: knownRdm } : {}),
            },
          });
          return;
        }
        set({
          linkedAuthUserId: authUserId,
          user: emptySavedUserProfile(name, classLevel, stream, subjectCombo, knownRdm),
          currentRound: [],
          allResults: [],
        });
      },

      setBoard: (board) =>
        set((state) => ({
          user: state.user ? { ...state.user, board } : null,
        })),

      setExamType: (examType) =>
        set((state) => ({
          user: state.user ? { ...state.user, examType } : null,
        })),

      logout: () =>
        set({ user: null, linkedAuthUserId: null, currentRound: [], allResults: [] }),

      addRdm: (amount) =>
        set((state) => ({
          user: state.user ? { ...state.user, rdm: state.user.rdm + amount } : null,
        })),

      deductRdm: (amount) =>
        set((state) => ({
          user: state.user ? { ...state.user, rdm: Math.max(0, state.user.rdm - amount) } : null,
        })),

      recordAnswer: (result) =>
        set((state) => ({
          currentRound: [...state.currentRound, result],
          allResults: [...state.allResults, result],
          user: state.user
            ? {
                ...state.user,
                answeredQuestions: [...state.user.answeredQuestions, result.questionId],
                rdm: result.isCorrect ? state.user.rdm + 10 : Math.max(0, state.user.rdm - 5),
              }
            : null,
        })),

      saveQuestion: (questionId) =>
        set((state) => {
          if (!state.user) return state;
          if (state.user.savedQuestions.includes(questionId)) return state;
          return {
            user: {
              ...state.user,
              savedQuestions: [...state.user.savedQuestions, questionId],
              rdm: state.user.rdm + 2, // bonus for saving
            },
          };
        }),

      unsaveQuestion: (questionId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                savedQuestions: state.user.savedQuestions.filter((id) => id !== questionId),
              }
            : null,
        })),

      saveRevisionCard: (card) =>
        set((state) => {
          const list = state.user?.savedRevisionCards ?? [];
          if (list.some((c) => c.id === card.id)) return state;
          const stamped: SavedRevisionCard = {
            ...card,
            savedAt: card.savedAt ?? new Date().toISOString(),
          };
          return {
            user: state.user
              ? {
                  ...state.user,
                  savedRevisionCards: [...list, stamped],
                }
              : null,
          };
        }),

      unsaveRevisionCard: (cardId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                savedRevisionCards: (state.user.savedRevisionCards ?? []).filter(
                  (c) => c.id !== cardId
                ),
              }
            : null,
        })),

      updateRevisionCardStatus: (cardId, status) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                savedRevisionCards: (state.user.savedRevisionCards ?? []).map((c) =>
                  c.id === cardId ? { ...c, status } : c
                ),
              }
            : null,
        })),

      saveRevisionUnit: (unit) =>
        set((state) => {
          const list = state.user?.savedRevisionUnits ?? [];
          if (list.some((u) => u.id === unit.id)) return state;
          const sameSection = list.some(
            (u) =>
              u.board === unit.board &&
              u.subject === unit.subject &&
              u.classLevel === unit.classLevel &&
              u.unitName === unit.unitName &&
              u.subtopicName === unit.subtopicName &&
              u.level === unit.level &&
              u.sectionIndex === unit.sectionIndex
          );
          if (sameSection) return state;
          return {
            user: state.user
              ? {
                  ...state.user,
                  savedRevisionUnits: [...list, unit],
                  rdm: state.user.rdm + 2,
                }
              : null,
          };
        }),

      unsaveRevisionUnit: (unitId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                savedRevisionUnits: (state.user.savedRevisionUnits ?? []).filter(
                  (u) => u.id !== unitId
                ),
              }
            : null,
        })),

      saveBit: (bit) =>
        set((state) => {
          const list = state.user?.savedBits ?? [];
          if (list.some((b) => b.id === bit.id)) return state;
          return {
            user: state.user ? { ...state.user, savedBits: [...list, bit] } : null,
          };
        }),

      unsaveBit: (bitId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                savedBits: (state.user.savedBits ?? []).filter((b) => b.id !== bitId),
              }
            : null,
        })),

      saveFormula: (formula) =>
        set((state) => {
          const list = state.user?.savedFormulas ?? [];
          if (list.some((f) => f.id === formula.id)) return state;
          return {
            user: state.user ? { ...state.user, savedFormulas: [...list, formula] } : null,
          };
        }),

      unsaveFormula: (formulaId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                savedFormulas: (state.user.savedFormulas ?? []).filter((f) => f.id !== formulaId),
              }
            : null,
        })),

      saveCommunityPost: (post) =>
        set((state) => {
          const list = state.user?.savedCommunityPosts ?? [];
          if (list.some((p) => p.postId === post.postId)) return state;
          return {
            user: state.user ? { ...state.user, savedCommunityPosts: [post, ...list] } : null,
          };
        }),

      unsaveCommunityPost: (postId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                savedCommunityPosts: (state.user.savedCommunityPosts ?? []).filter(
                  (p) => p.postId !== postId
                ),
              }
            : null,
        })),

      setSavedFromServer: (
        savedBits,
        savedFormulas,
        savedRevisionCards,
        savedRevisionUnits,
        savedCommunityPosts
      ) =>
        set((state) =>
          state.user
            ? {
                user: {
                  ...state.user,
                  savedBits,
                  savedFormulas,
                  savedRevisionCards,
                  savedRevisionUnits,
                  savedCommunityPosts,
                },
              }
            : state
        ),

      likeQuestion: (questionId) =>
        set((state) => ({
          user: state.user
            ? { ...state.user, likedQuestions: [...state.user.likedQuestions, questionId] }
            : null,
        })),

      unlikeQuestion: (questionId) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                likedQuestions: state.user.likedQuestions.filter((id) => id !== questionId),
              }
            : null,
        })),

      clearRound: () => set({ currentRound: [] }),

      setStreakMinutes: (minutes) =>
        set((state) => ({
          user: state.user ? { ...state.user, streakMinutes: minutes } : null,
        })),

      setOnBreak: (onBreak) =>
        set((state) => ({
          user: state.user ? { ...state.user, isOnBreak: onBreak } : null,
        })),

      topUpRdm: (amount) =>
        set((state) => ({
          user: state.user ? { ...state.user, rdm: state.user.rdm + amount } : null,
        })),

      setRdmFromProfile: (rdm) =>
        set((state) => ({
          user: state.user ? { ...state.user, rdm } : state.user,
        })),
    }),
    {
      name: "edublast-user",
      version: 2,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const state = persistedState as {
          user?: Record<string, unknown>;
          linkedAuthUserId?: string | null;
        } | null | undefined;
        if (fromVersion < 2) {
          return {
            ...state,
            linkedAuthUserId: null,
          };
        }
        const user = state?.user;
        if (user && typeof user === "object") {
          if (!Array.isArray(user.savedBits)) user.savedBits = [];
          if (!Array.isArray(user.savedFormulas)) user.savedFormulas = [];
          if (!Array.isArray(user.savedRevisionCards)) user.savedRevisionCards = [];
          if (!Array.isArray(user.savedRevisionUnits)) user.savedRevisionUnits = [];
          if (!Array.isArray(user.savedCommunityPosts)) user.savedCommunityPosts = [];
        }
        if (state && state.linkedAuthUserId === undefined) {
          state.linkedAuthUserId = null;
        }
        return persistedState;
      },
    }
  )
);
