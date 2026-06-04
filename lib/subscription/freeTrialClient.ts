import { isDailyChecklistCompanionRetryActive } from "@/lib/onboarding/dailyChecklistCompanionRetry";
import {
  dismissOnboardingTaskCompanion,
  isOnboardingTaskCompanionLaunched,
} from "@/lib/onboarding/onboardingTaskCompanion";
import { isDailyStreakChecklistSuppressed } from "@/lib/onboarding/dailyStreakClient";
import { isMainOnboardingTaskId } from "@/lib/onboarding/onboardingNextTask";
import { requestOnboardingSiteTourAfterTask } from "@/lib/onboarding/onboardingSiteTourPromo";
import { markPrepClassesStep0FromClassroomsPage } from "@/lib/onboarding/prepClassesCompanionOnboarding";
import { resetAllOnboardingGuideSessions } from "@/lib/onboarding/resetOnboardingGuideSessions";
import type { TrialOnboardingAnswers } from "@/components/dashboard/free-trial-onboarding/types";
import { INITIAL_TRIAL_ONBOARDING_ANSWERS } from "@/components/dashboard/free-trial-onboarding/types";
import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import {
  bulkMergeOnboardingProgressToServer,
  fetchOnboardingRewardState,
  resetOnboardingRewardOnServer,
  syncOnboardingTaskToServer,
} from "@/lib/subscription/onboardingRewardApi";
import {
  clearPendingOnboardingProgressSyncs,
  enqueueOnboardingProgressSync,
  ensureOnboardingProgressSyncRetryListeners,
  flushPendingOnboardingProgressSyncs,
  hasPendingOnboardingProgressSyncs,
} from "@/lib/onboarding/onboardingProgressSyncQueue";
import {
  GYAN_PLUS_SUBSTEP_IDS,
  isGyanPlusOnboardingComplete,
} from "@/lib/onboarding/gyanPlusOnboarding";
import { ONBOARDING_REWARD_TASK_IDS } from "@/lib/subscription/onboardingRewardConstants";
import { resetStudyDaysReconcileSession } from "@/lib/dashboard/studyDaysClient";
import { isFreeTrialPeriodEnded } from "@/lib/subscription/freeTrialTimer";

export { ONBOARDING_REWARD_TASK_IDS };

const ACTIVATED_KEY = "edublast.free_trial_activated_v1";
const ACTIVATED_AT_KEY = "edublast.free_trial_activated_at_v1";
const ONBOARDING_DISMISSED_KEY = "edublast.onboarding_reward_dismissed_v1";
const ONBOARDING_PROGRESS_KEY = "edublast.onboarding_reward_progress_v1";
const ONBOARDING_COOLDOWN_KEY = "edublast.onboarding_reward_cooldown_until_v1";
/** Last auth user id that owned global onboarding/trial keys in this browser. */
const ONBOARDING_LOCAL_OWNER_KEY = "edublast.onboarding_local_owner_user_id_v1";
/** Lessons checklist copy + semantics: step index 1 = save chapters, 2 = subtopic (swap was 2026-05). */
const LESSONS_SEMANTIC_SWAP_V2_KEY = "edublast.lessons_step12_semantic_swap_v2_done";

export function migrateLessonsStep12SemanticSwapV2IfNeeded(): void {
  if (!canUseStorage()) return;
  if (window.localStorage.getItem(LESSONS_SEMANTIC_SWAP_V2_KEY) === "1") return;

  const progress = getOnboardingProgress();
  const k1 = "lessons_step_1";
  const k2 = "lessons_step_2";
  const had1 = Boolean(progress[k1]);
  const had2 = Boolean(progress[k2]);
  if (!had1 && !had2) {
    window.localStorage.setItem(LESSONS_SEMANTIC_SWAP_V2_KEY, "1");
    return;
  }

  const next: Record<string, boolean> = { ...progress };
  if (had2) next[k1] = true;
  else delete next[k1];
  if (had1) next[k2] = true;
  else delete next[k2];

  window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(next));
  window.localStorage.setItem(LESSONS_SEMANTIC_SWAP_V2_KEY, "1");

  void (async () => {
    await syncOnboardingTaskToServer(k1, Boolean(next[k1]));
    await syncOnboardingTaskToServer(k2, Boolean(next[k2]));
  })();

  window.dispatchEvent(
    new CustomEvent(ONBOARDING_PROGRESS_EVENT, {
      detail: {
        taskId: "hydrate",
        showChecklistToast: false,
      } satisfies OnboardingProgressEventDetail,
    })
  );
}

export function isOnboardingRewardDismissedCooldownActive(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(ONBOARDING_COOLDOWN_KEY);
  if (!raw) return false;
  const until = parseInt(raw, 10);
  if (Number.isNaN(until)) return false;
  return Date.now() < until;
}

