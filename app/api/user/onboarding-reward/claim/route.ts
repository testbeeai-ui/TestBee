import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase } = ctx;

    const { data, error } = await supabase.rpc("claim_free_trial_checklist_reward");

    if (error) {
      console.error("claim_free_trial_checklist_reward error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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
    });
  } catch (e) {
    console.error("onboarding-reward claim POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
