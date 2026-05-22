import type { SupabaseClient } from "@supabase/supabase-js";

export type ActiveBuddyPairRow = {
  buddy_user_id: string;
  created_at: string;
};

/** Active study buddies for one user (directed: people *they* paired with). */
export async function listActiveBuddyPairsForUser(
  db: SupabaseClient,
  userId: string
): Promise<{ pairs: ActiveBuddyPairRow[]; error: string | null }> {
  const { data, error } = await db
    .from("study_buddies")
    .select("buddy_user_id, created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) return { pairs: [], error: error.message };

  const pairs = (data ?? []).filter(
    (row): row is ActiveBuddyPairRow =>
      typeof row.buddy_user_id === "string" && row.buddy_user_id !== userId
  );

  return { pairs, error: null };
}

export async function viewerHasActiveBuddy(
  db: SupabaseClient,
  viewerId: string,
  buddyUserId: string
): Promise<boolean> {
  if (!buddyUserId || buddyUserId === viewerId) return false;
  const { data, error } = await db
    .from("study_buddies")
    .select("id")
    .eq("user_id", viewerId)
    .eq("buddy_user_id", buddyUserId)
    .eq("status", "active")
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}
