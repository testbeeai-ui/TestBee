import type { TeacherPortalAssignmentItem } from "@/lib/teacherPortal/types";

/**
 * True when an assignment post is still “active” for teacher nudges: either no due date,
 * or the due timestamp has not passed yet (past-due assignments are excluded).
 */
export function assignmentPostDueStillActive(a: TeacherPortalAssignmentItem): boolean {
  const iso = a.dueDateIso;
  if (!iso || !String(iso).trim()) return true;
  const t = new Date(iso.trim()).getTime();
  if (Number.isNaN(t)) return true;
  return t >= Date.now();
}
