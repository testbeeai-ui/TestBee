export const TEACHER_LIVE_CLASS_BASE_RDM_KEY = "teacher_live_class_base_rdm";
export const TEACHER_LIVE_CLASS_PER_STUDENT_RDM_KEY = "teacher_live_class_per_student_rdm";
export const TEACHER_LIVE_CLASS_STUDENT_CAP_KEY = "teacher_live_class_student_cap";

export const TEACHER_LIVE_CLASS_DELIVERY_RDM_KEYS = [
  TEACHER_LIVE_CLASS_BASE_RDM_KEY,
  TEACHER_LIVE_CLASS_PER_STUDENT_RDM_KEY,
  TEACHER_LIVE_CLASS_STUDENT_CAP_KEY,
] as const;

export type LiveClassDeliveryRdmConfig = {
  baseRdm: number;
  perStudentRdm: number;
  studentCap: number;
};

export const DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG: LiveClassDeliveryRdmConfig = {
  baseRdm: 100,
  perStudentRdm: 10,
  studentCap: 50,
};

function clampNonNegativeInt(raw: number | null | undefined, fallback: number, max = 10_000): number {
  const n = typeof raw === "number" ? Math.round(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, n));
}

export function liveClassDeliveryRdmConfigFromRows(
  rows: Array<{ key: string; value: number | null }>
): LiveClassDeliveryRdmConfig {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    baseRdm: clampNonNegativeInt(byKey.get(TEACHER_LIVE_CLASS_BASE_RDM_KEY), 100, 500),
    perStudentRdm: clampNonNegativeInt(byKey.get(TEACHER_LIVE_CLASS_PER_STUDENT_RDM_KEY), 10, 500),
    studentCap: clampNonNegativeInt(byKey.get(TEACHER_LIVE_CLASS_STUDENT_CAP_KEY), 50, 500),
  };
}

/** base + min(students, cap) × perStudent */
export function computeLiveClassDeliveryRdm(
  studentCount: number,
  config: LiveClassDeliveryRdmConfig = DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG
): {
  studentCount: number;
  cappedStudentCount: number;
  baseRdm: number;
  perStudentRdm: number;
  studentBonusRdm: number;
  totalRdm: number;
} {
  const safeCount = Math.max(0, Math.floor(studentCount));
  const cappedStudentCount = Math.min(safeCount, config.studentCap);
  const studentBonusRdm = cappedStudentCount * config.perStudentRdm;
  const totalRdm = config.baseRdm + studentBonusRdm;
  return {
    studentCount: safeCount,
    cappedStudentCount,
    baseRdm: config.baseRdm,
    perStudentRdm: config.perStudentRdm,
    studentBonusRdm,
    totalRdm,
  };
}

export function formatLiveClassDeliveryRdmBreakdown(
  breakdown: ReturnType<typeof computeLiveClassDeliveryRdm>
): string {
  if (breakdown.cappedStudentCount < breakdown.studentCount) {
    return `${breakdown.baseRdm} + (${breakdown.cappedStudentCount} × ${breakdown.perStudentRdm}) = ${breakdown.totalRdm} RDM (cap ${breakdown.cappedStudentCount} students)`;
  }
  if (breakdown.cappedStudentCount > 0) {
    return `${breakdown.baseRdm} + (${breakdown.cappedStudentCount} × ${breakdown.perStudentRdm}) = ${breakdown.totalRdm} RDM`;
  }
  return `${breakdown.baseRdm} RDM`;
}

export function formatLiveClassScheduleEarningLabel(
  breakdown: ReturnType<typeof computeLiveClassDeliveryRdm>
): string {
  const { totalRdm, baseRdm, cappedStudentCount, perStudentRdm } = breakdown;
  if (totalRdm <= 0) return "No delivery RDM for this lesson";
  if (cappedStudentCount > 0) {
    return `+${baseRdm} + ${cappedStudentCount}×${perStudentRdm} = +${totalRdm} RDM when you schedule`;
  }
  return `+${totalRdm} RDM when you schedule`;
}

export function formatLiveClassScheduleButtonLabel(totalRdm: number): string {
  if (totalRdm <= 0) return "Schedule lesson";
  return `Schedule (+${totalRdm} RDM)`;
}

export function formatSectionScheduleDeliveryRdmLabel(input: {
  expectedDeliveryRdm?: number;
  deliveryRdmGrantedTotal?: number;
  hasSchedule?: boolean;
}): string | null {
  if (!input.hasSchedule) return null;
  const expected = Math.max(0, input.expectedDeliveryRdm ?? 0);
  const earned = Math.max(0, input.deliveryRdmGrantedTotal ?? 0);
  if (earned > 0 && expected > 0) {
    return `+${earned} RDM earned · up to +${expected} per class`;
  }
  if (earned > 0) return `+${earned} RDM earned from schedule`;
  if (expected > 0) return `Up to +${expected} RDM per scheduled class`;
  return null;
}

export type LiveClassDeliveryAwardResult = {
  ok?: boolean;
  error?: string;
  already_awarded?: boolean;
  /** Path A: section schedule occurrence (Google Calendar / section recurring). */
  section_id?: string;
  occurrence_at?: string;
  source?: "section_schedule";
  /** Legacy Path B session id — no longer eligible for new grants. */
  session_id?: string;
  title?: string;
  total_rdm?: number;
  base_rdm?: number;
  student_bonus_rdm?: number;
  student_count?: number;
  capped_student_count?: number;
  per_student_rdm?: number;
  balance?: number;
  awarded_by?: string;
};

export type LiveClassDeliveryBatchAwardResult = {
  ok?: boolean;
  error?: string;
  awarded_count?: number;
  awards?: LiveClassDeliveryAwardResult[];
};
