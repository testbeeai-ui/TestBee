import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSubscriptionConfig } from "@/lib/subscription/subscriptionConfig";
import {
  decideStudentMockAccess,
  profileNowMs,
  type TrialAccessProfile,
} from "@/lib/subscription/trialLifecycle";

export const STUDENT_MOCK_ACCESS_PROFILE_SELECT =
  "plan_tier, free_trial_activated, free_trial_activated_at, created_at, trial_second_round_activated, trial_end_bonus_activated, trial_original_ended_at, subscription_started_at, subscription_expires_at, card_added_at, time_travel_offset_ms";

/** Returns a 403/500 response when the student may not start or continue a mock. */
export async function enforceStudentMockAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<NextResponse | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- profile columns ahead of generated types
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select(STUDENT_MOCK_ACCESS_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[student-mock-access] profile", error);
    return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
  }

  const profile = (data ?? null) as TrialAccessProfile | null;
  const cfg = await fetchSubscriptionConfig(supabase);
  const nowMs = profileNowMs(profile);
  const decision = decideStudentMockAccess(profile, nowMs, cfg);

  if (decision.persist) {
    const { error: persistErr } = await supabase
      .from("profiles")
      .update(decision.persist)
      .eq("id", userId);
    if (persistErr) {
      console.error("[student-mock-access] persist", persistErr);
    }
  }

  if (!decision.allow) {
    return NextResponse.json(
      { error: decision.message, code: decision.code },
      { status: 403 }
    );
  }
  return null;
}
