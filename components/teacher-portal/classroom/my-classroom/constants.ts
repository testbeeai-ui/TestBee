export const SUBJECT_OPTIONS = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Physics + Maths",
  "Full PCM",
] as const;
export const PUC_OPTIONS = ["PUC 1", "PUC 2", "Both"] as const;
export const EXAM_OPTIONS = [
  "JEE Advanced",
  "JEE Main",
  "KCET",
  "CBSE Board",
  "State Board",
] as const;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const SHOW_CLASSROOM_SCHEDULE_FORM = false;

export type DetailTab = "students" | "assignments" | "progress" | "streaks" | "settings";
export type MotivationMessageType = "streak_reengagement" | "top_performer" | "custom";
export type MotivationTarget = string;
