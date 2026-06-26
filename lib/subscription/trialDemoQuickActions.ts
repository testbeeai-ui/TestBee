import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { dispatchTimeTravelOffsetChanged } from "@/lib/dev/timeTravel";
import {
  clearDailyStreakChecklistSuppress,
  clearDailyStreakTomorrowModalSchedule,
  DAILY_TASK_IDS,
} from "@/lib/onboarding/dailyStreakClient";
import {
  MAX_STREAK_DAY,
  MIN_STREAK_DAY,
  parseDailyStreakServerState,
} from "@/lib/onboarding/dailyStreakProgress";
import {
  claimDailyStreakReward,
  completeSiteTourRewardOnServer,
  fetchOnboardingRewardState,
  invalidateOnboardingRewardStateCache,
  syncDailyStreakTaskToServer,
} from "@/lib/subscription/onboardingRewardApi";
import {
  FREE_TRIAL_ACTIVATED_EVENT,
  FREE_TRIAL_DEMO_RESET_EVENT,
  ONBOARDING_PROGRESS_EVENT,
  cacheFreeTrialActivatedAt,
  resetOnboardingRewardChecklist,
  clearDailyChecklistAutoOpenArm,
} from "@/lib/subscription/freeTrialClient";

/** Remove every per-day daily-streak localStorage marker for this user (claim flags, modal-shown, etc.). */
function clearAllDailyStreakLocalState(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  clearDailyStreakChecklistSuppress(userId);
  clearDailyStreakTomorrowModalSchedule(userId);
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      // Day 2–10 markers are all `edublast_day_<n>_..._<userId>` / contain the userId suffix.
      if (key.startsWith("edublast_day_") && key.endsWith(userId)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage iteration errors
  }
}

/**
 * Re-arm the free trial to a clean Day 1 (site tour) and reset local UI state.
 * Server keeps `trial_onboarding_answers`, so no wizard is required.
 */
export async function resetTrialToDayOne(userId: string | undefined): Promise<void> {
  const authHeaders = await getClientApiAuthHeaders();
  const res = await fetch("/api/user/subscription/reset-trial", {
    method: "POST",
    headers: { ...authHeaders },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Failed to reset trial");
  }

  const payload = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    free_trial_activated_at?: string;
    trial_end_bonus_activated?: boolean;
    time_travel_offset_ms?: number;
  };
  if (!payload.ok) {
    throw new Error("Reset trial response was not ok");
  }
  if (payload.trial_end_bonus_activated === true) {
    throw new Error("Reset did not clear trial_end_bonus_activated");
  }
  if (typeof payload.free_trial_activated_at === "string") {
    cacheFreeTrialActivatedAt(payload.free_trial_activated_at);
  }

  invalidateOnboardingRewardStateCache();

  if (typeof window === "undefined") return;

  if (userId) {
    clearAllDailyStreakLocalState(userId);
    window.localStorage.removeItem("edublast.onboarding_reward_dismissed_v1");
    window.localStorage.setItem("edublast.free_trial_activated_v1", "1");
  }
  resetOnboardingRewardChecklist();
  clearDailyChecklistAutoOpenArm();

  // Back to real time (Day 1), clear bonus gate locally, re-arm the site tour.
  dispatchTimeTravelOffsetChanged(0, { clearStreakSuppress: true });
  window.dispatchEvent(new CustomEvent(FREE_TRIAL_DEMO_RESET_EVENT));
  window.dispatchEvent(new CustomEvent(FREE_TRIAL_ACTIVATED_EVENT));
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_PROGRESS_EVENT, {
      detail: { taskId: "reset", showChecklistToast: false },
    })
  );
}

function nextUnclaimedStreakDay(dailyStreak: Record<string, unknown>): number | null {
  const state = parseDailyStreakServerState(dailyStreak);
  for (let d = MIN_STREAK_DAY; d <= MAX_STREAK_DAY; d++) {
    const day = state[String(d)];
    const claimedAt =
      day && typeof day === "object" ? (day as { claimed_at?: string }).claimed_at : undefined;
    if (!claimedAt) return d;
  }
  return null;
}

export type CompleteActiveTrialDayResult =
  | { kind: "site_tour"; amount: number }
  | { kind: "daily"; day: number; amount: number }
  | { kind: "all_done" };

/**
 * Complete (and claim) the current active trial step in one click:
 * - Day 1 → mark all site-tour tasks + claim the welcome checklist reward.
 * - Day 2–10 → complete all 6 daily tasks for the next unclaimed day + claim it.
 *
 * Ignores time-travel: the server sequences days purely by which days are already claimed,
 * so this always advances to the correct next day.
 */
export async function completeActiveTrialDay(): Promise<CompleteActiveTrialDayResult> {
  const state = await fetchOnboardingRewardState({ fresh: true });

  // Day 1 — site tour not yet claimed.
  if (!state.claimedAt) {
    const claim = await completeSiteTourRewardOnServer();
    if (!claim.ok && !claim.alreadyClaimed) {
      throw new Error(claim.error ?? "Failed to claim site-tour reward");
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(ONBOARDING_PROGRESS_EVENT, {
          detail: { taskId: "reset", showChecklistToast: false },
        })
      );
    }
    return { kind: "site_tour", amount: claim.amount ?? 0 };
  }

  // Day 2–10 — complete the next unclaimed day.
  const day = nextUnclaimedStreakDay(state.dailyStreak ?? {});
  if (day == null) {
    return { kind: "all_done" };
  }

  for (const taskId of DAILY_TASK_IDS) {
    const sync = await syncDailyStreakTaskToServer(day, taskId);
    if (!sync.ok && sync.error !== "already_claimed") {
      throw new Error(
        sync.expectedDay && sync.expectedDay !== day
          ? `Finish Day ${sync.expectedDay} first`
          : (sync.error ?? `Failed to complete Day ${day}`)
      );
    }
  }

  const claim = await claimDailyStreakReward(day, [...DAILY_TASK_IDS]);
  if (!claim.ok && !claim.alreadyClaimed) {
    throw new Error(claim.error ?? `Failed to claim Day ${day}`);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ONBOARDING_PROGRESS_EVENT, {
        detail: { taskId: "reset", showChecklistToast: false },
      })
    );
  }
  return { kind: "daily", day, amount: claim.amount ?? 0 };
}