export function setOnboardingRewardDismissedCooldown(): void {
  if (typeof window === "undefined") return;
  const until = Date.now() + 60 * 60 * 1000; // 1 hour from now
  window.localStorage.setItem(ONBOARDING_COOLDOWN_KEY, until.toString());
}
/** When set, app actions must not auto-tick checklist steps (admin manual mode). */
const ADMIN_MANUAL_CHECKLIST_KEY = "edublast.admin_onboarding_manual_v1";
/** After onboarding RDM claim: auto-open Today's checklist on /home once cooldown elapses. */
const DAILY_CHECKLIST_AUTO_OPEN_KEY = "edublast.daily_checklist_auto_open_v1";
const DAILY_CHECKLIST_AVAILABLE_AFTER_KEY = "edublast.daily_checklist_available_after_ms_v1";
import {
  clearOnboardingSiteTourClaimedLocally,
  isOnboardingSiteTourClaimedLocally as isSiteTourClaimedLocally,
  setOnboardingSiteTourClaimedLocally as persistSiteTourClaimedLocally,
} from "@/lib/subscription/onboardingSiteTourClaimedLocal";

/** Minimum wait after claiming onboarding RDM before Today's checklist may auto-open. */
export const DAILY_CHECKLIST_POST_CLAIM_DELAY_MS = 30_000;

export const FREE_TRIAL_ACTIVATED_EVENT = "edublast-free-trial-activated";
export const FREE_TRIAL_REVOKED_EVENT = "edublast-free-trial-revoked";
export const ONBOARDING_PROGRESS_EVENT = "edublast-onboarding-progress";
export const ONBOARDING_REWARD_CLAIMED_EVENT = "edublast-onboarding-reward-claimed";
export const ONBOARDING_SYNC_FAILED_EVENT = "edublast-onboarding-sync-failed";
/** Fired when a main checklist row is newly completed (opens post-task site tour). */
export const ONBOARDING_POST_TASK_SITE_TOUR_EVENT = "edublast-onboarding-post-task-site-tour";
/** Fired when all 10 tasks are done — opens the Claim RDM dialog (any route). */
export const ONBOARDING_CLAIM_REWARD_PROMO_EVENT = "edublast-onboarding-claim-reward-promo";

export type OnboardingPostTaskSiteTourDetail = {
  taskId: string;
  /** Set when the floating companion celebration finished — bypasses one-shot session dedup. */
  afterCompanionCelebration?: boolean;
};

export type OnboardingClaimRewardPromoDetail = {
  /** Bypass one-shot session dedup (e.g. after companion celebration). */
  afterCompanionCelebration?: boolean;
  /** User explicitly asked (e.g. Claim now banner on /home). */
  force?: boolean;
};

/** Open the global Claim RDM dialog (mounted in AppLayout via OnboardingNextTaskPrompt). */
export function requestOnboardingClaimRewardPromo(opts?: OnboardingClaimRewardPromoDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OnboardingClaimRewardPromoDetail>(ONBOARDING_CLAIM_REWARD_PROMO_EVENT, {
      detail: opts ?? {},
    })
  );
}

export type OnboardingSyncFailedDetail = {
  taskId: string;
  error?: string;
};

export type OnboardingProfileFields = {
  plan_tier?: string | null;
  free_trial_activated?: boolean | null;
  free_trial_activated_at?: string | null;
  onboarding_reward_progress?: unknown;
  onboarding_reward_claimed_at?: string | null;
  time_travel_offset_ms?: number | null;
};

export function cacheFreeTrialActivatedAt(iso: string): void {
  if (!canUseStorage()) return;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return;
  window.localStorage.setItem(ACTIVATED_AT_KEY, iso);
}

export function getCachedFreeTrialActivatedAt(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(ACTIVATED_AT_KEY);
}

/** Server timestamp wins; local cache survives refresh before profile reload. */
export function resolveFreeTrialActivatedAt(
  profile?: Pick<OnboardingProfileFields, "free_trial_activated_at"> | null
): string | null {
  if (profile) {
    return profile.free_trial_activated_at ?? null;
  }
  return getCachedFreeTrialActivatedAt();
}

/** Which dashboard modal should auto-open (never more than one at once). */
export type DashboardPopupPhase = "free_trial" | "onboarding" | "claim_reward" | "none";

export type OnboardingProgressEventDetail = {
  taskId: string;
  toastActionLine?: string;
  showChecklistToast?: boolean;
};

export const ONBOARDING_TASK_TOAST_LINES: Record<string, string> = {
  magic_wall: "You browsed the Magic Wall!",
  lessons: "You completed a Lessons subtopic!",
  prep_classes: "You explored Prep & Mock Classes!",
  prep_mcq: "You started a CBSE MCQ chapter quiz!",
  gyan_plus: "You explored Gyan++ — browse, post, and engage!",
  earn_buddy: "You invited a learning buddy!",
  earn_challenge: "You started a challenge!",
  news_blog: "You read a news article or blog post!",
  edufund: "You clicked Create Proposal on EduFund!",
  profile: "You completed your basic profile info!",
  play_dailydose: "You finished today's DailyDose!",
};

