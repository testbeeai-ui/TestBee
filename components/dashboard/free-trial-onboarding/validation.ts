import type { TrialOnboardingAnswers } from "./types";
import {
  TRIAL_OTHER_EDTECH_PLATFORM,
  TRIAL_OTHER_STATE_BOARD,
  TRIAL_PRIMARY_SCHOOL_ONLY,
} from "./types";

export type TrialValidationErrors = Partial<Record<string, string>>;

export function isOtherStateBoard(board: string | null) {
  return board === TRIAL_OTHER_STATE_BOARD;
}

export function hasOtherEdtechSecondary(answers: TrialOnboardingAnswers) {
  return answers.secondaryPlatforms.includes(TRIAL_OTHER_EDTECH_PLATFORM);
}

export function isSchoolOnlyPrimary(answers: TrialOnboardingAnswers) {
  return answers.primaryPlatform === TRIAL_PRIMARY_SCHOOL_ONLY;
}

export function validateScreen1(answers: TrialOnboardingAnswers): TrialValidationErrors {
  const errors: TrialValidationErrors = {};

  if (!answers.classLevel) {
    errors.classLevel = "Please select your class.";
  }

  if (!answers.board) {
    errors.board = "Please select your school board.";
  } else if (isOtherStateBoard(answers.board) && answers.boardCustom.trim().length < 2) {
    errors.boardCustom = "Please enter your state board name (at least 2 characters).";
  }

  return errors;
}

export function validateScreen2(
  answers: TrialOnboardingAnswers,
  objectiveSub: "sub-board" | "sub-eng" | "sub-med" | "sub-other" | null
): TrialValidationErrors {
  const errors: TrialValidationErrors = {};

  if (!answers.objective) {
    errors.objective = "Please select your primary target.";
    return errors;
  }

  if (objectiveSub === "sub-board") {
    if (!answers.boardExam) {
      errors.boardExam = "Please select which board exam you are preparing for.";
    } else if (
      answers.boardExam === TRIAL_OTHER_STATE_BOARD &&
      answers.boardExamCustom.trim().length < 2
    ) {
      errors.boardExamCustom = "Please enter your board exam name (at least 2 characters).";
    }
  }

  if (objectiveSub === "sub-eng" && answers.engExams.length === 0) {
    errors.engExams = "Please select at least one entrance exam.";
  }

  if (objectiveSub === "sub-med" && answers.medExams.length === 0) {
    errors.medExams = "Please select at least one entrance exam.";
  }

  return errors;
}

export function validateScreen3(answers: TrialOnboardingAnswers): TrialValidationErrors {
  const errors: TrialValidationErrors = {};

  if (!answers.primaryPlatform) {
    errors.primaryPlatform = "Please select your primary learning platform.";
  }

  if (hasOtherEdtechSecondary(answers) && answers.otherEdtechPlatformName.trim().length < 2) {
    errors.otherEdtechPlatformName =
      "Please share the name of the EdTech platform (at least 2 characters).";
  }

  return errors;
}

export function displayPrimaryPlatform(answers: TrialOnboardingAnswers): string {
  if (!answers.primaryPlatform) return "—";
  if (isSchoolOnlyPrimary(answers) && answers.schoolName.trim()) {
    return `${TRIAL_PRIMARY_SCHOOL_ONLY} (${answers.schoolName.trim()})`;
  }
  return answers.primaryPlatform;
}

export function displaySecondaryPlatforms(answers: TrialOnboardingAnswers): string {
  if (answers.secondaryPlatforms.length === 0) return "—";
  return answers.secondaryPlatforms
    .map((platform) => {
      if (platform === TRIAL_OTHER_EDTECH_PLATFORM && answers.otherEdtechPlatformName.trim()) {
        return `${platform} (${answers.otherEdtechPlatformName.trim()})`;
      }
      return platform;
    })
    .join(", ");
}

export function validateScreen4(answers: TrialOnboardingAnswers): TrialValidationErrors {
  const errors: TrialValidationErrors = {};

  if (answers.usedAi === null) {
    errors.usedAi = "Please answer this question.";
  }
  if (answers.usedSocMed === null) {
    errors.usedSocMed = "Please answer this question.";
  }
  if (answers.wantsGamification === null) {
    errors.wantsGamification = "Please answer this question.";
  }

  return errors;
}

export function displayClass(answers: TrialOnboardingAnswers) {
  return answers.classLevel ?? "—";
}

export function displayBoard(answers: TrialOnboardingAnswers) {
  if (!answers.board) return "—";
  if (isOtherStateBoard(answers.board)) {
    return answers.boardCustom.trim() || TRIAL_OTHER_STATE_BOARD;
  }
  return answers.board;
}
