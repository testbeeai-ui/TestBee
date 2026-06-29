import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  parseAssignmentTasks,
  studentVisibleTasks,
} from "@/lib/classroom/assignmentTasks";
import { tryFulfillAssignmentMotivationGrants } from "@/lib/teacherPortal/motivationRdm";
import { tryFulfillAssignmentCompletionReward } from "@/lib/teacherPortal/assignmentCompletionRdm";
import { isValidAssignmentPostId } from "@/lib/teacherPortal/assignmentPostIdTemplate";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type GyanAssignmentContext = {
  classroomId: string;
  postId: string;
  taskId: string;
};

export function parseGyanAssignmentContext(raw: unknown): GyanAssignmentContext | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const classroomId = typeof o.classroomId === "string" ? o.classroomId.trim() : "";
  const postId = typeof o.postId === "string" ? o.postId.trim() : "";
  const taskId = typeof o.taskId === "string" ? o.taskId.trim() : "";
  if (!UUID_RE.test(classroomId) || !isValidAssignmentPostId(postId) || !taskId) return null;
  return { classroomId, postId, taskId };
}

/** Minimum content bar for assignment-linked doubts (anti-spam). */
export function gyanDoubtMeetsMinimumBar(title: string, body: string): boolean {
  const t = title.trim();
  const combined = `${t} ${body.trim()}`.trim();
  return t.length >= 3 && combined.length >= 8;
}

export type GyanAssignmentCompletionResult =
  | { ok: true; completed: true; duplicate?: boolean }
  | { ok: true; completed: false; skipped: true; reason: string }
  | { ok: false; error: string };

/**
 * After a doubt is created, mark the scoped Gyan++ assignment task complete and link doubt_id.
 * Idempotent per (post_id, task_id, user_id).
 */
export async function tryCompleteGyanEngagementAssignment(
  supabase: SupabaseClient<Database>,
  admin: SupabaseClient<Database> | null,
  input: {
    userId: string;
    doubtId: string;
    title: string;
    body: string;
    context: GyanAssignmentContext;
  }
): Promise<GyanAssignmentCompletionResult> {
  const { userId, doubtId, title, body, context } = input;
  if (!UUID_RE.test(doubtId)) {
    return { ok: false, error: "Invalid doubt id" };
  }
  if (!gyanDoubtMeetsMinimumBar(title, body)) {
    return {
      ok: true,
      completed: false,
      skipped: true,
      reason: "Doubt is too short to count for this assignment.",
    };
  }

  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, classroom_id, teacher_id, type, content_json")
    .eq("id", context.postId)
    .maybeSingle();
  if (postErr || !post) {
    return { ok: true, completed: false, skipped: true, reason: "Assignment not found." };
  }
  if (post.classroom_id !== context.classroomId) {
    return { ok: true, completed: false, skipped: true, reason: "Assignment mismatch." };
  }
  if (post.teacher_id === userId) {
    return { ok: true, completed: false, skipped: true, reason: "Teachers cannot complete student assignments." };
  }

  const { data: mem } = await supabase
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", context.classroomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem) {
    return { ok: true, completed: false, skipped: true, reason: "Not a classroom member." };
  }

  const visible = studentVisibleTasks(parseAssignmentTasks(post.content_json, post.type));
  const task = visible.find((t) => t.id === context.taskId);
  if (!task || task.kind !== "gyan_engagement") {
    return { ok: true, completed: false, skipped: true, reason: "Not a Gyan++ assignment task." };
  }

  const { data: doubtRow } = await supabase
    .from("doubts")
    .select("id, user_id")
    .eq("id", doubtId)
    .maybeSingle();
  if (!doubtRow || doubtRow.user_id !== userId) {
    return { ok: false, error: "Doubt not found for this user." };
  }

  const { error: insErr } = await supabase.from("classroom_assignment_task_progress").insert({
    post_id: context.postId,
    task_id: context.taskId,
    user_id: userId,
    doubt_id: doubtId,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      if (admin) {
        try {
          await tryFulfillAssignmentMotivationGrants(admin, userId, context.postId);
          await tryFulfillAssignmentCompletionReward(admin, userId, context.postId);
        } catch {
          /* non-fatal */
        }
      }
      return { ok: true, completed: true, duplicate: true };
    }
    return { ok: false, error: insErr.message };
  }

  if (admin) {
    try {
      await tryFulfillAssignmentMotivationGrants(admin, userId, context.postId);
      await tryFulfillAssignmentCompletionReward(admin, userId, context.postId);
    } catch {
      /* non-fatal */
    }
  }

  return { ok: true, completed: true };
}

export type GyanLinkedDoubtPreview = {
  doubtId: string;
  title: string;
  body: string;
  subject: string | null;
  createdAt: string;
};