let cachedChecklistRewardRdm = DEFAULT_RDM_CONFIG.free_trial_checklist_reward_rdm;

export function hydrateFreeTrialRdmAmounts(amounts: { checklistRewardRdm: number }): void {
  cachedChecklistRewardRdm = Math.max(0, Math.round(amounts.checklistRewardRdm));
}

export function getChecklistRewardRdm(): number {
  return cachedChecklistRewardRdm;
}

/** Accept strict booleans and a few legacy/coerced shapes from JSON / DB. */
function isProgressFlagDone(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function normalizeProgressRecord(raw: Record<string, unknown>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (isProgressFlagDone(val)) out[key] = true;
  }
  return out;
}

function parseProgressFromProfile(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return normalizeProgressRecord(raw as Record<string, unknown>);
}

/** Union of true flags — used so UI shows local completions before profile refetch. */
function mergeOnboardingProgressUnion(
  local: Record<string, boolean>,
  server: Record<string, boolean>
): Record<string, boolean> {
  const out: Record<string, boolean> = { ...local };
  for (const [k, v] of Object.entries(server)) {
    if (v === true) out[k] = true;
  }
  return out;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function getFreeTrialActivated(profile?: OnboardingProfileFields | null): boolean {
  const tier = String(profile?.plan_tier ?? "")
    .trim()
    .toLowerCase();
  if (tier === "free_trial") return true;
  if (profile?.free_trial_activated === true) return true;
  if (!canUseStorage()) return false;
  const local = window.localStorage.getItem(ACTIVATED_KEY) === "1";
  if (!profile) return local;
  if (local && (!tier || tier === "free")) return true;
  return false;
}

/**
 * Whether completing a main checklist task should reopen the full site-tour dialog.
 * Trial flag alone is unreliable (profile/localStorage can be out of sync); anyone mid–site-tour
 * (not claimed, not all 10 done) should still see the prompt.
 */
export function shouldPromoteOnboardingSiteTourAfterTask(
  profile?: OnboardingProfileFields | null
): boolean {
  if (getFreeTrialActivated(profile)) return true;
  if (isOnboardingRewardClaimed(profile)) return false;
  return true;
}

export function isOnboardingRewardClaimed(profile?: OnboardingProfileFields | null): boolean {
  if (profile?.onboarding_reward_claimed_at) return true;
  return isSiteTourClaimedLocally();
}

export { isOnboardingSiteTourClaimedLocally } from "@/lib/subscription/onboardingSiteTourClaimedLocal";

export function syncOnboardingSiteTourClaimedFromProfile(
  profile?: OnboardingProfileFields | null
): void {
  if (!canUseStorage()) return;
  if (profile?.onboarding_reward_claimed_at) {
    persistSiteTourClaimedLocally();
  }
}

export function getMergedOnboardingProgress(
  profile?: OnboardingProfileFields | null
): Record<string, boolean> {
  const local = getOnboardingProgress();
  if (!profile) {
    return local;
  }
  const server = parseProgressFromProfile(profile.onboarding_reward_progress);
  return mergeOnboardingProgressUnion(local, server);
}

export function isOnboardingRewardComplete(profile?: OnboardingProfileFields | null): boolean {
  const progress = profile ? getMergedOnboardingProgress(profile) : getOnboardingProgress();
  return isOnboardingRewardCompleteForProgress(progress);
}

export function isOnboardingRewardCompleteForProgress(progress: Record<string, boolean>): boolean {
  return ONBOARDING_REWARD_TASK_IDS.every((id) => {
    if (id === "gyan_plus") return isGyanPlusOnboardingComplete(progress);
    return Boolean(progress[id]);
  });
}

export function isOnboardingRewardCompleteOnServer(
  serverProgress: Record<string, boolean>
): boolean {
  return isOnboardingRewardCompleteForProgress(serverProgress);
}

/** Main checklist rows (+ gyan substeps when needed) — not every companion step key. */
function buildOnboardingMergePayloadFromLocal(
  local: Record<string, boolean>,
  server: Record<string, boolean>
): Record<string, boolean> {
  const merge: Record<string, boolean> = {};

  for (const id of ONBOARDING_REWARD_TASK_IDS) {
    if (id === "gyan_plus") {
      if (isGyanPlusOnboardingComplete(server)) continue;
      if (!isGyanPlusOnboardingComplete(local)) continue;
      if (local.gyan_plus) {
        merge.gyan_plus = true;
        continue;
      }
      for (const sub of GYAN_PLUS_SUBSTEP_IDS) {
        if (local[sub] && !server[sub]) merge[sub] = true;
      }
      continue;
    }
    if (local[id] && !server[id]) merge[id] = true;
  }

  return merge;
}

/**
 * Push missing checklist rows to Supabase before claim. The claim RPC only reads
 * profiles.onboarding_reward_progress — not localStorage.
 */
export async function prepareOnboardingRewardClaim(): Promise<{
  ready: boolean;
  incompleteTaskIds: string[];
  syncError?: string;
}> {
  if (!canUseStorage()) {
    return {
      ready: false,
      incompleteTaskIds: [...ONBOARDING_REWARD_TASK_IDS],
      syncError: "offline",
    };
  }

  await flushPendingOnboardingProgressSyncs();

  let state = await fetchOnboardingRewardState({ fresh: true });
  if (isOnboardingRewardCompleteOnServer(state.progress)) {
    return { ready: true, incompleteTaskIds: [] };
  }

  const local = getOnboardingProgress();
  const mergePayload = buildOnboardingMergePayloadFromLocal(local, state.progress);

  if (Object.keys(mergePayload).length > 0) {
    let mergeResult = await bulkMergeOnboardingProgressToServer(mergePayload);
    if (!mergeResult.ok) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      mergeResult = await bulkMergeOnboardingProgressToServer(mergePayload);
    }
    if (!mergeResult.ok) {
      for (const taskId of Object.keys(mergePayload)) {
        enqueueOnboardingProgressSync(taskId, true);
      }
    }
    if (hasPendingOnboardingProgressSyncs()) {
      await flushPendingOnboardingProgressSyncs();
    }
    state = await fetchOnboardingRewardState({ fresh: true });
  }

  const incompleteTaskIds = ONBOARDING_REWARD_TASK_IDS.filter((id) => {
    if (id === "gyan_plus") return !isGyanPlusOnboardingComplete(state.progress);
    return !state.progress[id];
  });

  const flush = hasPendingOnboardingProgressSyncs()
    ? await flushPendingOnboardingProgressSyncs()
    : { stillPendingTaskId: null as string | null, lastError: undefined as string | undefined };

  return {
    ready: incompleteTaskIds.length === 0,
    incompleteTaskIds,
    syncError: flush.stillPendingTaskId ? flush.lastError : undefined,
  };
}

