import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { resolveSubjectChatAccessForUser } from "@/lib/subscription/subjectChatLimits";

/** GET — today's subject chat quota for the signed-in student. */
export async function GET(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await auth.supabase
    .from("profiles")
    .select(
      "plan_tier, free_trial_activated, payment_card_details, subscription_started_at, subscription_expires_at, time_travel_offset_ms"
    )
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const access = await resolveSubjectChatAccessForUser(
    auth.supabase,
    auth.user.id,
    profile
  );

  return NextResponse.json({
    plan: access.plan,
    dailyLimit: access.unlimited ? null : access.dailyLimit,
    unlimited: access.unlimited,
    usedToday: access.usedToday,
    remaining: access.remaining,
    multilingual: access.multilingual,
    canSend: access.canSend,
    istDate: access.istDate,
  });
}
