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
import {
  assertTeacherCanCreateAssignment,
  computeTeacherAssignmentPublishCharge,
  computeTeacherLiveClassScheduleCharge,
} from "@/lib/teacherPortal/teacherPlanServer";

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

function parseScheduledAt(body: unknown): Date {
  const raw = (body as { scheduledAt?: unknown })?.scheduledAt;
  if (typeof raw === "string" && raw.trim()) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
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
  const flatAmount = getChargeAmountForAction(costs, action);

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "Teacher account required" }, { status: 403 });
  }

  let amount = flatAmount;
  let skipped = false;
  let skipReason: string | undefined;

  if (action === "create_assignment") {
    const quota = await assertTeacherCanCreateAssignment(auth.user.id);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error, code: quota.code }, { status: 403 });
    }
    const charge = await computeTeacherAssignmentPublishCharge(auth.user.id, flatAmount);
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error, code: charge.code }, { status: 403 });
    }
    amount = charge.amount;
    if (amount <= 0) {
      skipped = true;
      skipReason = charge.isOverage ? undefined : "pro_plan_included";
    }
  }

  if (action === "schedule_session") {
    const refDate = parseScheduledAt(body);
    const charge = await computeTeacherLiveClassScheduleCharge(
      auth.user.id,
      refDate,
      flatAmount
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error, code: charge.code }, { status: 403 });
    }
    amount = charge.amount;
  }

  if (amount <= 0) {
    return NextResponse.json({
      ok: true,
      rdm: null,
      amount: 0,
      action,
      skipped: true,
      reason: skipReason ?? "zero_cost",
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

  return NextResponse.json({ ok: true, rdm: newRdm, amount, action, skipped });
}