export function isOnboardingTaskComplete(
  taskId: string,
  progress?: Record<string, boolean>
): boolean {
  const p = progress ?? getOnboardingProgress();
  if (taskId === "gyan_plus") return isGyanPlusOnboardingComplete(p);
  return Boolean(p[taskId]);
}

/**
 * Structural dashboard popup order:
 * 1. Until trial activated → free trial promo on every /home visit
 * 2. After activation, checklist incomplete → onboarding checklist
 * 3. Checklist complete, not claimed → claim reward popup (no checklist)
 * 4. Claimed → none (Today's checklist is separate — 30s cooldown after claim; see daily checklist helpers)
 */
export function getDashboardPopupPhase(
  profile?: OnboardingProfileFields | null,
  userId?: string | null
): DashboardPopupPhase {
  if (!getFreeTrialActivated(profile)) return "free_trial";
  if (isOnboardingRewardClaimed(profile)) {
    const claimedAt = profile?.onboarding_reward_claimed_at;
    const offset = profile?.time_travel_offset_ms ?? 0;
    const now = Date.now() + offset;

    if (claimedAt) {
      const claimDate = new Date(claimedAt);
      const nextDay = new Date(claimDate);
      nextDay.setDate(claimDate.getDate() + 1);
      nextDay.setHours(9, 0, 0, 0); // 9:00 AM of next day
      if (now < nextDay.getTime()) {
        return "none"; // Wait until 9:00 AM after site-tour claim
      }
    }

    if (userId && isDailyStreakChecklistSuppressed(userId, now)) {
      return "none";
    }

    const activatedAt = profile?.free_trial_activated_at;
    if (activatedAt && !isFreeTrialPeriodEnded(activatedAt, now)) {
      if (isOnboardingRewardDismissedCooldownActive()) return "none";
      return "onboarding";
    }
    return "none";
  }
  if (isOnboardingRewardComplete(profile)) return "claim_reward";
  if (isOnboardingRewardDismissedCooldownActive()) return "none";
  return "onboarding";
}

export function getDailyChecklistAvailableAfterMs(): number | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(DAILY_CHECKLIST_AVAILABLE_AFTER_KEY);
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function isDailyChecklistCooldownElapsed(now = Date.now()): boolean {
  const availableAfter = getDailyChecklistAvailableAfterMs();
  if (availableAfter == null) return false;
  return now >= availableAfter;
}

export function getDailyChecklistCooldownRemainingMs(now = Date.now()): number {
  const availableAfter = getDailyChecklistAvailableAfterMs();
  if (availableAfter == null) return DAILY_CHECKLIST_POST_CLAIM_DELAY_MS;
  return Math.max(0, availableAfter - now);
}

/**
 * Call when user claims onboarding RDM. Today's checklist auto-opens on /home only
 * after {@link DAILY_CHECKLIST_POST_CLAIM_DELAY_MS} (not immediately on claim).
 */
