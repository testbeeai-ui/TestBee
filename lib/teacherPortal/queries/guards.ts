import type { TeacherVerificationStatus } from "@/lib/teacherPortal/types";
import { ensureError, type DbClient } from "./utils";

export const TEACHER_VERIFICATION_REQUIRED_ERROR =
  "Teacher verification approval is required before performing this action.";

export type TeacherMutationGuardOptions = {
  skipVerificationCheck?: boolean;
};

/** Server/API use: blocks mutations when `teacher_profile_details.verification_status !== 'approved'`. */
export async function assertTeacherApprovedForMutations(
  teacherId: string,
  db: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<void> {
  if (options?.skipVerificationCheck) return;
  const trimmedTeacherId = teacherId.trim();
  if (!trimmedTeacherId) throw new Error("Teacher id is required.");
  const { data, error } = await (
    db as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{
              data: { verification_status?: TeacherVerificationStatus | null } | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("teacher_profile_details")
    .select("verification_status")
    .eq("teacher_id", trimmedTeacherId)
    .maybeSingle();
  if (error) throw ensureError(error);
  if ((data?.verification_status ?? "unverified") !== "approved") {
    throw new Error(TEACHER_VERIFICATION_REQUIRED_ERROR);
  }
}
