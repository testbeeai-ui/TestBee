import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG,
  liveClassDeliveryRdmConfigFromRows,
  TEACHER_LIVE_CLASS_DELIVERY_RDM_KEYS,
  type LiveClassDeliveryRdmConfig,
} from "@/lib/teacherPortal/liveClassDeliveryRdm";
import {
  TEACHER_LIVE_CLASS_QUALITY_BONUS_KEY,
  TEACHER_LIVE_CLASS_QUALITY_MIN_AVG_X10_KEY,
  TEACHER_LIVE_CLASS_QUALITY_MIN_RATINGS_KEY,
  TEACHER_LIVE_CLASS_QUALITY_MIN_COVERAGE_PCT_KEY,
  TEACHER_LIVE_CLASS_QUALITY_SMOOTHING_M_KEY,
  TEACHER_LIVE_CLASS_QUALITY_PRIOR_AVG_X10_KEY,
  TEACHER_LIVE_CLASS_QUALITY_WINDOW_HOURS_KEY,
  TEACHER_LIVE_CLASS_QUALITY_MONTHLY_CAP_KEY,
  TEACHER_LIVE_CLASS_QUALITY_RDM_KEYS,
} from "@/lib/teacherPortal/liveClassQualityRdm";
import { TEACHER_PLAN_CONFIG_KEYS } from "@/lib/teacherPortal/teacherPlan";

export type TeacherRdmChargeAction =
  | "create_classroom"
  | "create_section"
  | "create_assignment"
  | "schedule_session"
  | "generate_test";

/** rdm_config keys for teacher portal charges (deduct on action). */
export const TEACHER_RDM_CHARGE_CONFIG_KEYS: Record<TeacherRdmChargeAction, string> = {
  create_classroom: "teacher_create_classroom_rdm",
  create_section: "teacher_create_section_rdm",
  create_assignment: "teacher_create_assignment_rdm",
  schedule_session: "teacher_schedule_session_rdm",
  generate_test: "teacher_generate_test_rdm",
};

export const TEACHER_GYAN_REWARD_CONFIG_KEY = "gyan_teacher_answer_rdm";

export type TeacherRdmCosts = Record<TeacherRdmChargeAction, number> & {
  gyan_teacher_answer: number;
};

export const DEFAULT_TEACHER_RDM_COSTS: TeacherRdmCosts = {
  create_classroom: 30,
  create_section: 30,
  create_assignment: 10,
  schedule_session: 30,
  generate_test: 30,
  gyan_teacher_answer: 5,
};

const ALL_TEACHER_RDM_CONFIG_KEYS = [
  ...Object.values(TEACHER_RDM_CHARGE_CONFIG_KEYS),
  TEACHER_GYAN_REWARD_CONFIG_KEY,
  ...TEACHER_LIVE_CLASS_DELIVERY_RDM_KEYS,
  ...TEACHER_LIVE_CLASS_QUALITY_RDM_KEYS,
] as const;

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

function clampTeacherRdmAmount(raw: number | null | undefined, fallback: number): number {
  const n = typeof raw === "number" ? Math.round(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(500, n));
}

export function teacherRdmCostsFromRows(
  rows: Array<{ key: string; value: number | null }>
): TeacherRdmCosts {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_TEACHER_RDM_COSTS };
  for (const action of Object.keys(TEACHER_RDM_CHARGE_CONFIG_KEYS) as TeacherRdmChargeAction[]) {
    const configKey = TEACHER_RDM_CHARGE_CONFIG_KEYS[action];
    out[action] = clampTeacherRdmAmount(byKey.get(configKey), DEFAULT_TEACHER_RDM_COSTS[action]);
  }
  out.gyan_teacher_answer = clampTeacherRdmAmount(
    byKey.get(TEACHER_GYAN_REWARD_CONFIG_KEY),
    DEFAULT_TEACHER_RDM_COSTS.gyan_teacher_answer
  );
  return out;
}