export function armDailyChecklistAfterOnboardingClaim(): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(DAILY_CHECKLIST_AUTO_OPEN_KEY, "1");
  window.localStorage.setItem(
    DAILY_CHECKLIST_AVAILABLE_AFTER_KEY,
    String(Date.now() + DAILY_CHECKLIST_POST_CLAIM_DELAY_MS)
  );
}

export function clearDailyChecklistAutoOpenArm(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(DAILY_CHECKLIST_AUTO_OPEN_KEY);
  window.localStorage.removeItem(DAILY_CHECKLIST_AVAILABLE_AFTER_KEY);
}

/**
 * Backfill arm state from profile when localStorage is empty. Does not shorten an
 * active post-claim cooldown set by {@link armDailyChecklistAfterOnboardingClaim}.
 */
export function syncDailyChecklistArmFromProfile(claimedAtIso: string | null | undefined): void {
  if (!canUseStorage() || !claimedAtIso) return;
  const claimedMs = Date.parse(claimedAtIso);
  if (!Number.isFinite(claimedMs)) return;

  const existingAfter = getDailyChecklistAvailableAfterMs();
  const now = Date.now();
  if (
    window.localStorage.getItem(DAILY_CHECKLIST_AUTO_OPEN_KEY) === "1" &&
    existingAfter != null &&
    existingAfter > now
  ) {
    return;
  }

  window.localStorage.setItem(DAILY_CHECKLIST_AUTO_OPEN_KEY, "1");
  const cooldownEnd = claimedMs + DAILY_CHECKLIST_POST_CLAIM_DELAY_MS;
  window.localStorage.setItem(
    DAILY_CHECKLIST_AVAILABLE_AFTER_KEY,
    String(now >= cooldownEnd ? 0 : cooldownEnd)
  );
}

/** Whether /home should auto-open Today's checklist (respects post-claim cooldown). */
export function shouldAutoOpenDailyChecklistOnHome(
  profile?: OnboardingProfileFields | null
): boolean {
  if (!isOnboardingRewardClaimed(profile)) return false;
  if (!canUseStorage()) return false;
  if (window.localStorage.getItem(DAILY_CHECKLIST_AUTO_OPEN_KEY) !== "1") return false;
  return isDailyChecklistCooldownElapsed();
}

export function buildOnboardingRewardChecklistToast(
  actionLine: string,
  rewardRdm = getChecklistRewardRdm()
) {
  const progress = getOnboardingProgress();
  const completedCount = ONBOARDING_REWARD_TASK_IDS.filter((id) =>
    isOnboardingTaskComplete(id, progress)
  ).length;
  const totalCount = ONBOARDING_REWARD_TASK_IDS.length;
  return {
    title: "Checklist task complete! 🎉",
    description: `${actionLine} · ${completedCount}/${totalCount} completed. Complete remaining ones to claim ${rewardRdm} RDM!`,
    className:
      "border-2 border-violet-500 bg-[#090f1e]/95 text-white shadow-xl shadow-violet-950/40 ring-2 ring-violet-500/50 ring-offset-2 ring-offset-background duration-500",
    duration: 5000,
  };
}

/**
 * Merge server progress into localStorage (union of true flags).
 * Avoids wiping tasks the user completed locally when the profile payload is stale or sync is pending.
 */
export function hydrateOnboardingProgressFromServer(progress: Record<string, boolean>): void {
  if (!canUseStorage()) return;
  const merged = mergeOnboardingProgressUnion(getOnboardingProgress(), progress);
  window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(merged));
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_PROGRESS_EVENT, {
      detail: {
        taskId: "hydrate",
        showChecklistToast: false,
      } satisfies OnboardingProgressEventDetail,
    })
  );
}

/** Wire POST /api/user/subscription/activate-trial to DB. */
export async function activateFreeTrial(
  answers: TrialOnboardingAnswers = INITIAL_TRIAL_ONBOARDING_ANSWERS
): Promise<void> {
  const authHeaders = await getClientApiAuthHeaders();
  const res = await fetch("/api/user/subscription/activate-trial", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ answers }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Failed to activate free trial");
  }

  const payload = (await res.json().catch(() => ({}))) as {
    free_trial_activated_at?: string;
    alreadyActivated?: boolean;
  };

  if (typeof window === "undefined") return;
  if (payload.alreadyActivated !== true) {
    resetOnboardingRewardChecklist();
    clearDailyChecklistAutoOpenArm();
  }
  window.localStorage.setItem(ACTIVATED_KEY, "1");
  const activatedAt =
    typeof payload.free_trial_activated_at === "string"
      ? payload.free_trial_activated_at
      : new Date().toISOString();
  cacheFreeTrialActivatedAt(activatedAt);
  window.localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
  window.dispatchEvent(new CustomEvent(FREE_TRIAL_ACTIVATED_EVENT));
}

