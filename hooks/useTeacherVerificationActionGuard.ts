"use client";

import { useCallback, useMemo, useState } from "react";
import type { TeacherVerificationStatus } from "@/lib/teacherPortal/types";

type GuardOptions = {
  actionLabel?: string;
};

type UseTeacherVerificationActionGuardInput = {
  verificationStatus: TeacherVerificationStatus;
  isAdminImpersonation: boolean;
};

export function useTeacherVerificationActionGuard({
  verificationStatus,
  isAdminImpersonation,
}: UseTeacherVerificationActionGuardInput) {
  const [isGateOpen, setIsGateOpen] = useState(false);
  const [blockedActionLabel, setBlockedActionLabel] = useState<string | null>(null);

  const canProceed = isAdminImpersonation || verificationStatus === "approved";

  const guardAction = useCallback(
    async <T>(action: () => Promise<T>, options?: GuardOptions): Promise<T | null> => {
      if (!canProceed) {
        setBlockedActionLabel(options?.actionLabel ?? null);
        setIsGateOpen(true);
        return null;
      }
      return action();
    },
    [canProceed]
  );

  const closeGate = useCallback(() => {
    setIsGateOpen(false);
    setBlockedActionLabel(null);
  }, []);

  return useMemo(
    () => ({
      canProceed,
      isGateOpen,
      blockedActionLabel,
      guardAction,
      closeGate,
    }),
    [blockedActionLabel, canProceed, closeGate, guardAction, isGateOpen]
  );
}
