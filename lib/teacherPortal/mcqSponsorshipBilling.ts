import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasQuestionBankPlanAccess,
  resolvePlanTierFromProfile,
} from "@/lib/curriculum/topicQuestionBankAccess";
import {
  ADVANCED_QUIZ_BANK_SET_INDICES,
  isAdvancedQuizSetIndex,
} from "@/lib/play/quiz/advancedQuizSets";
import type { SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";
import type {
  TeacherPortalChapterQuizRef,
  TeacherPortalClassroomStudent,
} from "@/lib/teacherPortal/types";

export type McqSponsorshipAudienceSplit = {
  allStudentIds: string[];
  billableStudentIds: string[];
  premiumStudentIds: string[];
};

export type StudentPlanProfileFields = {
  plan_tier?: string | null;
  free_trial_activated?: boolean | null;
  subscription_expires_at?: string | null;
  subscription_started_at?: string | null;
  payment_card_details?: unknown;
  time_travel_offset_ms?: number | null;
};

/** Free / trial learners need teacher sponsorship for question-bank MCQ sets. */
export function studentNeedsMcqSponsorship(plan: SubscriptionPlanKey): boolean {
  return !hasQuestionBankPlanAccess(plan);
}

export function resolveStudentPlanTier(
  profile: StudentPlanProfileFields | null | undefined
): SubscriptionPlanKey {
  return resolvePlanTierFromProfile(profile);
}

export function splitStudentIdsByMcqSponsorshipNeed(
  studentIds: string[],
  planByStudentId: Map<string, SubscriptionPlanKey>
): McqSponsorshipAudienceSplit {
  const allStudentIds = [...new Set(studentIds.map((id) => id.trim()).filter(Boolean))];
  const billableStudentIds: string[] = [];
  const premiumStudentIds: string[] = [];

  for (const id of allStudentIds) {
    const plan = planByStudentId.get(id) ?? "free";
    if (studentNeedsMcqSponsorship(plan)) billableStudentIds.push(id);
    else premiumStudentIds.push(id);
  }

  return { allStudentIds, billableStudentIds, premiumStudentIds };
}

export async function splitAudienceForMcqSponsorshipBilling(
  db: SupabaseClient,
  studentIds: string[]
): Promise<McqSponsorshipAudienceSplit> {
  const uniqueIds = [...new Set(studentIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { allStudentIds: [], billableStudentIds: [], premiumStudentIds: [] };
  }

  const { data, error } = await db
    .from("profiles")
    .select(
      "id, plan_tier, free_trial_activated, subscription_expires_at, subscription_started_at, payment_card_details, time_travel_offset_ms"
    )
    .in("id", uniqueIds);
  if (error) throw new Error(error.message);

  const planByStudentId = new Map<string, SubscriptionPlanKey>(
    (data ?? []).map((row) => [row.id, resolveStudentPlanTier(row)])
  );
  return splitStudentIdsByMcqSponsorshipNeed(uniqueIds, planByStudentId);
}

/** Concept Focus (full subtopic) or chapter quiz on question-bank sets 2–6. */
export function assignmentRequiresMcqSponsorshipCharge(input: {
  assignmentType: string;
  chapterQuiz?: TeacherPortalChapterQuizRef | null;
}): boolean {
  if (input.assignmentType === "Concept Focus") return true;
  if (input.assignmentType !== "quiz") return false;

  const cq = input.chapterQuiz;
  if (!cq || cq.level !== "advanced" || cq.advancedSet == null) return false;
  const set = Number(cq.advancedSet);
  return isAdvancedQuizSetIndex(set) && ADVANCED_QUIZ_BANK_SET_INDICES.includes(set);
}

export function mcqSponsorshipChargeTotal(perStudent: number, billableStudentCount: number): number {
  const per = Math.max(0, Math.round(Number(perStudent) || 0));
  const n = Math.max(0, Math.floor(billableStudentCount));
  if (per <= 0 || n <= 0) return 0;
  return per * n;
}

export function audienceStudentIdsFromClassroom(
  students: TeacherPortalClassroomStudent[],
  scope: {
    mode: "full" | "section" | "custom";
    sectionId?: string | null;
    customStudentIds?: string[];
  }
): string[] {
  const rows = students.filter((s) => s.role !== "teacher");
  if (scope.mode === "custom" && scope.customStudentIds?.length) {
    const picked = new Set(scope.customStudentIds);
    return rows.filter((s) => picked.has(s.userId)).map((s) => s.userId);
  }
  if (scope.mode === "section" && scope.sectionId) {
    return rows.filter((s) => s.sectionId === scope.sectionId).map((s) => s.userId);
  }
  return rows.map((s) => s.userId);
}

export function splitClassroomAudienceForMcqSponsorship(
  students: TeacherPortalClassroomStudent[],
  audienceIds: string[]
): McqSponsorshipAudienceSplit {
  const planByStudentId = new Map<string, SubscriptionPlanKey>();
  for (const s of students) {
    planByStudentId.set(s.userId, s.subscriptionPlan ?? "free");
  }
  return splitStudentIdsByMcqSponsorshipNeed(audienceIds, planByStudentId);
}