/** Deactivate trial in DB; keep trial_onboarding_answers for wizard pre-fill. */
export async function revokeFreeTrial(): Promise<void> {
  const authHeaders = await getClientApiAuthHeaders();
  const res = await fetch("/api/user/subscription/revoke-trial", {
    method: "POST",
    headers: { ...authHeaders },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Failed to revoke free trial");
  }

  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVATED_KEY);
  window.localStorage.removeItem(ACTIVATED_AT_KEY);
  window.localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
  window.localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
  clearDailyChecklistAutoOpenArm();
  resetAllOnboardingGuideSessions();
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_PROGRESS_EVENT, {
      detail: {
        taskId: "reset",
        showChecklistToast: false,
      } satisfies OnboardingProgressEventDetail,
    })
  );
  window.dispatchEvent(new CustomEvent(FREE_TRIAL_REVOKED_EVENT));
}

export function getOnboardingRewardDismissed(): boolean {
  if (!canUseStorage()) return false;
  return window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
}

export function dismissOnboardingReward(): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
}

/**
 * Drop site-tour / trial localStorage when a different account signs in on this browser
 * (e.g. auth user deleted in Supabase and re-registered with the same email).
 */
export function ensureOnboardingLocalStateForUser(userId: string): void {
  if (!canUseStorage() || !userId) return;
  const previousOwner = window.localStorage.getItem(ONBOARDING_LOCAL_OWNER_KEY);
  if (previousOwner === userId) return;

  window.localStorage.removeItem(ACTIVATED_KEY);
  window.localStorage.removeItem(ACTIVATED_AT_KEY);
  window.localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
  window.localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
  window.localStorage.removeItem(ONBOARDING_COOLDOWN_KEY);
  clearOnboardingSiteTourClaimedLocally();
  clearDailyChecklistAutoOpenArm();
  clearPendingOnboardingProgressSyncs();
  resetAllOnboardingGuideSessions();
  window.localStorage.setItem(ONBOARDING_LOCAL_OWNER_KEY, userId);
  resetStudyDaysReconcileSession();

  if (previousOwner) {
    window.dispatchEvent(
      new CustomEvent(ONBOARDING_PROGRESS_EVENT, {
        detail: {
          taskId: "reset",
          showChecklistToast: false,
        } satisfies OnboardingProgressEventDetail,
      })
    );
  }
}

export function getOnboardingProgress(): Record<string, boolean> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(ONBOARDING_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return normalizeProgressRecord(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

/** Clear checklist ticks and notify listeners (session onboarding guides cleared separately). */
export function resetOnboardingRewardChecklistProgress(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
  void resetOnboardingRewardOnServer();
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_PROGRESS_EVENT, {
      detail: {
        taskId: "reset",
        showChecklistToast: false,
      } satisfies OnboardingProgressEventDetail,
    })
  );
}

/** Full checklist reset: local progress + in-flight violet hint sessions. */
export function resetOnboardingRewardChecklist(): void {
  resetOnboardingRewardChecklistProgress();
  resetAllOnboardingGuideSessions();
  dismissOnboardingTaskCompanion();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ONBOARDING_COOLDOWN_KEY);
    clearOnboardingSiteTourClaimedLocally();
  }
}

export function markOnboardingRewardClaimedLocally(): void {
  if (!canUseStorage()) return;
  persistSiteTourClaimedLocally();
  clearPendingOnboardingProgressSyncs();
  window.dispatchEvent(new CustomEvent(ONBOARDING_REWARD_CLAIMED_EVENT));
}

/** Admins tick checklist manually — disable auto-completion from browsing the app. */
export function enableAdminManualOnboardingChecklist(): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ADMIN_MANUAL_CHECKLIST_KEY, "1");
}

export function isAdminManualOnboardingChecklist(): boolean {
  return canUseStorage() && window.localStorage.getItem(ADMIN_MANUAL_CHECKLIST_KEY) === "1";
}

function dispatchOnboardingProgress(
  taskId: string,
  opts?: { toastActionLine?: string; showChecklistToast?: boolean }
): void {
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_PROGRESS_EVENT, {
      detail: {
        taskId,
        toastActionLine: opts?.toastActionLine,
        showChecklistToast: opts?.showChecklistToast ?? true,
      } satisfies OnboardingProgressEventDetail,
    })
  );
}

/** Companion tasks that complete the checklist row when all step keys are true. */
const COMPANION_STEP_TASK_LENGTH: Record<string, number> = {
  magic_wall: 3,
  prep_classes: 4,
  prep_mcq: 4,
  edufund: 4,
  play_dailydose: 4,
};

function maybeCompleteCompanionTaskFromSteps(taskId: string): void {
  const stepCount = COMPANION_STEP_TASK_LENGTH[taskId];
  if (!stepCount) return;

  // Defer prep_mcq auto-completion if the user is actively taking a quiz.
  // It will be fully completed and triggered when they click Submit in the quiz session.
  if (taskId === "prep_mcq") {
    if (typeof document !== "undefined" && !!document.querySelector('div[role="radiogroup"]')) {
      return;
    }
  }

  const progress = getOnboardingProgress();
  if (progress[taskId]) return;
  const allDone = Array.from({ length: stepCount }, (_, i) =>
    Boolean(progress[`${taskId}_step_${i}`])
  ).every(Boolean);
  if (allDone) {
    markOnboardingTaskComplete(taskId, { showChecklistToast: true });
  }
}

