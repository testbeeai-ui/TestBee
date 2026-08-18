/**
 * Spec for credit_teacher_profile_welcome_rdm first-claim lock.
 * Mirrors supabase/migrations/20261018120000_teacher_welcome_rdm_one_time_claim.sql
 */
export function shouldCreditTeacherWelcomeRdm(input: {
  op: "INSERT" | "UPDATE";
  userId: string;
  qualifying: boolean;
  wasQualifying: boolean;
  oldClaimedAt: string | null;
  justStampedUserId: string;
}): boolean {
  if (!input.qualifying) return false;
  if (input.wasQualifying) return false;
  if (input.op === "UPDATE" && input.oldClaimedAt !== null) return false;
  if (input.justStampedUserId !== input.userId) return false;
  return true;
}
