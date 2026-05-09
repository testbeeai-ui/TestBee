import type { TeacherPortalAssignmentItem } from "@/lib/teacherPortal/types";

/**
 * Best timestamp for “assigned / visible this calendar week”: max of created_at and updated_at.
 * Uses updated_at so reposts and edits still align with teacher expectations when created_at is old.
 */
export function postTimestampMsForNudgeWeek(post: {
  created_at?: string | null;
  updated_at?: string | null;
}): number | null {
  const times: number[] = [];
  if (typeof post.created_at === "string" && post.created_at.trim()) {
    const t = Date.parse(post.created_at);
    if (Number.isFinite(t)) times.push(t);
  }
  if (typeof post.updated_at === "string" && post.updated_at.trim()) {
    const t = Date.parse(post.updated_at);
    if (Number.isFinite(t)) times.push(t);
  }
  if (times.length === 0) return null;
  return Math.max(...times);
}

/** `content_json.generatedTestPaper` from Create Tests → assign to classroom. */
export function contentJsonHasGeneratedTestPaper(contentJson: unknown): boolean {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) return false;
  const gp = (contentJson as Record<string, unknown>).generatedTestPaper;
  return gp != null && typeof gp === "object" && !Array.isArray(gp);
}

/** Raw post row: catalog mock, syllabus chapter quiz (MCQ), or generated classroom MCQ assignment. */
export function postRowIsNudgeMcqTarget(post: {
  type: string;
  content_json?: unknown;
}): boolean {
  if (post.type === "mock") return true;
  if (post.type === "past_paper") return true;
  /** Chapter / syllabus MCQ assignments (Create assignment → Quiz). */
  if (post.type === "quiz") return true;
  if (post.type === "assignment") return contentJsonHasGeneratedTestPaper(post.content_json);
  return false;
}

/**
 * Bundle assignment: catalog `mock` or assignment flagged with generated MCQ (or legacy task href).
 */
export function assignmentItemIsNudgeMcqTarget(a: TeacherPortalAssignmentItem): boolean {
  if (a.type === "mock") return true;
  if (a.type === "past_paper") return true;
  if (a.type === "quiz") return true;
  if (a.isGeneratedClassroomMcq) return true;
  if (
    a.type === "assignment" &&
    a.tasks.some((t) => typeof t.href === "string" && t.href.includes("/assignment-test/"))
  ) {
    return true;
  }
  return false;
}