function dispatchOnboardingSyncFailed(taskId: string, error?: string): void {
  window.dispatchEvent(
    new CustomEvent<OnboardingSyncFailedDetail>(ONBOARDING_SYNC_FAILED_EVENT, {
      detail: { taskId, error },
    })
  );
}

async function persistOnboardingKeyToServer(
  taskId: string,
  completed: boolean,
  opts?: { notifyOnFailure?: boolean }
): Promise<void> {
  /** Day 2+ companion retries use local step keys only; server blocks PATCH after site-tour claim. */
  if (isSiteTourClaimedLocally()) {
    return;
  }

  if (typeof window !== "undefined") {
    ensureOnboardingProgressSyncRetryListeners();
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueOnboardingProgressSync(taskId, completed);
    return;
  }

  let result = await syncOnboardingTaskToServer(taskId, completed);
  if (!result.ok) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    result = await syncOnboardingTaskToServer(taskId, completed);
  }
  if (!result.ok) {
    if (result.error === "already_claimed") {
      persistSiteTourClaimedLocally();
      return;
    }
    enqueueOnboardingProgressSync(taskId, completed);
    if (opts?.notifyOnFailure !== false && typeof navigator !== "undefined" && navigator.onLine) {
      dispatchOnboardingSyncFailed(taskId, result.error);
    }
  }
}

/** Persist task completion locally and sync to profiles.onboarding_reward_progress. */
export function markOnboardingTaskComplete(
  taskId: string,
  opts?: {
    toastActionLine?: string;
    showChecklistToast?: boolean;
    /** Bypass auto-track guard (admin manual tick). */
    adminManual?: boolean;
  }
): void {
  if (!canUseStorage()) return;
  const progress = getOnboardingProgress();
  if (progress[taskId]) return;
  progress[taskId] = true;
  window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
  void persistOnboardingKeyToServer(taskId, true, {
    notifyOnFailure: opts?.adminManual ?? false,
  });
  dispatchOnboardingProgress(taskId, opts);

  /** Re-open full site tour after task completes (may defer if topic quiz is open). */
  if (isMainOnboardingTaskId(taskId)) {
    requestOnboardingSiteTourAfterTask(taskId);
  }
}

/** Persist step-level completion locally and sync to profiles.onboarding_reward_progress in the Supabase DB. */
export function markOnboardingStepComplete(taskId: string, stepIndex: number): void {
  if (!canUseStorage()) return;
  const stepId = `${taskId}_step_${stepIndex}`;
  const progress = getOnboardingProgress();
  if (progress[stepId]) return;
  progress[stepId] = true;
  window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));

  void persistOnboardingKeyToServer(stepId, true, { notifyOnFailure: false });
  dispatchOnboardingProgress(stepId, { showChecklistToast: false });
  window.dispatchEvent(
    new CustomEvent("edublast-onboarding-step-progress", {
      detail: { taskId, stepIndex, completed: true },
    })
  );
  maybeCompleteCompanionTaskFromSteps(taskId);
}

/** Students may clear mistaken Magic Wall sub-steps; admins can clear any step key. */
export function clearOnboardingStepComplete(taskId: string, stepIndex: number): void {
  if (!canUseStorage()) return;
  const stepId = `${taskId}_step_${stepIndex}`;
  const isStudentClearableSubstep =
    /^(magic_wall|lessons|gyan_plus|earn_buddy|earn_challenge|news_blog|profile)_step_[0-9]$/.test(
      stepId
    );

  if (isAdminManualOnboardingChecklist()) {
    unmarkOnboardingTask(stepId, { showChecklistToast: false });
    return;
  }
  if (!isStudentClearableSubstep) return;

  const progress = getOnboardingProgress();
  if (!progress[stepId]) return;
  delete progress[stepId];
  window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
  void persistOnboardingKeyToServer(stepId, false, { notifyOnFailure: false });
  dispatchOnboardingProgress(stepId, { showChecklistToast: false });
  window.dispatchEvent(
    new CustomEvent("edublast-onboarding-step-progress", {
      detail: { taskId, stepIndex, completed: false },
    })
  );
}

/** Clear a server-verified checklist row when DB says the task is not done (students). */
export function clearOnboardingTaskCompleteForStudent(taskId: string): void {
  if (!canUseStorage()) return;
  if (taskId !== "earn_buddy") return;

  if (isAdminManualOnboardingChecklist()) {
    unmarkOnboardingTask(taskId, { showChecklistToast: false });
    return;
  }

  const progress = getOnboardingProgress();
  if (!progress[taskId]) return;
  delete progress[taskId];
  window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
  void persistOnboardingKeyToServer(taskId, false, { notifyOnFailure: false });
  dispatchOnboardingProgress(taskId, { showChecklistToast: false });
}

