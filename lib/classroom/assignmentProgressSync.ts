/** Fired on `window` after a student saves lesson completion tied to a classroom post (e.g. Concept Focus). */
export const CLASSROOM_ASSIGNMENT_PROGRESS_EVENT = "testbee:classroom-assignment-progress";

export type ClassroomAssignmentProgressDetail = {
  classroomId: string;
  postId: string;
};

export function dispatchClassroomAssignmentProgressChanged(
  detail: ClassroomAssignmentProgressDetail
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CLASSROOM_ASSIGNMENT_PROGRESS_EVENT, { detail }));
}
