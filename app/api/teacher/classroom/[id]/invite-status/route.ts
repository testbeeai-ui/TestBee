import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";

export const runtime = "nodejs";

type RecipientRow = {
  email: string;
  invited_at: string;
  linked_user_id: string | null;
  linked_at: string | null;
  paid_bonus_awarded_at: string | null;
};

type BatchRow = {
  flat_reward_granted: boolean;
  flat_reward_rdm: number | null;
};

/**
 * Read-only "who joined" view for a classroom's bulk invites. RLS on
 * classroom_invite_recipients / _batches already restricts rows to the
 * owning teacher (teacher_id = auth.uid()), so a non-owner simply gets
 * empty results rather than another's data.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classroomId } = await context.params;
  if (!classroomId?.trim()) {
    return NextResponse.json({ error: "Invalid classroom" }, { status: 400 });
  }

  const { supabase } = ctx;

  const [recipientsRes, batchesRes] = await Promise.all([
    supabase
      .from("classroom_invite_recipients")
      .select("email, invited_at, linked_user_id, linked_at, paid_bonus_awarded_at")
      .eq("classroom_id", classroomId)
      .order("invited_at", { ascending: false }),
    supabase
      .from("classroom_invite_batches")
      .select("flat_reward_granted, flat_reward_rdm")
      .eq("classroom_id", classroomId),
  ]);

  if (recipientsRes.error) {
    return NextResponse.json({ error: recipientsRes.error.message }, { status: 500 });
  }

  const rows = (recipientsRes.data ?? []) as RecipientRow[];
  const batches = (batchesRes.data ?? []) as BatchRow[];

  const recipients = rows.map((r) => ({
    email: r.email,
    invitedAt: r.invited_at,
    joined: r.linked_user_id !== null,
    subscribed: r.paid_bonus_awarded_at !== null,
  }));

  const invitedCount = recipients.length;
  const joinedCount = recipients.filter((r) => r.joined).length;
  const subscribedCount = recipients.filter((r) => r.subscribed).length;

  const grantedBatch = batches.find((b) => b.flat_reward_granted);
  const flatRewarded = Boolean(grantedBatch);
  const flatRewardRdm = grantedBatch?.flat_reward_rdm ?? 0;
  const paidBonus = DEFAULT_RDM_CONFIG.classroom_batch_paid_bonus_rdm;

  return NextResponse.json({
    ok: true,
    invitedCount,
    joinedCount,
    subscribedCount,
    flatRewarded,
    flatRewardRdm,
    rdmEarned: flatRewardRdm + subscribedCount * paidBonus,
    recipients,
  });
}
