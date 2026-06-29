import type { Subject } from "@/types";
import { normalizePlanTier, type SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";
import {
  isAdvancedQuizSetIndex,
  type AdvancedQuizSetIndex,
} from "@/lib/play/quiz/advancedQuizSets";

const STORAGE_PREFIX = "edublast:topic-qbank-unlock:";

/** Same destination as numerals regenerate upsell and other lesson premium gates. */
export const TOPIC_QUESTION_BANK_UPGRADE_PATH = "/profile?section=sub-plans";

/** Shown when a free-plan learner opens a teacher-assigned premium quiz set. */
export const TEACHER_ASSIGNMENT_QUIZ_UNLOCK_MESSAGE =
  "Unlocked for this teacher assignment — your teacher covered the platform cost for this set.";

/** Shown when teacher sponsored full Concept Focus subtopic access (all sets + references). */
export const TEACHER_SPONSORED_SUBTOPIC_UNLOCK_MESSAGE =
  "Unlocked for this assignment — your teacher sponsored full access to this subtopic.";

export type TopicQuestionBankScope = {
  userId: string;
  /** Lesson pathname (no query) — one unlock per subtopic lesson page. */
  lessonPath: string;
};

export type AdvancedQuizSetLockReason =
  | "open"
  | "assignment"
  | "sponsored_subtopic"
  | "needs_starter_or_pro"
  | "needs_question_bank_unlock";

export type AdvancedQuizSetLockState = {
  locked: boolean;
  reason: AdvancedQuizSetLockReason;
};

export function hasQuestionBankPlanAccess(plan: SubscriptionPlanKey): boolean {
  return plan === "starter" || plan === "pro";
}

/** Video & reading references — same paid tiers as question bank sets 2–6. */
export function hasTopicReferencesAccess(plan: SubscriptionPlanKey): boolean {
  return hasQuestionBankPlanAccess(plan);
}

type PlanTierProfileInput = {
  plan_tier?: string | null;
  free_trial_activated?: boolean | null;
} & NonNullable<Parameters<typeof normalizePlanTier>[2]>;

export function resolvePlanTierFromProfile(
  profile: PlanTierProfileInput | null | undefined
): SubscriptionPlanKey {
  return normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
}

function storageKey(scope: TopicQuestionBankScope): string {
  return `${STORAGE_PREFIX}${scope.userId}:${scope.lessonPath}`.toLowerCase();
}

export function isTopicQuestionBankUnlocked(scope: TopicQuestionBankScope): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey(scope)) === "1";
  } catch {
    return false;
  }
}

export function markTopicQuestionBankUnlocked(scope: TopicQuestionBankScope): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(scope), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function parseQuizSetSearchParam(
  value: string | null | undefined
): AdvancedQuizSetIndex | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return isAdvancedQuizSetIndex(n) ? n : null;
}

export function resolveTeacherAssignmentQuizAccess(params: {
  panel: string | null;
  postId: string | null;
  quizSetParam: string | null;
}): { active: boolean; assignedSet: AdvancedQuizSetIndex | null } {
  if (params.panel !== "quiz" || !params.postId?.trim()) {
    return { active: false, assignedSet: null };
  }
  const assignedSet = parseQuizSetSearchParam(params.quizSetParam);
  return { active: assignedSet != null, assignedSet };
}

export function isTeacherAssignmentQuizSet(
  setIndex: AdvancedQuizSetIndex,
  assignment: ReturnType<typeof resolveTeacherAssignmentQuizAccess>
): boolean {
  return assignment.active && assignment.assignedSet === setIndex;
}

export function getAdvancedQuizSetLockState(
  setIndex: AdvancedQuizSetIndex,
  opts: {
    plan: SubscriptionPlanKey;
    questionBankUnlocked: boolean;
    isAssignmentSet?: boolean;
    /** Teacher-funded Concept Focus unlock — all sets 2–6 for this assignment. */
    sponsoredFullSubtopic?: boolean;
  }
): AdvancedQuizSetLockState {
  if (setIndex === 1) return { locked: false, reason: "open" };
  if (opts.sponsoredFullSubtopic) {
    return { locked: false, reason: "sponsored_subtopic" };
  }
  if (opts.isAssignmentSet) return { locked: false, reason: "assignment" };
  if (!hasQuestionBankPlanAccess(opts.plan)) {
    return { locked: true, reason: "needs_starter_or_pro" };
  }
  if (!opts.questionBankUnlocked) {
    return { locked: true, reason: "needs_question_bank_unlock" };
  }
  return { locked: false, reason: "open" };
}

export function canAccessAdvancedQuizSet(
  setIndex: AdvancedQuizSetIndex,
  opts: Parameters<typeof getAdvancedQuizSetLockState>[1]
): boolean {
  return !getAdvancedQuizSetLockState(setIndex, opts).locked;
}

export function buildTopicQuestionBankHref(
  subject: Subject,
  classLevel: number,
  chapterTitle?: string
): string {
  const q = new URLSearchParams({ tab: "mcq", subject });
  q.set("class", String(classLevel));
  if (chapterTitle?.trim()) q.set("chapter", chapterTitle.trim());
  return `/mock-test?${q.toString()}`;
}

export function quizSetLockTitle(reason: AdvancedQuizSetLockReason): string | undefined {
  if (reason === "sponsored_subtopic") {
    return TEACHER_SPONSORED_SUBTOPIC_UNLOCK_MESSAGE;
  }
  if (reason === "assignment") {
    return TEACHER_ASSIGNMENT_QUIZ_UNLOCK_MESSAGE;
  }
  if (reason === "needs_starter_or_pro") {
    return "Sets 2–6 are in the Question bank (Starter & Pro plans)";
  }
  if (reason === "needs_question_bank_unlock") {
    return "Tap Question bank to unlock sets 2–6 for this topic";
  }
  return undefined;
}
