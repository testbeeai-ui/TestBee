import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";

type ClaimResult = {
  ok?: boolean;
  skipped?: boolean;
  error?: string;
  referrer_credited?: boolean;
  referee_credited?: boolean;
  weekly_bonus?: boolean;
};

export async function POST(request: Request) {
  const originBlock = enforceSameOriginForCookieAuth(request);
  if (originBlock) return originBlock;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  let body: { ref?: string };
  try {
    body = (await request.json()) as { ref?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const refRaw = typeof body.ref === "string" ? body.ref : "";
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data, error } = await admin.rpc("claim_referral_attribution", {
    p_ref_code: refRaw,
    p_referee_id: auth.user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as ClaimResult | null;
  if (!result || typeof result !== "object") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  if (result.skipped) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      referrerCredited: false,
      refereeCredited: false,
    });
  }

  if (!result.ok) {
    const err = result.error ?? "unknown";
    const status =
      err === "invalid_ref" || err === "referrer_not_found" || err === "self_referral"
        ? 400
        : err === "onboarding_incomplete"
          ? 409
          : err === "already_claimed"
            ? 409
            : 400;
    return NextResponse.json({ ok: false, error: err }, { status });
  }

  return NextResponse.json({
    ok: true,
    referrerCredited: Boolean(result.referrer_credited),
    refereeCredited: Boolean(result.referee_credited),
    weeklyBonus: Boolean(result.weekly_bonus),
  });
}
