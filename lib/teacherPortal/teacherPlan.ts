import { supabase } from "@/integrations/supabase/client";

import { wallClockInTimeZoneToUtc } from "@/lib/datetime/wallClockInTimeZone";

export type TeacherPlanKey = "free" | "starter" | "pro";

export type TeacherPlanLimits = {
  liveClassesPerMonth: number;
  assignmentsPerMonth: number;
  studentsPerClass: number;
  performanceDashboard: boolean;
  publicDirectoryListing: boolean;
  priorityDirectoryListing: boolean;
  verifiedGyanBadge: boolean;
  assignmentAnalytics: boolean;
};

export type TeacherPlanConfig = Record<string, number>;

export const TEACHER_PLAN_PRICING_INR = {
  starter: 999,
  pro: 1999,
} as const;

/** Values at or above this cap are treated as unlimited live classes (Pro). */
export const TEACHER_LIVE_CLASSES_UNLIMITED_CAP = 9999;

export const TEACHER_PLAN_CONFIG_DEFAULTS: TeacherPlanConfig = {
  teacher_free_live_classes_per_month: 24,
  teacher_starter_live_classes_per_month: 60,
  teacher_pro_live_classes_per_month: TEACHER_LIVE_CLASSES_UNLIMITED_CAP,
  teacher_free_assignments_per_month: 10,
  teacher_starter_assignments_per_month: 9999,
  teacher_pro_assignments_per_month: 9999,
  teacher_class_students_cap: 30,
};

export const TEACHER_PLAN_CONFIG_KEYS = Object.keys(
  TEACHER_PLAN_CONFIG_DEFAULTS
) as (keyof typeof TEACHER_PLAN_CONFIG_DEFAULTS)[];

export type TeacherPlanProfileFields = {
  teacher_plan_tier?: string | null;
  teacher_plan_started_at?: string | null;
  teacher_plan_expires_at?: string | null;
  time_travel_offset_ms?: number | null;
};

export type TeacherPlanTierMeta = {
  id: TeacherPlanKey;
  name: string;
  tagline: string;
  priceInr: number | null;
  features: string[];
};

export const TEACHER_PLAN_TIERS: TeacherPlanTierMeta[] = [
  {
    id: "free",
    name: "Grassroots (Free)",
    tagline: "Viral acquisition — post on Gyan++, invite students, earn RDM.",
    priceInr: null,
    features: [
      "Basic teacher profile",
      "Gyan++ Teacher Section posts",
      "Invite students & earn RDM",
      "Up to 10 assignments / month (RDM charge per publish)",
      "Up to 24 live classes / month (30 students each)",
    ],
  },
  {
    id: "starter",
    name: "Starter Teacher",
    tagline: "Conduct up to 60 live classes per month.",
    priceInr: TEACHER_PLAN_PRICING_INR.starter,
    features: [
      "Up to 60 live classes / month (30 students each)",
      "Unlimited assignments (RDM charged every publish)",
      "Student performance for referred students",
      "Basic public Teachers directory listing",
    ],
  },
  {
    id: "pro",
    name: "Pro Teacher",
    tagline: "Unlimited live classes and priority visibility.",
    priceInr: TEACHER_PLAN_PRICING_INR.pro,
    features: [
      "Unlimited live classes / month (30 students each)",
      "Unlimited assignments (no RDM publish fee)",
      "Priority Teachers directory listing",
      "Verified badge on Gyan++",
      "Chapter-level weak-area assignment analytics",
    ],
  },
];

type RdmConfigClient = {
  from: (table: "rdm_config") => {
    select: (columns: string) => {
      in: (
        column: string,
        values: readonly string[]
      ) => PromiseLike<{
        data: Array<{ key: string; value: number | null }> | null;
        error: unknown;
      }>;
    };
  };
};

