/**
 * Spec for credit_teacher_profile_welcome_rdm first-claim lock.
 * Mirrors supabase/migrations/20261018130000_teacher_welcome_rdm_per_row_claim.sql
 *
 * Per-row OLD/NEW claimed_at is the lock. A session GUC cannot be, because
 * PostgreSQL fires every BEFORE ROW stamp before any AFTER ROW credit.
 */
export function shouldCreditTeacherWelcomeRdm(input: {
  op: "INSERT" | "UPDATE";
  qualifying: boolean;
  wasQualifying: boolean;
  oldClaimedAt: string | null;
  newClaimedAt: string | null;
}): boolean {
  if (!input.qualifying) return false;
  if (input.wasQualifying) return false;
  if (input.newClaimedAt === null) return false;
  if (input.op === "UPDATE" && input.oldClaimedAt !== null) return false;
  return true;
}
