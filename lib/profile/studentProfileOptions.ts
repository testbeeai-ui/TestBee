/** Dropdown options for student profile hub (aligned with product references). */

export const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-binary / other",
  "Prefer not to say",
] as const;

export const CATEGORY_OPTIONS = ["General", "OBC", "SC", "ST", "EWS"] as const;

export const BOARD_OPTIONS = [
  "Karnataka State Board (PUC)",
  "CBSE",
  "ICSE",
  "IB",
  "State Board — Other",
] as const;

export const CLASS_YEAR_OPTIONS = ["PUC I", "PUC II", "Class X", "Class 11", "Class 12"] as const;

export const STREAM_OPTIONS = [
  "PCM (Physics, Chemistry, Maths)",
  "PCMB",
  "PCB",
  "Commerce",
  "Arts / Humanities",
] as const;

export type GenderOption = (typeof GENDER_OPTIONS)[number];
export type CategoryOption = (typeof CATEGORY_OPTIONS)[number];
export type BoardOption = (typeof BOARD_OPTIONS)[number];
export type ClassYearOption = (typeof CLASS_YEAR_OPTIONS)[number];
export type StreamOption = (typeof STREAM_OPTIONS)[number];

/** Map institution class label to numeric class_level for app features (explore, etc.). */
export function classLabelToLevel(label: string | null | undefined): number | null {
  if (!label) return null;
  const map: Record<string, number> = {
    "Class X": 10,
    "PUC I": 11,
    "Class 11": 11,
    "PUC II": 12,
    "Class 12": 12,
  };
  return map[label] ?? null;
}

/** Derive subject_combo + stream column from stream dropdown. */
export function streamSelectionToProfileFields(streamLabel: string): {
  stream: string;
  subject_combo: string | null;
} {
  switch (streamLabel) {
    case "PCM (Physics, Chemistry, Maths)":
      return { stream: streamLabel, subject_combo: "PCM" };
    case "PCMB":
      return { stream: streamLabel, subject_combo: "PCMB" };
    case "PCB":
      return { stream: streamLabel, subject_combo: "PCB" };
    case "Commerce":
      return { stream: streamLabel, subject_combo: "Commerce" };
    case "Arts / Humanities":
      return { stream: streamLabel, subject_combo: "Arts" };
    default:
      return { stream: streamLabel, subject_combo: null };
  }
}

export function toSelectItems<T extends string>(
  options: readonly T[]
): { label: string; value: string }[] {
  return options.map((o) => ({ label: o, value: o }));
}