function clampInt(raw: number | null | undefined, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? Math.round(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function teacherPlanConfigFromRows(
  rows: Array<{ key: string; value: number | null }>
): TeacherPlanConfig {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const d = TEACHER_PLAN_CONFIG_DEFAULTS;
  return {
    teacher_free_live_classes_per_month: clampInt(
      byKey.get("teacher_free_live_classes_per_month"),
      d.teacher_free_live_classes_per_month,
      0,
      1000
    ),
    teacher_starter_live_classes_per_month: clampInt(
      byKey.get("teacher_starter_live_classes_per_month"),
      d.teacher_starter_live_classes_per_month,
      0,
      1000
    ),
    teacher_pro_live_classes_per_month: clampInt(
      byKey.get("teacher_pro_live_classes_per_month"),
      d.teacher_pro_live_classes_per_month,
      0,
      TEACHER_LIVE_CLASSES_UNLIMITED_CAP
    ),
    teacher_free_assignments_per_month: clampInt(
      byKey.get("teacher_free_assignments_per_month"),
      d.teacher_free_assignments_per_month,
      0,
      10000
    ),
    teacher_starter_assignments_per_month: clampInt(
      byKey.get("teacher_starter_assignments_per_month"),
      d.teacher_starter_assignments_per_month,
      0,
      10000
    ),
    teacher_pro_assignments_per_month: clampInt(
      byKey.get("teacher_pro_assignments_per_month"),
      d.teacher_pro_assignments_per_month,
      0,
      10000
    ),
    teacher_class_students_cap: clampInt(
      byKey.get("teacher_class_students_cap"),
      d.teacher_class_students_cap,
      1,
      1000
    ),
  };
}

export async function fetchTeacherPlanConfig(client?: unknown): Promise<TeacherPlanConfig> {
  const db = (client ?? supabase) as RdmConfigClient;
  try {
    const { data, error } = await db
      .from("rdm_config")
      .select("key, value")
      .in("key", [...TEACHER_PLAN_CONFIG_KEYS]);
    if (error || !data?.length) return { ...TEACHER_PLAN_CONFIG_DEFAULTS };
    return teacherPlanConfigFromRows(data);
  } catch {
    return { ...TEACHER_PLAN_CONFIG_DEFAULTS };
  }
}

export function normalizeTeacherPlanTier(
  raw: string | null | undefined,
  profile?: TeacherPlanProfileFields | null
): TeacherPlanKey {
  const normalized = String(raw ?? "free").trim().toLowerCase();
  if (normalized !== "starter" && normalized !== "pro") return "free";

  const expiresAt = profile?.teacher_plan_expires_at;
  if (!expiresAt) return "free";

  const nowMs = Date.now() + (profile?.time_travel_offset_ms ?? 0);
  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs) || nowMs >= expiryMs) return "free";

  return normalized;
}

export function getTeacherPlanLimits(
  cfg: TeacherPlanConfig,
  tier: TeacherPlanKey
): TeacherPlanLimits {
  switch (tier) {
    case "starter":
      return {
        liveClassesPerMonth: cfg.teacher_starter_live_classes_per_month,
        assignmentsPerMonth: cfg.teacher_starter_assignments_per_month,
        studentsPerClass: cfg.teacher_class_students_cap,
        performanceDashboard: true,
        publicDirectoryListing: true,
        priorityDirectoryListing: false,
        verifiedGyanBadge: false,
        assignmentAnalytics: false,
      };
    case "pro":
      return {
        liveClassesPerMonth: cfg.teacher_pro_live_classes_per_month,
        assignmentsPerMonth: cfg.teacher_pro_assignments_per_month,
        studentsPerClass: cfg.teacher_class_students_cap,
        performanceDashboard: true,
        publicDirectoryListing: true,
        priorityDirectoryListing: true,
        verifiedGyanBadge: true,
        assignmentAnalytics: true,
      };
    case "free":
    default:
      return {
        liveClassesPerMonth: cfg.teacher_free_live_classes_per_month,
        assignmentsPerMonth: cfg.teacher_free_assignments_per_month,
        studentsPerClass: cfg.teacher_class_students_cap,
        performanceDashboard: false,
        publicDirectoryListing: false,
        priorityDirectoryListing: false,
        verifiedGyanBadge: false,
        assignmentAnalytics: false,
      };
  }
}

