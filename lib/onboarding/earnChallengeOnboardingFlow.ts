/** Onboarding reward: Earn & Learn → MentaMill or FunBrain → Start challenge. */
export const EARN_CHALLENGE_ONBOARDING_QUERY = "onboarding_earn_challenge";

const SESSION_KEY = "edublast.onboarding_earn_challenge_flow_v1";
/** Set when user taps Go; cleared after they pick MentaMill or FunBrain. */
const PICK_CHALLENGE_STEP_KEY = "edublast.onboarding_earn_challenge_pick_v1";
/** Set after challenge pick; cleared when they tap Start challenge. */
const START_CHALLENGE_STEP_KEY = "edublast.onboarding_earn_challenge_start_v1";
/** ISO timestamp of when the companion was launched — used to filter community posts to new ones only. */
const SESSION_STARTED_AT_KEY = "edublast.onboarding_earn_challenge_started_at_v1";

/** MentaMill Blitz + FunBrain Quiz — either satisfies the checklist step. */
export const EARN_CHALLENGE_ONBOARDING_PICK_KEYS = new Set(["5", "10"]);

function canUseSession(): boolean {
  return typeof window !== "undefined";
}

export function startEarnChallengeOnboardingFlow(): void {
  if (!canUseSession()) return;
  window.sessionStorage.setItem(SESSION_KEY, "1");
  window.sessionStorage.setItem(PICK_CHALLENGE_STEP_KEY, "1");
  window.sessionStorage.removeItem(START_CHALLENGE_STEP_KEY);
  // Record start time so the community-post check only counts new posts from this session.
  if (!window.sessionStorage.getItem(SESSION_STARTED_AT_KEY)) {
    window.sessionStorage.setItem(SESSION_STARTED_AT_KEY, new Date().toISOString());
  }
}

/**
 * Returns the ISO timestamp marking the start of this challenge onboarding session.
 * If no timestamp is stored yet (e.g. new browser session after browser was closed),
 * it initialises to NOW and saves it — so only posts made from this point forward
 * will count towards the "Post to community" step.
 * Safe to call multiple times; always returns the same value within a session.
 */
export function ensureEarnChallengeCompanionTimestamp(): string {
  if (!canUseSession()) return new Date().toISOString();
  const existing = window.sessionStorage.getItem(SESSION_STARTED_AT_KEY);
  if (existing) return existing;
  // New browser session: companion is still active (localStorage persists) but
  // sessionStorage was cleared. Initialise to now so old posts are excluded.
  const now = new Date().toISOString();
  window.sessionStorage.setItem(SESSION_STARTED_AT_KEY, now);
  return now;
}

export function isEarnChallengeOnboardingFlowActive(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(SESSION_KEY) === "1";
}

export function shouldShowEarnChallengePickGuide(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(PICK_CHALLENGE_STEP_KEY) === "1";
}

export function shouldShowEarnChallengeStartGuide(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(START_CHALLENGE_STEP_KEY) === "1";
}

export function advanceEarnChallengeToStartStep(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(PICK_CHALLENGE_STEP_KEY);
  window.sessionStorage.setItem(START_CHALLENGE_STEP_KEY, "1");
}

export function clearEarnChallengePickGuideStep(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(PICK_CHALLENGE_STEP_KEY);
}

export function clearEarnChallengeStartGuideStep(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(START_CHALLENGE_STEP_KEY);
}

export function clearEarnChallengeOnboardingFlow(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(PICK_CHALLENGE_STEP_KEY);
  window.sessionStorage.removeItem(START_CHALLENGE_STEP_KEY);
  window.sessionStorage.removeItem(SESSION_STARTED_AT_KEY);
}

export function earnChallengeOnboardingHref(): string {
  return `/refer-earn?${EARN_CHALLENGE_ONBOARDING_QUERY}=1`;
}

export function isEarnChallengeOnboardingPickKey(key: string): boolean {
  return EARN_CHALLENGE_ONBOARDING_PICK_KEYS.has(key);
}
