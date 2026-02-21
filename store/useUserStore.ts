import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile, AnswerResult, ClassLevel, Stream, SubjectCombo, SavedRevisionCard } from '@/types';

interface UserState {
  user: UserProfile | null;
  currentRound: AnswerResult[];
  allResults: AnswerResult[];

  signup: (name: string, classLevel: ClassLevel, stream: Stream, subjectCombo: SubjectCombo) => void;
  logout: () => void;
  addRdm: (amount: number) => void;
  deductRdm: (amount: number) => void;
  recordAnswer: (result: AnswerResult) => void;
  saveQuestion: (questionId: string) => void;
  unsaveQuestion: (questionId: string) => void;
  saveRevisionCard: (card: SavedRevisionCard) => void;
  unsaveRevisionCard: (cardId: string) => void;
  updateRevisionCardStatus: (cardId: string, status: 'unsure' | 'tomorrow' | 'know_it' | 'new') => void;
  likeQuestion: (questionId: string) => void;
  unlikeQuestion: (questionId: string) => void;
  clearRound: () => void;
  setStreakMinutes: (minutes: number) => void;
  setOnBreak: (onBreak: boolean) => void;
  topUpRdm: (amount: number) => void;
  setRdmFromProfile: (rdm: number) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      currentRound: [],
      allResults: [],

      signup: (name, classLevel, stream, subjectCombo) =>
        set({
          user: {
            name,
            classLevel,
            stream,
            subjectCombo,
            rdm: 100,
            answeredQuestions: [],
            savedQuestions: [],
            savedRevisionCards: [],
            likedQuestions: [],
            streakMinutes: 0,
            isOnBreak: false,
            isSignedUp: true,
          },
        }),

      logout: () => set({ user: null, currentRound: [], allResults: [] }),

      addRdm: (amount) =>
        set((state) => ({
          user: state.user ? { ...state.user, rdm: state.user.rdm + amount } : null,
        })),

      deductRdm: (amount) =>
        set((state) => ({
          user: state.user
            ? { ...state.user, rdm: Math.max(0, state.user.rdm - amount) }
            : null,
        })),

      recordAnswer: (result) =>
        set((state) => ({
          currentRound: [...state.currentRound, result],
          allResults: [...state.allResults, result],
          user: state.user
            ? {
              ...state.user,
              answeredQuestions: [...state.user.answeredQuestions, result.questionId],
              rdm: result.isCorrect
                ? state.user.rdm + 10
                : Math.max(0, state.user.rdm - 5),
            }
            : null,
        })),

      saveQuestion: (questionId) =>
        set((state) => ({
          user: state.user
            ? {
              ...state.user,
              savedQuestions: [...state.user.savedQuestions, questionId],
              rdm: state.user.rdm + 2, // bonus for saving
            }
            : null,
        })),

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
          return {
            user: state.user
              ? {
                ...state.user,
                savedRevisionCards: [...list, card],
                rdm: state.user.rdm + 2,
              }
              : null,
          };
        }),

      unsaveRevisionCard: (cardId) =>
        set((state) => ({
          user: state.user
            ? {
              ...state.user,
              savedRevisionCards: (state.user.savedRevisionCards ?? []).filter((c) => c.id !== cardId),
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
    { name: 'edublast-user' }
  )
);
