/**
 * Spec for credit_teacher_profile_welcome_rdm first-claim lock.
 * Mirrors supabase/migrations/20261018120000_teacher_welcome_rdm_one_time_claim.sql
 *
 * justStampedUserIds is the comma-separated GUC list of ids stamped in this
 * statement. PostgreSQL runs every BEFORE ROW stamp before any AFTER ROW
 * credit, so a single-id gate would drop every stamped row except the last.
 */
export function shouldCreditTeacherWelcomeRdm(input: {
  op: "INSERT" | "UPDATE";
  userId: string;
  qualifying: boolean;
  wasQualifying: boolean;
  oldClaimedAt: string | null;
  justStampedUserIds: string;
}): boolean {
  if (!input.qualifying) return false;
  if (input.wasQualifying) return false;
  if (input.op === "UPDATE" && input.oldClaimedAt !== null) return false;
  const stamped = input.justStampedUserIds.split(",").filter((id) => id.length > 0);
  if (!stamped.includes(input.userId)) return false;
  return true;
}