/** Admin-only: clear one checklist step locally and on the server. */
export function unmarkOnboardingTask(
  taskId: string,
  opts?: { showChecklistToast?: boolean }
): void {
  if (!canUseStorage()) return;
  if (!isAdminManualOnboardingChecklist()) return;
  const progress = getOnboardingProgress();
  if (!progress[taskId]) return;
  delete progress[taskId];
  window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
  void persistOnboardingKeyToServer(taskId, false, { notifyOnFailure: false });
  dispatchOnboardingProgress(taskId, {
    ...opts,
    showChecklistToast: opts?.showChecklistToast ?? false,
  });
}

/** Admin-only: toggle a checklist step on or off. */
export function toggleOnboardingTaskForAdmin(taskId: string, done: boolean): void {
  if (taskId === "gyan_plus") {
    if (done) {
      markOnboardingTaskComplete("gyan_plus", { adminManual: true, showChecklistToast: false });
      for (const sub of GYAN_PLUS_SUBSTEP_IDS) {
        markOnboardingTaskComplete(sub, { adminManual: true, showChecklistToast: false });
      }
    } else {
      unmarkOnboardingTask("gyan_plus", { showChecklistToast: false });
      for (const sub of GYAN_PLUS_SUBSTEP_IDS) {
        unmarkOnboardingTask(sub, { showChecklistToast: false });
      }
    }
    return;
  }
  if (done) {
    markOnboardingTaskComplete(taskId, { adminManual: true, showChecklistToast: false });
  } else {
    unmarkOnboardingTask(taskId, { showChecklistToast: false });
  }
}

/** Onboarding Magic Wall step: at least one topic saved in the reading basket. */
export function maybeMarkMagicWallOnboardingFromBasket(savedTopicCount: number): void {
  if (savedTopicCount < 1) return;
  if (getOnboardingProgress().magic_wall) return;
  markOnboardingTaskComplete("magic_wall");
}

/** Clear local companion steps so Day-2 daily checklist can re-run the guided flow. */
export function resetOnboardingCompanionTaskForDailyChecklist(taskId: string): void {
  if (!canUseStorage()) return;
  const progress = getOnboardingProgress();
  delete progress[taskId];
  for (let i = 0; i < 4; i++) {
    delete progress[`${taskId}_step_${i}`];
  }
  if (taskId === "gyan_plus") {
    for (const sub of GYAN_PLUS_SUBSTEP_IDS) {
      delete progress[sub];
    }
  }
  window.localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
}

/** @deprecated Use resetOnboardingCompanionTaskForDailyChecklist("prep_mcq") */
export function resetPrepMcqCompanionForDailyChecklist(): void {
  resetOnboardingCompanionTaskForDailyChecklist("prep_mcq");
}

/** Onboarding CBSE MCQ: quiz loaded — step 2 when companion active, else legacy full row. */
export function maybeMarkPrepMcqOnboardingFromQuizStart(): void {
  const dailyRetry =
    typeof window !== "undefined" &&
    (window.sessionStorage.getItem("edublast-daily-checklist-cbse-mcq-v1") === "1" ||
      isDailyChecklistCompanionRetryActive("prep_mcq"));
  if (getOnboardingProgress().prep_mcq && !dailyRetry) return;
  if (isOnboardingTaskCompanionLaunched("prep_mcq")) {
    markOnboardingStepComplete("prep_mcq", 2);
    return;
  }
  markOnboardingTaskComplete("prep_mcq");
}

/** Onboarding Prep + Mock · Classes: arrived on /classrooms from checklist (step 0 only). */
export function maybeMarkPrepClassesOnboardingFromClassroomsVisit(): void {
  if (getOnboardingProgress().prep_classes) return;
  markPrepClassesStep0FromClassroomsPage();
}

/** @deprecated Use `maybeMarkPrepClassesOnboardingFromClassroomsVisit`. */
export function maybeMarkPrepClassesOnboardingFromExplore(): void {
  maybeMarkPrepClassesOnboardingFromClassroomsVisit();
}

/** EduFund Create Proposal — step 2 when companion active, else legacy full row. */
export function maybeMarkEdufundOnboardingFromCreateProposal(): void {
  if (getOnboardingProgress().edufund) return;
  if (isOnboardingTaskCompanionLaunched("edufund")) {
    markOnboardingStepComplete("edufund", 2);
    return;
  }
  markOnboardingTaskComplete("edufund");
}

export { maybeMarkEarnBuddyOnboardingFromBuddyActivation } from "@/lib/onboarding/earnBuddyCompanionOnboarding";

/** @deprecated Use earn challenge companion steps; kept for imports that only clear legacy flow. */
export function maybeMarkEarnChallengeOnboardingFromStart(): void {
  /* Task completes when all 4 companion steps are done (see earnChallengeCompanionOnboarding). */
}

export { maybeMarkProfileOnboardingFromBasicInfo } from "@/lib/onboarding/profileCompanionOnboarding";
