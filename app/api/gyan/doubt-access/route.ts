import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { resolveGyanDoubtAccessForUser } from "@/lib/subscription/gyanDoubtsLimits";

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "plan_tier, free_trial_activated, payment_card_details, subscription_started_at, time_travel_offset_ms"
      )
      .eq("id", user.id)
      .maybeSingle();

    const access = await resolveGyanDoubtAccessForUser(supabase, user.id, profile);
    return NextResponse.json(access);
  } catch (e) {
    console.error("[gyan/doubt-access]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
