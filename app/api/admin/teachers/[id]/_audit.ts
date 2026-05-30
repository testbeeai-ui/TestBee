import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AdminDb = SupabaseClient<Database>;

export async function auditAdminTeacherAction(input: {
  admin: AdminDb;
  actorUserId: string;
  targetTeacherId: string;
  actionType: string;
  reason: string | null;
  oldState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
}) {
  const adminAny = input.admin as unknown as {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  };
  try {
    await adminAny.from("admin_user_actions").insert({
      target_user_id: input.targetTeacherId,
      actor_user_id: input.actorUserId,
      action_type: input.actionType,
      reason: input.reason,
      old_state: input.oldState ?? {},
      new_state: input.newState ?? {},
    });
  } catch {
    // Best effort: don't fail the action if audit insert fails.
  }
}
