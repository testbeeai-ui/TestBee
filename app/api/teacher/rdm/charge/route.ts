import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";
import type { TeacherRdmChargeAction } from "@/lib/teacherPortal/rdmCharges";
import {
  fetchTeacherRdmCosts,
  getChargeAmountForAction,
} from "@/lib/teacherPortal/teacherRdmConfig";
import { shouldWaiveTeacherAssignmentPublishCharge } from "@/lib/teacherPortal/teacherPlanServer";

const CHARGE_ACTIONS: TeacherRdmChargeAction[] = [
  "create_classroom",
  "create_section",
  "create_assignment",
  "schedule_session",
  "generate_test",
];

function isChargeAction(x: unknown): x is TeacherRdmChargeAction {
  return typeof x === "string" && CHARGE_ACTIONS.includes(x as TeacherRdmChargeAction);
}

export async function POST(request: Request) {
  const csrf = enforceSameOriginForCookieAuth(request);
  if (csrf) return csrf;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = (body as { action?: unknown })?.action;
  if (!isChargeAction(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const costs = await fetchTeacherRdmCosts(admin);
  const amount = getChargeAmountForAction(costs, action);

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "Teacher account required" }, { status: 403 });
  }

  if (amount <= 0) {
    return NextResponse.json({ ok: true, rdm: null, amount, action, skipped: true });
  }

  if (action === "create_assignment" && (await shouldWaiveTeacherAssignmentPublishCharge(auth.user.id))) {
    return NextResponse.json({
      ok: true,
      rdm: null,
      amount: 0,
      action,
      skipped: true,
      reason: "pro_plan",
    });
  }

  const { data: newRdm, error: rpcErr } = await admin.rpc("deduct_rdm", {
    uid: auth.user.id,
    amt: amount,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  if (newRdm === null) {
    return NextResponse.json({ error: "Insufficient RDM", amount, action }, { status: 402 });
  }

  return NextResponse.json({ ok: true, rdm: newRdm, amount, action });
}
