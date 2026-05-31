import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";

export type OnboardingRewardState = {
  progress: Record<string, boolean>;
  claimedAt: string | null;
  checklistRewardRdm: number;
  freeTrialWelcomeRdm?: number;
  freeTrialActivated?: boolean;
  dailyStreak?: Record<string, unknown>;
};

export type ClaimOnboardingRewardResult = {
  ok: boolean;
  alreadyClaimed?: boolean;
  amount: number;
  balance: number;
  error?: string;
};

export type OnboardingProgressSyncResult = {
  ok: boolean;
  error?: string;
  noop?: boolean;
};

const ONBOARDING_REWARD_CACHE_TTL_MS = 3_000;

let onboardingRewardCached: { at: number; data: OnboardingRewardState } | null = null;
let onboardingRewardInFlight: Promise<OnboardingRewardState> | null = null;

export function invalidateOnboardingRewardStateCache(): void {
  onboardingRewardCached = null;
  onboardingRewardInFlight = null;
}

export async function fetchOnboardingRewardState(opts?: {
  fresh?: boolean;
}): Promise<OnboardingRewardState> {
  const now = Date.now();
  if (
    !opts?.fresh &&
    onboardingRewardCached &&
    now - onboardingRewardCached.at < ONBOARDING_REWARD_CACHE_TTL_MS
  ) {
    return onboardingRewardCached.data;
  }

  if (!opts?.fresh && onboardingRewardInFlight) {
    return onboardingRewardInFlight;
  }

  onboardingRewardInFlight = (async () => {
    const authHeaders = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/onboarding-reward", {
      headers: { ...authHeaders },
      cache: "no-store",
    });
    const fallback: OnboardingRewardState = {
      progress: {},
      claimedAt: null,
      checklistRewardRdm: DEFAULT_RDM_CONFIG.free_trial_checklist_reward_rdm,
      freeTrialWelcomeRdm: DEFAULT_RDM_CONFIG.free_trial_welcome_rdm,
    };
    const data = res.ok ? ((await res.json()) as OnboardingRewardState) : fallback;
    onboardingRewardCached = { at: Date.now(), data };
    return data;
  })();

  try {
    return await onboardingRewardInFlight;
  } finally {
    onboardingRewardInFlight = null;
  }
}

export async function bulkMergeOnboardingProgressToServer(
  mergeProgress: Record<string, boolean>
): Promise<OnboardingProgressSyncResult & { progress?: Record<string, boolean> }> {
  const keys = Object.entries(mergeProgress).filter(([, done]) => done);
  if (keys.length === 0) {
    return { ok: true, noop: true };
  }

  try {
    const authHeaders = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/onboarding-reward", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        mergeProgress: Object.fromEntries(keys),
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      noop?: boolean;
      progress?: Record<string, boolean>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: body.error ?? `http_${res.status}`,
      };
    }

    invalidateOnboardingRewardStateCache();
    return { ok: true, noop: body.noop, progress: body.progress };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function syncOnboardingTaskToServer(
  taskId: string,
  completed = true
): Promise<OnboardingProgressSyncResult> {
  try {
    const authHeaders = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/onboarding-reward", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ taskId, completed }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      noop?: boolean;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: body.error ?? `http_${res.status}`,
      };
    }

    invalidateOnboardingRewardStateCache();
    return { ok: true, noop: body.noop };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function resetOnboardingRewardOnServer(): Promise<OnboardingProgressSyncResult> {
  try {
    const authHeaders = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/onboarding-reward", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ reset: true }),
    });

    const body = (await res.json().catch(() => ({}))) as { error?: string };

    if (!res.ok) {
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }

    invalidateOnboardingRewardStateCache();
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function claimOnboardingReward(): Promise<ClaimOnboardingRewardResult> {
  const authHeaders = await getClientApiAuthHeaders();
  const res = await fetch("/api/user/onboarding-reward/claim", {
    method: "POST",
    headers: { ...authHeaders },
  });
  const body = (await res.json()) as ClaimOnboardingRewardResult;
  if (!res.ok) {
    return {
      ok: false,
      amount: 0,
      balance: 0,
      error: body.error ?? "claim_failed",
    };
  }
  invalidateOnboardingRewardStateCache();
  return body;
}

export type ClaimDailyStreakRewardResult = {
  ok: boolean;
  alreadyClaimed?: boolean;
  amount: number;
  balance: number;
  trialDay?: number;
  error?: string;
  expectedDay?: number;
};

export async function claimDailyStreakReward(
  trialDayNumber: number,
  taskIds: string[]
): Promise<ClaimDailyStreakRewardResult> {
  const authHeaders = await getClientApiAuthHeaders();
  const res = await fetch("/api/user/onboarding-reward/daily-streak-claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ trialDayNumber, taskIds }),
  });
  const body = (await res.json()) as ClaimDailyStreakRewardResult;
  if (!res.ok) {
    return {
      ok: false,
      amount: 0,
      balance: 0,
      error: body.error ?? "claim_failed",
      expectedDay: body.expectedDay,
    };
  }
  invalidateOnboardingRewardStateCache();
  return body;
}

export type SyncDailyStreakTaskResult = {
  ok: boolean;
  noop?: boolean;
  alreadyClaimed?: boolean;
  taskIds?: string[];
  error?: string;
  expectedDay?: number;
};

export async function syncDailyStreakTaskToServer(
  trialDayNumber: number,
  taskId: string
): Promise<SyncDailyStreakTaskResult> {
  try {
    const authHeaders = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/onboarding-reward/daily-streak-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ trialDayNumber, taskId }),
    });
    const body = (await res.json().catch(() => ({}))) as SyncDailyStreakTaskResult & {
      error?: string;
      expectedDay?: number;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: body.error ?? `http_${res.status}`,
        expectedDay: body.expectedDay,
      };
    }
    invalidateOnboardingRewardStateCache();
    return body;
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function resetDailyStreakDayOnServer(
  trialDayNumber: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const authHeaders = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/onboarding-reward/daily-streak-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ trialDayNumber, reset: true }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    invalidateOnboardingRewardStateCache();
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