/** IST calendar month bounds for quota counting (as UTC instants). */
export function istMonthBoundsForDate(date: Date): { start: Date; end: Date } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const pad = (n: number) => String(n).padStart(2, "0");

  const start = wallClockInTimeZoneToUtc(`${year}-${pad(month)}-01`, "00:00", "Asia/Kolkata");

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = wallClockInTimeZoneToUtc(
    `${nextYear}-${pad(nextMonth)}-01`,
    "00:00",
    "Asia/Kolkata"
  );

  return { start, end };
}

export function isUnlimitedLiveClassesCap(cap: number): boolean {
  return cap >= TEACHER_LIVE_CLASSES_UNLIMITED_CAP;
}

export function formatTeacherLiveClassQuotaLabel(quota: {
  remaining: number;
  cap: number;
}): string {
  if (isUnlimitedLiveClassesCap(quota.cap)) {
    return "Unlimited live classes this month";
  }
  return `${quota.remaining}/${quota.cap} left this month`;
}

export function liveClassQuotaExceededMessage(tier: TeacherPlanKey, cap: number): string {
  if (tier === "free") {
    return `You've used all ${cap} free live classes this month. Upgrade to Starter (60/month) or Pro (unlimited).`;
  }
  if (tier === "starter") {
    return `You've used all ${cap} live classes this month. Upgrade to Pro for unlimited live classes.`;
  }
  return "Monthly live class limit reached.";
}

export function canBookMoreLiveClasses(
  bookedThisMonth: number,
  limits: TeacherPlanLimits
): { allowed: boolean; remaining: number; cap: number } {
  const cap = limits.liveClassesPerMonth;
  if (isUnlimitedLiveClassesCap(cap)) {
    return { allowed: true, remaining: TEACHER_LIVE_CLASSES_UNLIMITED_CAP, cap };
  }
  const remaining = Math.max(0, cap - bookedThisMonth);
  return { allowed: bookedThisMonth < cap, remaining, cap };
}

export function canCreateMoreAssignments(
  createdThisMonth: number,
  limits: TeacherPlanLimits
): { allowed: boolean; remaining: number; cap: number } {
  const cap = limits.assignmentsPerMonth;
  if (cap >= 9999) {
    return { allowed: true, remaining: 9999, cap };
  }
  const remaining = Math.max(0, cap - createdThisMonth);
  return { allowed: createdThisMonth < cap, remaining, cap };
}

export function assignmentQuotaExceededMessage(tier: TeacherPlanKey, cap: number): string {
  if (tier === "free") {
    return `You've used all ${cap} free assignments this month. Upgrade to Starter for unlimited assignments (RDM charged each publish).`;
  }
  if (tier === "starter") {
    return "Monthly assignment limit reached. Contact support or upgrade your plan.";
  }
  return "Monthly assignment limit reached.";
}

export function teacherAssignmentPublishChargeWaived(tier: TeacherPlanKey): boolean {
  return tier === "pro";
}

export function teacherPlanDisplayName(tier: TeacherPlanKey): string {
  return TEACHER_PLAN_TIERS.find((t) => t.id === tier)?.name ?? "Grassroots (Free)";
}

/** Recurring Google Calendar series (RRULE) — paid teacher plans only. */
export function canUseGoogleCalendarSeries(tier: TeacherPlanKey): boolean {
  return tier === "starter" || tier === "pro";
}

export type WizardSectionScheduleFields = {
  scheduleDate?: string;
  scheduleTime?: string;
  repeatDays?: string[] | null;
};

export function wizardSectionHasCalendarSync(draft: WizardSectionScheduleFields): boolean {
  return Boolean(
    draft.scheduleDate?.trim() &&
      draft.scheduleTime?.trim() &&
      Array.isArray(draft.repeatDays) &&
      draft.repeatDays.length > 0
  );
}
