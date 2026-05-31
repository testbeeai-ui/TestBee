export type TrialOnboardingAnswers = {
  classLevel: string | null;
  board: string | null;
  boardCustom: string;
  objective: string | null;
  boardExam: string | null;
  boardExamCustom: string;
  engExams: string[];
  medExams: string[];
  primaryPlatform: string | null;
  /** When primaryPlatform is "School only". */
  schoolName: string;
  secondaryPlatforms: string[];
  /** When "Other EdTech platform" is selected in secondaryPlatforms. */
  otherEdtechPlatformName: string;
  studyHours: string | null;
  usedAi: boolean | null;
  usedSocMed: boolean | null;
  wantsGamification: boolean | null;
};

export const TRIAL_OTHER_STATE_BOARD = "Other state board";
export const TRIAL_OTHER_EDTECH_PLATFORM = "Other EdTech platform";
export const TRIAL_PRIMARY_SCHOOL_ONLY = "School only";

export const INITIAL_TRIAL_ONBOARDING_ANSWERS: TrialOnboardingAnswers = {
  classLevel: null,
  board: null,
  boardCustom: "",
  objective: null,
  boardExam: null,
  boardExamCustom: "",
  engExams: [],
  medExams: [],
  primaryPlatform: null,
  schoolName: "",
  secondaryPlatforms: [],
  otherEdtechPlatformName: "",
  studyHours: null,
  usedAi: null,
  usedSocMed: null,
  wantsGamification: null,
};

export const TRIAL_STEP_PCTS = [0, 14, 28, 43, 57, 72, 86, 100] as const;
