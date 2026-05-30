import type { SupabaseClient } from "@supabase/supabase-js";
import { listActiveBuddyPairsForUser } from "@/lib/buddy/activeBuddyLink";

export type BuddyOnboardingVerification = {
  /** At least one invite you sent has status accepted (legacy flag). */
  hasAcceptedInvite: boolean;
  /** Accepted invite + that person is an active study buddy (source of truth for checklist). */
  hasInvitedBuddyJoined: boolean;
};

/**
 * Inviter onboarding completes only when someone accepted your invite AND is paired
 * as an active study buddy — not from copy/share alone.
 */
export async function verifyBuddyOnboardingForInviter(
  userClient: SupabaseClient,
  adminClient: SupabaseClient,
  userId: string
): Promise<BuddyOnboardingVerification> {
  const [pairsResult, acceptedRes] = await Promise.all([
    listActiveBuddyPairsForUser(adminClient, userId),
    userClient
      .from("buddy_invites")
      .select("accepted_by_user_id")
      .eq("inviter_user_id", userId)
      .eq("status", "accepted")
      .not("accepted_by_user_id", "is", null),
  ]);

  const activeBuddyIds = new Set((pairsResult.pairs ?? []).map((p) => p.buddy_user_id));

  const acceptedRows = acceptedRes.data ?? [];
  const hasAcceptedInvite = acceptedRows.length > 0;
  const hasInvitedBuddyJoined = acceptedRows.some(
    (row) =>
      typeof row.accepted_by_user_id === "string" && activeBuddyIds.has(row.accepted_by_user_id)
  );

  return { hasAcceptedInvite, hasInvitedBuddyJoined };
}
