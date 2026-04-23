import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  parseAssignmentTasks,
  studentVisibleTasks,
  type AssignmentTaskKind,
} from "@/lib/classroom/assignmentTasks";

const ASSIGNMENT_POST_TYPES = ["assignment", "quiz", "mock", "Concept Focus"] as const;

/**
 * Marks every student-visible assignment task whose `kind` is in `kinds` as complete
 * for all classroom posts the user is a member of. Idempotent (skips existing rows).
 * Call with the user's Supabase client so RLS applies.
 */
export async function syncAssignmentTasksForKinds(
  supabase: SupabaseClient<Database>,
  userId: string,
  kinds: AssignmentTaskKind[]
): Promise<{ inserted: number; skipped: number }> {
  const kindSet = new Set(kinds);
  if (kindSet.size === 0) return { inserted: 0, skipped: 0 };

  const { data: memberships, error: memErr } = await supabase
    .from("classroom_members")
    .select("classroom_id")
    .eq("user_id", userId);
  if (memErr || !memberships?.length) return { inserted: 0, skipped: 0 };

  const classroomIds = [...new Set(memberships.map((m) => m.classroom_id))];
  const { data: posts, error: postsErr } = await supabase
    .from("posts")
    .select("id, type, content_json")
    .in("classroom_id", classroomIds)
    .in("type", [...ASSIGNMENT_POST_TYPES]);
  if (postsErr || !posts?.length) return { inserted: 0, skipped: 0 };

  const postIds = posts.map((p) => p.id);
  const { data: existingRows } = await supabase
    .from("classroom_assignment_task_progress")
    .select("post_id, task_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  const existing = new Set((existingRows ?? []).map((r) => `${r.post_id}:${r.task_id}`));

  let inserted = 0;
  let skipped = 0;

  for (const post of posts) {
    const visible = studentVisibleTasks(parseAssignmentTasks(post.content_json, post.type));
    for (const t of visible) {
      if (!kindSet.has(t.kind)) continue;
      const key = `${post.id}:${t.id}`;
      if (existing.has(key)) {
        skipped++;
        continue;
      }
      const { error } = await supabase.from("classroom_assignment_task_progress").insert({
        post_id: post.id,
        task_id: t.id,
        user_id: userId,
      });
      if (error) {
        if (error.code === "23505") {
          existing.add(key);
          skipped++;
        } else {
          console.warn("[syncAssignmentTasksForKinds]", error.message);
        }
      } else {
        existing.add(key);
        inserted++;
      }
    }
  }

  return { inserted, skipped };
}

/** Browser-only: notify server to tick matching classroom assignment tasks (e.g. after Daily Gauntlet). */
export function fireAssignmentTaskSync(kinds: AssignmentTaskKind[]): void {
  if (typeof window === "undefined" || kinds.length === 0) return;
  void fetch("/api/user/assignment-task-sync", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kinds }),
  }).catch(() => {});
}
