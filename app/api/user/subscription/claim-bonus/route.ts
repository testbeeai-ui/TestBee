import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth, isDangerousRouteEnabled } from "@/lib/auth/securityGuards";
import {
  parseDailyStreakServerState,
  qualifiesForTrialExtensionBonus,
  getTrialTrackerDaysCompleted,
} from "@/lib/onboarding/dailyStreakProgress";
import { isFreeTrialPeriodEndedForProfile } from "@/lib/subscription/freeTrialTimer";

async function getSupabaseAndUser(request: Request) {
  const cookieClient = await createClient();
  let user = (await cookieClient.auth.getUser()).data?.user ?? null;
  if (!user) {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const {
        data: { user: u },
      } = await cookieClient.auth.getUser(token);
      user = u ?? null;
      if (user) {
        return { supabase: createClientWithToken(token), user };
      }
    }
  }
  return user ? { supabase: cookieClient, user } : null;
}

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;
    const body = (await request.json().catch(() => ({}))) as {
      plan?: string;
      cardDetails?: {
        cardNumber: string;
        cardholderName: string;
        expiryDate: string;
        cvv: string;
      };
    };

    const selectedPlan = body.plan?.trim().toLowerCase();
    if (selectedPlan !== "starter" && selectedPlan !== "pro") {
      return NextResponse.json({ error: "Invalid plan. Choose starter or pro." }, { status: 400 });
    }

    const cardNumber = body.cardDetails?.cardNumber?.replace(/\s/g, "") ?? "";
    const cvv = body.cardDetails?.cvv?.replace(/\D/g, "") ?? "";
    if (
      cardNumber.length < 15 ||
      cardNumber.length > 16 ||
      !body.cardDetails?.cardholderName?.trim() ||
      !/^\d{2}\/\d{2}$/.test(String(body.cardDetails?.expiryDate ?? "").trim()) ||
      cvv.length < 3 ||
      cvv.length > 4
    ) {
      return NextResponse.json(
        { error: "Invalid card details. Use 15–16 digit card, MM/YY expiry, and 3–4 digit CVV." },
        { status: 400 }
      );
    }

    type ClaimBonusProfileRow = {
      onboarding_reward_claimed_at?: string | null;
      free_trial_daily_streak?: unknown;
      trial_end_bonus_activated?: boolean | null;
      free_trial_activated_at?: string | null;
      free_trial_activated?: boolean | null;
      created_at?: string | null;
      time_travel_offset_ms?: number | null;
      trial_second_round_activated?: boolean | null;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- profile columns ahead of generated types
    const { data: profileRowRaw, error: profileErr } = await (supabase as any)
      .from("profiles")
      .select(
        "onboarding_reward_claimed_at, free_trial_daily_streak, trial_end_bonus_activated, free_trial_activated_at, free_trial_activated, created_at, time_travel_offset_ms, trial_second_round_activated"
      )
      .eq("id", user.id)
      .maybeSingle();
    const profileRow = profileRowRaw as ClaimBonusProfileRow | null;

    if (profileErr) {
      console.error("claim-bonus: failed to read profile", profileErr);
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    if (profileRow?.trial_end_bonus_activated) {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        scenario: profileRow?.trial_second_round_activated ? 1 : 2,
      });
    }

    const simulatedNow = Date.now() + Math.max(0, Number(profileRow?.time_travel_offset_ms ?? 0));
    if (
      !isFreeTrialPeriodEndedForProfile(
        {
          free_trial_activated_at: profileRow?.free_trial_activated_at,
          free_trial_activated: profileRow?.free_trial_activated,
          created_at: profileRow?.created_at,
          trial_second_round_activated: profileRow?.trial_second_round_activated,
        },
        simulatedNow
      )
    ) {
      return NextResponse.json(
        { error: "Free trial period has not ended yet. Complete 14 days first." },
        { status: 400 }
      );
    }

    const serverStreak = parseDailyStreakServerState(profileRow?.free_trial_daily_streak);
    const trackerDaysCompleted = getTrialTrackerDaysCompleted(
      user.id,
      profileRow?.onboarding_reward_claimed_at ?? null,
      serverStreak
    );

    /** Scenario 1: completed Days 1–10 onboarding track within the trial window. */
    const hasStreakBonus = qualifiesForTrialExtensionBonus(
      user.id,
      profileRow?.onboarding_reward_claimed_at ?? null,
      serverStreak
    );

    if (!hasStreakBonus && !isDangerousRouteEnabled("ALLOW_SIMULATED_PAYMENTS")) {
      return NextResponse.json(
        { error: "Payment verification is required before upgrading." },
        { status: 403 }
      );
    }

    const nowIso = new Date(simulatedNow).toISOString();
    const cardLast4 = cardNumber.slice(-4);

    const updates: Record<string, unknown> = {
      payment_card_details: {
        cardNumber: `**** **** **** ${cardLast4}`,
        cardholderName: body.cardDetails!.cardholderName.trim(),
        expiryDate: body.cardDetails!.expiryDate,
        planSelected: selectedPlan,
        billingCycle: "monthly",
      },
      card_added_at: nowIso,
      trial_end_bonus_activated: true,
      trial_streak_at_day_14: trackerDaysCompleted,
      trial_original_ended_at: nowIso,
    };

    if (hasStreakBonus) {
      updates.plan_tier = "free_trial";
      updates.trial_second_round_activated = true;
    } else {
      updates.plan_tier = selectedPlan;
      updates.trial_second_round_activated = false;
      updates.subscription_started_at = nowIso;
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const { error: updateErr } = await admin.from("profiles").update(updates).eq("id", user.id);

    if (updateErr) {
      console.error("claim-bonus: failed to update profile", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      scenario: hasStreakBonus ? 1 : 2,
      trackerDaysCompleted,
    });
  } catch (e) {
    console.error("claim-bonus POST error", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
