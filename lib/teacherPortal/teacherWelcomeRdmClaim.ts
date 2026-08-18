/**
 * Spec for credit_teacher_profile_welcome_rdm first-claim lock.
 * Mirrors supabase/migrations/20261018130000_teacher_welcome_rdm_per_row_claim.sql
 *
 * Credit only when claimed_at goes from null to set. UPDATE uses OLD.claimed_at.
 * INSERT has no OLD, so oldClaimedAt is the incoming stamp (null means this
 * statement applied the stamp; a restore already carries a timestamp).
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
  // INSERT has no OLD row; oldClaimedAt is the incoming stamp.
  if (input.op === "INSERT" && input.oldClaimedAt !== null) return false;
  return true;
}