/**
 * `rdm_config` is admin-edited global config. Cache the parsed teacher configs briefly so the
 * teacher bundle load + the /api/teacher/rdm/costs focus-refresh don't re-read the table on every
 * call at scale. Admin edits propagate within the TTL; errors fall back to defaults uncached.
 */
const TEACHER_RDM_CONFIG_CACHE_TTL_MS = 60_000;
let deliveryConfigCache: { value: LiveClassDeliveryRdmConfig; expiresAt: number } | null = null;
let teacherCostsCache: { value: TeacherRdmCosts; expiresAt: number } | null = null;

export async function fetchLiveClassDeliveryRdmConfig(
  client?: unknown
): Promise<LiveClassDeliveryRdmConfig> {
  if (deliveryConfigCache && deliveryConfigCache.expiresAt > Date.now()) {
    return deliveryConfigCache.value;
  }
  const db = (client ?? supabase) as RdmConfigClient;
  try {
    const { data, error } = await db
      .from("rdm_config")
      .select("key, value")
      .in("key", [...TEACHER_LIVE_CLASS_DELIVERY_RDM_KEYS]);
    if (error || !data?.length) return DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG;
    const value = liveClassDeliveryRdmConfigFromRows(
      data as Array<{ key: string; value: number | null }>
    );
    deliveryConfigCache = { value, expiresAt: Date.now() + TEACHER_RDM_CONFIG_CACHE_TTL_MS };
    return value;
  } catch {
    return DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG;
  }
}

export async function fetchTeacherRdmCosts(client?: unknown): Promise<TeacherRdmCosts> {
  if (teacherCostsCache && teacherCostsCache.expiresAt > Date.now()) {
    return teacherCostsCache.value;
  }
  const db = (client ?? supabase) as RdmConfigClient;
  try {
    const { data, error } = await db
      .from("rdm_config")
      .select("key, value")
      .in("key", [...ALL_TEACHER_RDM_CONFIG_KEYS]);
    if (error || !data?.length) return DEFAULT_TEACHER_RDM_COSTS;
    const value = teacherRdmCostsFromRows(data as Array<{ key: string; value: number | null }>);
    teacherCostsCache = { value, expiresAt: Date.now() + TEACHER_RDM_CONFIG_CACHE_TTL_MS };
    return value;
  } catch {
    return DEFAULT_TEACHER_RDM_COSTS;
  }
}

export function getChargeAmountForAction(
  costs: TeacherRdmCosts,
  action: TeacherRdmChargeAction
): number {
  return costs[action];
}

/** rdm_config keys for teacher growth rewards (referrals + bulk invite). */
export const TEACHER_REFERRAL_REWARD_CONFIG_KEYS = [
  "referral_teacher_signup_reward",
  "referral_teacher_student_signup_reward",
  "referral_teacher_paid_bonus",
  "referral_teacher_paid_window_days",
] as const;

export const TEACHER_BULK_INVITE_REWARD_CONFIG_KEYS = [
  "classroom_bulk_invite_flat_rdm",
  "classroom_bulk_invite_min_students",
  "classroom_batch_paid_bonus_rdm",
  "classroom_batch_paid_window_days",
] as const;

/** Admin UI metadata for the Teachers RDM section. `unit` defaults to RDM. */
export const TEACHER_RDM_ADMIN_META: Record<
  string,
  {
    title: string;
    kind: "charge" | "reward";
    teacherSurface: string;
    serverPath?: string;
    unit?: string;
    summary: string;
  }
