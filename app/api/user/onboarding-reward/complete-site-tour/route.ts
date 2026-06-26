import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin/admin";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { buildSiteTourCompleteProgress } from "@/lib/onboarding/buildSiteTourCompleteProgress";

/**
 * Finish Day-1 site tour: mark every onboarding checklist row on the server, then claim +100 RDM.
 * Reading the tour is the verification — no buddy invite or per-page task checks.
 */
export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const { data: profile, error: readErr } = await supabase
      .from("profiles")
      .select(
        "free_trial_activated, onboarding_reward_claimed_at, free_trial_checklist_reward_claimed_ever"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (readErr) {
      return NextResponse.json({ error: readErr.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }

    const isAdmin = await isAdminUser(supabase, user.id);
    if (!isAdmin && profile.free_trial_activated !== true) {
      return NextResponse.json({ error: "trial_not_activated" }, { status: 403 });
    }

    if (!profile.onboarding_reward_claimed_at) {
      const fullProgress = buildSiteTourCompleteProgress();
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ onboarding_reward_progress: fullProgress })
        .eq("id", user.id);

      if (updateErr) {
        console.error("complete-site-tour progress update", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    const { data, error: rpcErr } = await supabase.rpc("claim_free_trial_checklist_reward");

    if (rpcErr) {
      console.error("complete-site-tour claim_free_trial_checklist_reward", rpcErr);
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    const result = (data ?? {}) as {
      ok?: boolean;
      already_claimed?: boolean;
      amount?: number;
      balance?: number;
      error?: string;
    };

    if (result?.ok !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: result?.error ?? "claim_failed",
          amount: 0,
          balance: 0,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      alreadyClaimed: Boolean(result.already_claimed),
      amount: Number(result.amount) || 0,
      balance: Number(result.balance) || 0,
      claimedEver: profile.free_trial_checklist_reward_claimed_ever === true,
    });
  } catch (e) {
    console.error("complete-site-tour POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
