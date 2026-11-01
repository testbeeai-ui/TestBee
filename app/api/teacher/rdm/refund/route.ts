import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";

const CHARGE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const chargeId = (body as { chargeId?: unknown })?.chargeId;
  if (typeof chargeId !== "string" || !CHARGE_ID.test(chargeId)) {
    return NextResponse.json({ error: "A charge id is required" }, { status: 400 });
  }

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

  const { data, error } = await (
    admin as unknown as {
      rpc: (
        fn: string,
        args: { p_charge_id: string; p_teacher_id: string }
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("refund_teacher_rdm_charge", {
    p_charge_id: chargeId,
    p_teacher_id: auth.user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    amount?: number;
    rdm?: number;
    already_refunded?: boolean;
  } | null;

  if (!result?.ok) {
    const status = result?.error === "charge_not_found" ? 404 : 400;
    return NextResponse.json({ error: result?.error ?? "Refund refused" }, { status });
  }

  return NextResponse.json({
    ok: true,
    rdm: result.rdm ?? null,
    amount: result.amount ?? 0,
    alreadyRefunded: result.already_refunded === true,
  });
}
