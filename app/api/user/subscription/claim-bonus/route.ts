import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import {
  getTrialTrackerDaysCompleted,
  parseDailyStreakServerState,
  qualifiesForTrialExtensionBonus,
} from "@/lib/onboarding/dailyStreakProgress";
import { fetchSubscriptionConfig } from "@/lib/subscription/subscriptionConfig";
import {
  buildClaimBonusDecision,
  profileNowMs,
  type TrialAccessProfile,
} from "@/lib/subscription/trialLifecycle";

const CLAIM_BONUS_PROFILE_SELECT =
  "plan_tier, onboarding_reward_claimed_at, free_trial_daily_streak, trial_end_bonus_activated, free_trial_activated_at, free_trial_activated, created_at, time_travel_offset_ms, trial_second_round_activated, trial_original_ended_at, subscription_started_at, subscription_expires_at, card_added_at";

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;
    const body = (await request.json().catch(() => ({}))) as { plan?: string };

    const selectedPlan = body.plan?.trim().toLowerCase();
    if (selectedPlan !== "starter" && selectedPlan !== "pro") {
      return NextResponse.json({ error: "Invalid plan. Choose starter or pro." }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- profile columns ahead of generated types
    const { data: profileRowRaw, error: profileErr } = await (supabase as any)
      .from("profiles")
      .select(CLAIM_BONUS_PROFILE_SELECT)
      .eq("id", user.id)
      .maybeSingle();
    const profileRow = profileRowRaw as TrialAccessProfile & {
      onboarding_reward_claimed_at?: string | null;
      free_trial_daily_streak?: unknown;
    } | null;

    if (profileErr) {
      console.error("claim-bonus: failed to read profile", profileErr);
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    if (!profileRow) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const cfg = await fetchSubscriptionConfig(supabase);
    const nowMs = profileNowMs(profileRow);
    const serverStreak = parseDailyStreakServerState(profileRow.free_trial_daily_streak);
    const trackerDaysCompleted = getTrialTrackerDaysCompleted(
      user.id,
      profileRow.onboarding_reward_claimed_at ?? null,
      serverStreak
    );
    const hasStreakBonus = qualifiesForTrialExtensionBonus(
      user.id,
      profileRow.onboarding_reward_claimed_at ?? null,
      serverStreak
    );

    const decision = buildClaimBonusDecision({
      selectedPlan,
      nowMs,
      hasStreakBonus,
      profile: profileRow,
      trackerDaysCompleted,
      cfg,
    });

    if (decision.kind === "already_claimed") {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        scenario: decision.scenario,
      });
    }
    if (decision.kind === "too_early") {
      return NextResponse.json({ error: decision.error }, { status: 400 });
    }
    if (decision.kind === "bonus_window_closed") {
      return NextResponse.json({ error: decision.error }, { status: 400 });
    }

    if (decision.kind !== "apply") {
      const unexpected: never = decision;
      return NextResponse.json(
        { error: `Unhandled claim-bonus state: ${String(unexpected)}` },
        { status: 500 }
      );
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update(decision.updates)
      .eq("id", user.id);

    if (updateErr) {
      console.error("claim-bonus: failed to update profile", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      scenario: decision.scenario,
      trackerDaysCompleted,
    });
  } catch (e) {
    console.error("claim-bonus POST error", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
