import { useState, useEffect, useCallback, useRef } from 'react';
import { StreakPhase } from '@/types';
import { useUserStore } from '@/store/useUserStore';

const STREAK_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60;   // 5 minutes in seconds
const RECALL_DURATION = 2 * 60;  // 2 minutes in seconds

interface UseStreakTimerReturn {
  phase: StreakPhase;
  secondsLeft: number;
  totalSeconds: number;
  isActive: boolean;
  startStreak: () => void;
  stopStreak: () => void;
  skipToNext: () => void; // for dev/testing
}

export const useStreakTimer = (): UseStreakTimerReturn => {
  const [phase, setPhase] = useState<StreakPhase>('playing');
  const [secondsLeft, setSecondsLeft] = useState(STREAK_DURATION);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const addRdm = useUserStore((s) => s.addRdm);
  const setOnBreak = useUserStore((s) => s.setOnBreak);

  const getTotalForPhase = (p: StreakPhase) => {
    switch (p) {
      case 'playing': return STREAK_DURATION;
      case 'break': return BREAK_DURATION;
      case 'recall': return RECALL_DURATION;
    }
  };

  const transitionTo = useCallback((nextPhase: StreakPhase) => {
    setPhase(nextPhase);
    setSecondsLeft(getTotalForPhase(nextPhase));
    setOnBreak(nextPhase === 'break');

    if (nextPhase === 'break') {
      // Award 50 RDM bonus for completing 25-min streak
      addRdm(50);
      import('canvas-confetti').then((confetti) => {
        confetti.default({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      });
    }
  }, [addRdm, setOnBreak]);

  useEffect(() => {
    if (!isActive) return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Time's up for current phase
          if (phase === 'playing') {
            transitionTo('break');
          } else if (phase === 'break') {
            transitionTo('recall');
          } else {
            // recall done -> back to playing
            transitionTo('playing');
          }
          return 0; // will be reset by transitionTo
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, phase, transitionTo]);

  const startStreak = useCallback(() => {
    setPhase('playing');
    setSecondsLeft(STREAK_DURATION);
    setIsActive(true);
  }, []);

  const stopStreak = useCallback(() => {
    setIsActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('playing');
    setSecondsLeft(STREAK_DURATION);
    setOnBreak(false);
  }, [setOnBreak]);

  const skipToNext = useCallback(() => {
    if (phase === 'playing') transitionTo('break');
    else if (phase === 'break') transitionTo('recall');
    else transitionTo('playing');
  }, [phase, transitionTo]);

  return {
    phase,
    secondsLeft,
    totalSeconds: getTotalForPhase(phase),
    isActive,
    startStreak,
    stopStreak,
    skipToNext,
  };
};