> = {
  referral_teacher_signup_reward: {
    title: "Teacher referral · referred teacher signup",
    kind: "reward",
    summary: "Credits a teacher when another teacher joins via that teacher's referral link.",
    teacherSurface: "Refer & Earn · teacher referral (colleague signup)",
    serverPath: "claim_referral_attribution (teacher→teacher)",
  },
  referral_teacher_student_signup_reward: {
    title: "Student referral · referred student signup (teacher link)",
    kind: "reward",
    summary: "Credits a teacher when a student joins via that teacher's referral link.",
    teacherSurface: "Refer & Earn · student referral section",
    serverPath: "claim_referral_attribution (teacher→student)",
  },
  referral_teacher_paid_bonus: {
    title: "Referral · referred user goes paid bonus",
    kind: "reward",
    summary: "Second bonus when a referred teacher or student converts to paid within the window.",
    teacherSurface: "Awarded when a referred teacher or student subscribes (Razorpay)",
    serverPath: "award_teacher_referral_paid_bonus",
  },
  referral_teacher_paid_window_days: {
    title: "Referral · paid-bonus window",
    kind: "reward",
    unit: "days",
    summary: "How long after referral credit the referred user has to go paid for the bonus.",
    teacherSurface: "Days after referral in which they must go paid",
    serverPath: "award_teacher_referral_paid_bonus (window)",
  },
  classroom_bulk_invite_flat_rdm: {
    title: "Bulk invite · flat batch reward (first qualifying batch per classroom)",
    kind: "reward",
    summary: "Rewards a teacher for importing a real class batch instead of inviting one student at a time.",
    teacherSurface: "My Classroom · bulk invite students",
    serverPath: "create_classroom_bulk_invite (flat reward)",
  },
  classroom_bulk_invite_min_students: {
    title: "Bulk invite · minimum students for flat reward",
    kind: "reward",
    unit: "students",
    summary: "Sets the minimum batch size required before the teacher earns the bulk-invite reward.",
    teacherSurface: "Gate for the flat bulk-invite reward",
    serverPath: "create_classroom_bulk_invite (min batch size)",
  },
  classroom_batch_paid_bonus_rdm: {
    title: "Bulk invite · per-student paid bonus",
    kind: "reward",
    summary: "Credits the teacher for every invited student who turns into a paid subscriber.",
    teacherSurface: "Per invited student who subscribes within the window",
    serverPath: "award_classroom_batch_paid_bonus",
  },
  classroom_batch_paid_window_days: {
    title: "Bulk invite · per-student paid window",
    kind: "reward",
    unit: "days",
    summary: "Controls the conversion window for paid bonuses after a bulk classroom invite.",
    teacherSurface: "Days after invite in which a student must go paid",
    serverPath: "award_classroom_batch_paid_bonus (window)",
  },
  teacher_create_classroom_rdm: {
    title: "Create classroom",
    kind: "charge",
    summary: "Charges a teacher a small wallet amount to create a classroom and reduce spam creation.",
    teacherSurface: "My Classroom · Create / Launch classroom",
    serverPath: "POST /api/teacher/rdm/charge (create_classroom)",
  },
  teacher_create_section_rdm: {
    title: "Create section (per section, max 6 per class)",
    kind: "charge",
    summary: "Charges when a teacher adds a batch or section under a classroom.",
    teacherSurface: "My Classroom · Add section",
    serverPath: "POST /api/teacher/rdm/charge (create_section)",
  },
  teacher_create_assignment_rdm: {
    title: "Publish assignment",
    kind: "charge",
    summary: "Charges Free and Starter teachers on each assignment publish; Pro plan waives this fee (unlimited publishes).",
    teacherSurface: "Task wizard · Create assignment · Publish",
    serverPath: "POST /api/teacher/rdm/charge (create_assignment; skipped for Pro)",
  },
  teacher_schedule_session_rdm: {
    title: "Schedule live lesson / webinar",
    kind: "charge",
    summary: "Charges for scheduling a live teaching session that uses calendar and meeting infrastructure.",
    teacherSurface: "My lessons · Schedule class",
    serverPath: "POST /api/teacher/rdm/charge (schedule_session)",
  },
  teacher_generate_test_rdm: {
    title: "Generate new MCQ test (first time only)",
    kind: "charge",
    summary: "Charges only when a teacher generates a fresh test; reusing history stays free.",
    teacherSurface: "Create Tests · Generate Test Now (history reprints are free)",
    serverPath: "POST /api/teacher/rdm/charge (generate_test)",
  },
  [TEACHER_GYAN_REWARD_CONFIG_KEY]: {
    title: "Gyan++ wall · Teacher section / comment",
    kind: "reward",
    summary: "Rewards verified teacher knowledge contributions that help students inside Gyan++.",
    teacherSurface: "Gyan++ Wall · Post Teacher Section",
    serverPath: "doubt_answer_daily_rdm_trigger (IST daily COMMENT milestone)",
  },
  teacher_live_class_base_rdm: {
    title: "Section schedule class · base (per conducted occurrence)",
    kind: "reward",
    summary: "Pays a base reward each time a scheduled live class is actually delivered.",
    teacherSurface: "My Classroom · section Google Calendar schedule",
    serverPath: "POST /api/teacher/section-schedule/award-delivery-rdm",
  },
  teacher_live_class_per_student_rdm: {
    title: "Section schedule class · per enrolled student (roster, not attendance)",
    kind: "reward",
    summary: "Adds a roster-based bonus so larger real classes reward the teacher more.",
    teacherSurface: "Section roster bonus after each scheduled class ends",
    serverPath: "award_teacher_section_schedule_occurrence_rdm (per-student component)",
  },
  teacher_live_class_student_cap: {
    title: "Section schedule class · student bonus cap",
    kind: "reward",
    summary: "Caps counted students per class to protect the RDM economy from artificial inflation.",
    teacherSurface: "Limits per-student bonus (not a direct credit)",
    serverPath: "award_teacher_section_schedule_occurrence_rdm (cap on counted students)",
  },
  [TEACHER_LIVE_CLASS_QUALITY_BONUS_KEY]: {
    title: "Live class quality bonus (credit-only) · flat reward when class clears the rating bar",
    kind: "reward",
    summary: "Pays an extra quality bonus when student ratings prove the class was strong.",
    teacherSurface: "After ratings window closes on a section schedule class",
    serverPath: "award_teacher_section_schedule_quality_rdm (credit, never debit)",
  },
  [TEACHER_LIVE_CLASS_QUALITY_MIN_AVG_X10_KEY]: {
    title: "Live class quality · score threshold ×10 (45 = 4.5★)",
    kind: "reward",
    summary: "Sets the rating score required before a class earns the quality bonus.",
    teacherSurface: "Gate, not a direct credit",
    serverPath: "award_teacher_section_schedule_quality_rdm (Bayesian score gate)",
  },
  [TEACHER_LIVE_CLASS_QUALITY_MIN_RATINGS_KEY]: {
    title: "Live class quality · minimum raters (absolute floor)",
    kind: "reward",
    summary: "Requires enough student ratings before the platform trusts a class quality score.",
    teacherSurface: "Quorum gate, not a direct credit",
    serverPath: "award_teacher_section_schedule_quality_rdm (quorum)",
  },
  [TEACHER_LIVE_CLASS_QUALITY_MIN_COVERAGE_PCT_KEY]: {
    title: "Live class quality · minimum roster coverage % that must rate",
    kind: "reward",
    summary: "Requires a fair share of the class roster to rate before quality rewards are paid.",
    teacherSurface: "Quorum gate, not a direct credit",
    serverPath: "award_teacher_section_schedule_quality_rdm (quorum)",
  },
  [TEACHER_LIVE_CLASS_QUALITY_SMOOTHING_M_KEY]: {
    title: "Live class quality · Bayesian smoothing weight m (higher = stricter on small samples)",
    kind: "reward",
    summary: "Makes small rating samples stricter so one or two ratings cannot game the bonus.",
    teacherSurface: "Score smoothing, not a direct credit",
    serverPath: "award_teacher_section_schedule_quality_rdm (shrinkage)",
  },
  [TEACHER_LIVE_CLASS_QUALITY_PRIOR_AVG_X10_KEY]: {
    title: "Live class quality · Bayesian prior average ×10 (40 = 4.0★)",
    kind: "reward",
    summary: "Sets the baseline rating used by the smoothing model for low-sample classes.",
    teacherSurface: "Score smoothing, not a direct credit",
    serverPath: "award_teacher_section_schedule_quality_rdm (shrinkage prior)",
  },
  [TEACHER_LIVE_CLASS_QUALITY_WINDOW_HOURS_KEY]: {
    title: "Live class quality · rating window (hours after class end)",
    kind: "reward",
    summary: "Controls how long students can rate after class before the quality decision closes.",
    teacherSurface: "Rating window, not a direct credit",
    serverPath: "submit_live_class_rating / award (window)",
  },
  [TEACHER_LIVE_CLASS_QUALITY_MONTHLY_CAP_KEY]: {
    title: "Live class quality · max bonuses per teacher per month (economy guard)",
    kind: "reward",
    summary: "Limits monthly quality payouts per teacher so rewards stay sustainable.",
    teacherSurface: "Cap, not a direct credit",
    serverPath: "award_teacher_section_schedule_quality_rdm (monthly cap)",
  },
  teacher_free_live_classes_per_month: {
    title: "Teacher plan · Free live classes per month",
    kind: "reward",
    summary: "Controls how many live classes a free teacher can book each month.",
    teacherSurface: "Subscriptions → live class booking cap",
    serverPath: "live_class_slots quota (Free tier)",
  },
  teacher_starter_live_classes_per_month: {
    title: "Teacher plan · Starter live classes per month",
    kind: "reward",
    summary: "Controls the monthly live-class quota included with the Starter teacher plan.",
    teacherSurface: "Subscriptions → live class booking cap",
    serverPath: "live_class_slots quota (Starter)",
  },
  teacher_pro_live_classes_per_month: {
    title: "Teacher plan · Pro live classes per month",
    kind: "reward",
    summary: "Controls the monthly live-class quota included with the Pro teacher plan.",
    teacherSurface: "Subscriptions → live class booking cap",
    serverPath: "live_class_slots quota (Pro)",
  },
  teacher_free_assignments_per_month: {
    title: "Teacher plan · Free assignments per month",
    kind: "reward",
    summary: "Monthly assignment publish quota for free teachers; each publish also deducts teacher_create_assignment_rdm.",
    teacherSurface: "Assignment publish gate (Free tier)",
    serverPath: "create_assignment quota (Free)",
  },
  teacher_starter_assignments_per_month: {
    title: "Teacher plan · Starter assignments per month (9999 = unlimited)",
    kind: "reward",
    summary: "Starter has no monthly assignment cap (9999 = unlimited); each publish still deducts teacher_create_assignment_rdm.",
    teacherSurface: "Assignment publish gate (Starter — quota only; charge is separate)",
    serverPath: "create_assignment quota (Starter)",
  },
  teacher_pro_assignments_per_month: {
    title: "Teacher plan · Pro assignments per month (9999 = unlimited)",
    kind: "reward",
    summary: "Pro has unlimited assignment publishes with no teacher_create_assignment_rdm charge.",
    teacherSurface: "Assignment publish gate",
    serverPath: "create_assignment quota (Pro)",
  },
  teacher_class_students_cap: {
    title: "Teacher plan · max students per class",
    kind: "reward",
    summary: "Limits classroom size for join approvals and bulk invites to keep class quality manageable.",
    teacherSurface: "Join approval & bulk invite gate",
    serverPath: "classroom_members cap",
  },
};

/** Teacher growth rewards (referrals + bulk invite) — surfaced in the Teachers admin section. */
export const TEACHER_RDM_ADMIN_GROWTH_KEYS = [
  ...TEACHER_REFERRAL_REWARD_CONFIG_KEYS,
  ...TEACHER_BULK_INVITE_REWARD_CONFIG_KEYS,
] as const;

export const TEACHER_RDM_ADMIN_CHARGE_KEYS = Object.values(TEACHER_RDM_CHARGE_CONFIG_KEYS);
export const TEACHER_RDM_ADMIN_REWARD_KEYS = [
  TEACHER_GYAN_REWARD_CONFIG_KEY,
  ...TEACHER_LIVE_CLASS_DELIVERY_RDM_KEYS,
  ...TEACHER_LIVE_CLASS_QUALITY_RDM_KEYS,
  ...TEACHER_PLAN_CONFIG_KEYS,
] as const;
