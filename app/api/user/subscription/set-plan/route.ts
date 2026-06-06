import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import {
  isSelfServicePlanSwitchAllowed,
  normalizePlanSwitchRequest,
} from "@/lib/subscription/selfServicePlanSwitch";

type Body = {
  plan?: string;
};

/**
 * Self-service downgrade endpoint. Paid plans and free-trial activation use
 * dedicated guarded flows so this route cannot mint entitlements.
 */
export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { supabase, user } = ctx;
    const body = (await request.json().catch(() => ({}))) as Body;
    const requested = normalizePlanSwitchRequest(body.plan);
    if (!requested) {
      return NextResponse.json(
        { error: "Invalid plan. Use free_trial, free, starter, or pro." },
        { status: 400 }
      );
    }

    if (!isSelfServicePlanSwitchAllowed(requested)) {
      return NextResponse.json(
        { error: "This plan cannot be activated from the self-service switcher." },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = {
      plan_tier: requested,
      free_trial_activated: false,
    };

    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, plan: requested });
  } catch (e) {
    console.error("set-plan POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
