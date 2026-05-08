import type { Profile } from "@/hooks/useAuth";
import type { AcademicRecordExtrasShape } from "@/lib/profile/academicRecordExtras";

type AcademicRowLite = {
  exam: string;
  board: string | null;
  score: string | null;
  academic_year: string | null;
  marksheet_path: string | null;
};

type AchievementRowLite = {
  name: string | null;
  level: string | null;
  year: number | null;
  result: string | null;
  marksheet_path: string | null;
};

export type CompletionBreakdown = {
  personal: number;
  academic: number;
  achievements: number;
  activity: number;
};

export type ProfileCompletionInput = {
  profile: Profile;
  academics: AcademicRowLite[];
  academicExtras: AcademicRecordExtrasShape;
  achievements: AchievementRowLite[];
  attendance: {
    classroomsJoined: number;
    assignmentTasksDone: number;
    dailyDoseDualStreak: number;
    mocksAttempted: number;
    instacueDwellEventsThisWeek: number;
    studyMsTotal: number;
  } | null;
};

function hasText(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function academicRowForSlot(rows: AcademicRowLite[], slot: "class_x" | "puc_i" | "puc_ii"): AcademicRowLite | null {
  const examIncludes = (exam: string, keyword: string) => exam.toLowerCase().includes(keyword);
  for (const row of rows) {
    const exam = row.exam.toLowerCase();
    if (slot === "class_x" && (examIncludes(exam, "class x") || examIncludes(exam, "class 10"))) return row;
    if (slot === "puc_i" && (examIncludes(exam, "puc i") || examIncludes(exam, "class xi") || examIncludes(exam, "class 11")))
      return row;
    if (
      slot === "puc_ii" &&
      (examIncludes(exam, "puc ii") || examIncludes(exam, "class xii") || examIncludes(exam, "class 12"))
    )
      return row;
  }
  return null;
}

function personalCompletionPct(profile: Profile): number {
  const checks = [
    hasText(profile.first_name),
    hasText(profile.last_name),
    hasText(profile.state),
    hasText(profile.city),
    typeof profile.phone === "string" && profile.phone.replace(/\D/g, "").length === 10,
    hasText(profile.gender),
    hasText(profile.category),
    hasText(profile.institution_name),
    hasText(profile.board),
    hasText(profile.current_class_label),
    hasText(profile.stream),
  ];
  const done = checks.filter(Boolean).length;
  return clampPct((done / checks.length) * 100);
}

function academicCompletionPct(rows: AcademicRowLite[], extras: AcademicRecordExtrasShape): number {
  const classX = academicRowForSlot(rows, "class_x");
  const pucI = academicRowForSlot(rows, "puc_i");
  const pucII = academicRowForSlot(rows, "puc_ii");
  const subjects = extras.classXSubjects ?? {};
  const checks = [
    classX != null && hasText(classX.board) && hasText(classX.score) && hasText(classX.academic_year) && hasText(classX.marksheet_path),
    pucI != null && hasText(pucI.board) && hasText(pucI.score) && hasText(pucI.academic_year) && hasText(pucI.marksheet_path),
    hasText(extras.puc2InternalsPercent) || (pucII != null && hasText(pucII.score)),
    hasText(subjects.physicsScience),
    hasText(subjects.mathematics),
    hasText(subjects.chemistry),
    hasText(subjects.english),
    hasText(subjects.socialScience),
    hasText(subjects.secondLanguage),
  ];
  const done = checks.filter(Boolean).length;
  return clampPct((done / checks.length) * 100);
}

function achievementsCompletionPct(rows: AchievementRowLite[]): number {
  if (rows.length === 0) return 0;
  const completeRows = rows.filter(
    (row) =>
      hasText(row.name) &&
      hasText(row.level) &&
      Number.isFinite(row.year ?? NaN) &&
      hasText(row.result) &&
      hasText(row.marksheet_path)
  ).length;
  const targetRows = Math.min(Math.max(rows.length, 1), 3);
  return clampPct((Math.min(completeRows, targetRows) / targetRows) * 100);
}

function activityCompletionPct(input: ProfileCompletionInput["attendance"]): number {
  if (!input) return 0;
  const checks = [
    input.classroomsJoined > 0,
    input.assignmentTasksDone > 0,
    input.dailyDoseDualStreak > 0,
    input.mocksAttempted > 0,
    input.instacueDwellEventsThisWeek > 0,
    input.studyMsTotal > 0,
  ];
  const done = checks.filter(Boolean).length;
  return clampPct((done / checks.length) * 100);
}

export function computeStudentProfileCompletion(input: ProfileCompletionInput): {
  overall: number;
  sections: CompletionBreakdown;
} {
  const sections: CompletionBreakdown = {
    personal: personalCompletionPct(input.profile),
    academic: academicCompletionPct(input.academics, input.academicExtras),
    achievements: achievementsCompletionPct(input.achievements),
    activity: activityCompletionPct(input.attendance),
  };
  const overall = Math.round((sections.personal + sections.academic + sections.achievements + sections.activity) / 4);
  return { overall, sections };
}
