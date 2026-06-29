import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  parseAssignmentTasks,
  studentVisibleTasks,
} from "@/lib/classroom/assignmentTasks";
import { resolveAssignmentAudienceStudentIds } from "@/lib/classroom/assignmentStudentCompletion";

export type ChapterQuizAssignmentScope = {
  subject: string;
  classLevel: number | string;
  topic: string;
  subtopicName: string;
  level?: string | null;
  quizSet?: number | string | null;
};

function normalizeKey(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function chapterQuizPayloadMatches(
  cq: Record<string, unknown>,
  scope: ChapterQuizAssignmentScope
): boolean {
  if (normalizeKey(cq.subject) !== normalizeKey(scope.subject)) return false;
  if (Number(cq.classLevel) !== Number(scope.classLevel)) return false;
  if (normalizeKey(cq.topic) !== normalizeKey(scope.topic)) return false;
  if (normalizeKey(cq.subtopicName) !== normalizeKey(scope.subtopicName)) return false;

  const scopeLevel = scope.level?.trim();
  if (scopeLevel && normalizeKey(cq.level) !== normalizeKey(scopeLevel)) return false;

  const scopeSet =
    scope.quizSet != null && String(scope.quizSet).trim() !== ""
      ? Number(scope.quizSet)
      : null;
  if (scopeSet != null && Number.isFinite(scopeSet)) {
    const cqSet = cq.advancedSet != null ? Number(cq.advancedSet) : null;
    if (cqSet != null && cqSet !== scopeSet) return false;
  }

  return true;
}

export type ResolvedChapterQuizAssignment = {
  postId: string;
  taskId: string;
};

/**
 * Finds the classroom quiz assignment post matching a subtopic quiz scope.
 * Used when the lesson URL still has an unreplaced {{POST_ID}} placeholder.
 */
export async function resolveChapterQuizAssignmentPost(
  db: SupabaseClient<Database>,
  input: {
    classroomId: string;
    studentUserId: string;
    scope: ChapterQuizAssignmentScope;
  }
): Promise<ResolvedChapterQuizAssignment | null> {
  const { classroomId, studentUserId, scope } = input;

  const { data: posts, error } = await db
    .from("posts")
    .select("id, type, content_json")
    .eq("classroom_id", classroomId)
    .eq("type", "quiz")
    .order("created_at", { ascending: false });

  if (error || !posts?.length) return null;

  const { data: roster } = await db
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .neq("role", "teacher");
  const classroomStudentIds = (roster ?? []).map((r) => r.user_id);

  for (const post of posts) {
    const content =
      post.content_json && typeof post.content_json === "object" && !Array.isArray(post.content_json)
        ? (post.content_json as Record<string, unknown>)
        : null;
    if (!content) continue;

    const cqRaw = content.chapterQuiz;
    if (!cqRaw || typeof cqRaw !== "object" || Array.isArray(cqRaw)) continue;
    if (!chapterQuizPayloadMatches(cqRaw as Record<string, unknown>, scope)) continue;

    const audience = resolveAssignmentAudienceStudentIds(post.content_json, classroomStudentIds);
    if (audience.length > 0 && !audience.includes(studentUserId)) continue;

    const quizTask = studentVisibleTasks(
      parseAssignmentTasks(post.content_json, post.type)
    ).find((t) => t.kind === "chapter_quiz");
    if (!quizTask?.id) continue;

    return { postId: post.id, taskId: quizTask.id };
  }

  return null;
}
