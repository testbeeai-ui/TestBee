import {
  INITIAL_TRIAL_ONBOARDING_ANSWERS,
  type TrialOnboardingAnswers,
} from "@/components/dashboard/free-trial-onboarding/types";
import {
  validateScreen1,
  validateScreen2,
  validateScreen3,
  validateScreen4,
} from "@/components/dashboard/free-trial-onboarding/validation";

export type TrialObjectiveSub = "sub-board" | "sub-eng" | "sub-med" | "sub-other" | null;

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((x) => typeof x === "string");
}

function pickString(val: unknown): string | null {
  return typeof val === "string" && val.trim() ? val.trim() : null;
}

function pickBool(val: unknown): boolean | null {
  return typeof val === "boolean" ? val : null;
}

/** Merge persisted profile JSON into defaults for wizard pre-fill. */
export function parseTrialOnboardingAnswersFromProfile(raw: unknown): TrialOnboardingAnswers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...INITIAL_TRIAL_ONBOARDING_ANSWERS };
  }
  const o = raw as Record<string, unknown>;
  return {
    classLevel: pickString(o.classLevel) ?? INITIAL_TRIAL_ONBOARDING_ANSWERS.classLevel,
    board: pickString(o.board) ?? INITIAL_TRIAL_ONBOARDING_ANSWERS.board,
    boardCustom:
      typeof o.boardCustom === "string"
        ? o.boardCustom
        : INITIAL_TRIAL_ONBOARDING_ANSWERS.boardCustom,
    objective: pickString(o.objective) ?? INITIAL_TRIAL_ONBOARDING_ANSWERS.objective,
    boardExam: pickString(o.boardExam) ?? INITIAL_TRIAL_ONBOARDING_ANSWERS.boardExam,
    boardExamCustom:
      typeof o.boardExamCustom === "string"
        ? o.boardExamCustom
        : INITIAL_TRIAL_ONBOARDING_ANSWERS.boardExamCustom,
    engExams: isStringArray(o.engExams) ? o.engExams : INITIAL_TRIAL_ONBOARDING_ANSWERS.engExams,
    medExams: isStringArray(o.medExams) ? o.medExams : INITIAL_TRIAL_ONBOARDING_ANSWERS.medExams,
    primaryPlatform:
      pickString(o.primaryPlatform) ?? INITIAL_TRIAL_ONBOARDING_ANSWERS.primaryPlatform,
    schoolName:
      typeof o.schoolName === "string"
        ? o.schoolName.trim().slice(0, 200)
        : INITIAL_TRIAL_ONBOARDING_ANSWERS.schoolName,
    secondaryPlatforms: isStringArray(o.secondaryPlatforms)
      ? o.secondaryPlatforms
      : INITIAL_TRIAL_ONBOARDING_ANSWERS.secondaryPlatforms,
    otherEdtechPlatformName:
      typeof o.otherEdtechPlatformName === "string"
        ? o.otherEdtechPlatformName
        : INITIAL_TRIAL_ONBOARDING_ANSWERS.otherEdtechPlatformName,
    studyHours: pickString(o.studyHours) ?? INITIAL_TRIAL_ONBOARDING_ANSWERS.studyHours,
    usedAi: pickBool(o.usedAi) ?? INITIAL_TRIAL_ONBOARDING_ANSWERS.usedAi,
    usedSocMed: pickBool(o.usedSocMed) ?? INITIAL_TRIAL_ONBOARDING_ANSWERS.usedSocMed,
    wantsGamification:
      pickBool(o.wantsGamification) ?? INITIAL_TRIAL_ONBOARDING_ANSWERS.wantsGamification,
  };
}

/** Which objective sub-panel to show on screen 2 when answers are pre-filled. */
export function deriveObjectiveSub(answers: TrialOnboardingAnswers): TrialObjectiveSub {
  const obj = answers.objective;
  if (obj === "Clear Board Exams") return "sub-board";
  if (obj === "Engineering entrance") return "sub-eng";
  if (obj === "Medical entrance") return "sub-med";
  if (obj === "Other") return "sub-other";
  return null;
}

/** Normalize client payload and return first validation message, if any (API activate-trial). */
export function validateTrialOnboardingForActivate(raw: unknown): {
  answers: TrialOnboardingAnswers;
  error: string | null;
} {
  const answers = parseTrialOnboardingAnswersFromProfile(raw);
  const objectiveSub = deriveObjectiveSub(answers);
  const merged = {
    ...validateScreen1(answers),
    ...validateScreen2(answers, objectiveSub),
    ...validateScreen3(answers),
    ...validateScreen4(answers),
  };
  const firstError = Object.values(merged).find((msg) => typeof msg === "string" && msg);
  return { answers, error: firstError ?? null };
}

export function hasSavedTrialOnboardingAnswers(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const parsed = parseTrialOnboardingAnswersFromProfile(raw);
  return (
    parsed.classLevel != null ||
    parsed.board != null ||
    parsed.objective != null ||
    parsed.primaryPlatform != null
  );
}
