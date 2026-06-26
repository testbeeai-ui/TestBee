import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";
import type { LiveClassQualityBatchAwardResult } from "@/lib/teacherPortal/liveClassQualityRdm";

/** Auto-grant the credit-only quality bonus for ended, window-closed occurrences. */
export async function POST(request: Request) {
  const csrf = enforceSameOriginForCookieAuth(request);
  if (csrf) return csrf;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "Teacher account required" }, { status: 403 });
  }

  const { data, error } = await admin.rpc("award_eligible_teacher_live_class_quality_rdm", {
    p_teacher_id: auth.user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as LiveClassQualityBatchAwardResult;
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "award_failed" }, { status: 400 });
  }

  const awards = Array.isArray(result.awards) ? result.awards : [];
  const credited = awards.filter(
    (a) => a.qualifies && typeof a.quality_bonus_rdm === "number" && a.quality_bonus_rdm > 0
  );

  return NextResponse.json({
    ok: true,
    awardedCount: credited.length,
    awards: credited,
    balance: credited.length > 0 ? credited[credited.length - 1]?.balance ?? null : null,
  });
}
