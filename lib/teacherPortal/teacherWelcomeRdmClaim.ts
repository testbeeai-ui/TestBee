/**
 * Spec for credit_teacher_profile_welcome_rdm first-claim lock.
 * Mirrors supabase/migrations/20261018140000_teacher_welcome_rdm_just_stamped_rows.sql
 *
 * Per-row justStamped is the INSERT restore lock: an already-stamped
 * onboarded teacher has NEW.claimed_at set and no OLD row, so OLD/NEW
 * alone would pay again. A session GUC cannot carry justStamped, because
 * PostgreSQL fires every BEFORE ROW stamp before any AFTER ROW credit.
 */
export function shouldCreditTeacherWelcomeRdm(input: {
  op: "INSERT" | "UPDATE";
  qualifying: boolean;
  wasQualifying: boolean;
  oldClaimedAt: string | null;
  newClaimedAt: string | null;
  justStamped: boolean;
}): boolean {
  if (!input.qualifying) return false;
  if (input.wasQualifying) return false;
  if (input.newClaimedAt === null) return false;
  if (input.op === "UPDATE" && input.oldClaimedAt !== null) return false;
  if (input.op === "INSERT" && input.oldClaimedAt !== null) return false;
  if (!input.justStamped) return false;
  return true;
}
