import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";
import { getRazorpayClient, parseRazorpayError } from "@/lib/razorpay/razorpayClient";
import { packRefundBlockReason } from "@/lib/teacherPortal/rdmPackRefund";

const PURCHASE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PurchaseRow = {
  id: string;
  teacher_id: string;
  rdm_granted: number;
  rdm_unspent: number;
  amount_paise: number;
  razorpay_payment_id: string;
  status: string;
};

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

  const purchaseId = (body as { purchaseId?: unknown })?.purchaseId;
  if (typeof purchaseId !== "string" || !PURCHASE_ID.test(purchaseId)) {
    return NextResponse.json({ error: "A purchase id is required" }, { status: 400 });
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

  const db = admin as typeof admin & { from: (table: string) => any };
  const { data: row, error: readErr } = await db
    .from("rdm_pack_purchases")
    .select(
      "id, teacher_id, rdm_granted, rdm_unspent, amount_paise, razorpay_payment_id, status"
    )
    .eq("id", purchaseId)
    .eq("teacher_id", auth.user.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  const purchase = row as PurchaseRow | null;
  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  const block = packRefundBlockReason({
    status: purchase.status,
    rdmGranted: purchase.rdm_granted,
    rdmUnspent: purchase.rdm_unspent,
  });
  if (block === "already_refunded") {
    return NextResponse.json({ ok: true, alreadyRefunded: true });
  }
  if (block) {
    return NextResponse.json(
      { error: "This pack has been used, so the payment cannot be refunded." },
      { status: 409 }
    );
  }

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    return NextResponse.json({ error: "Razorpay credentials not configured" }, { status: 401 });
  }

  let refundId = "";
  try {
    const refund = (await razorpay.payments.refund(purchase.razorpay_payment_id, {
      amount: purchase.amount_paise,
    })) as { id?: string };
    refundId = typeof refund?.id === "string" ? refund.id : "";
  } catch (e) {
    const parsed = parseRazorpayError(e);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }

  const { data, error } = await (
    admin as unknown as {
      rpc: (
        fn: string,
        args: { p_purchase_id: string; p_teacher_id: string; p_razorpay_refund_id: string }
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("finalize_rdm_pack_refund", {
    p_purchase_id: purchase.id,
    p_teacher_id: auth.user.id,
    p_razorpay_refund_id: refundId,
  });

  if (error) {
    return NextResponse.json(
      {
        error:
          "Razorpay refunded the payment, but the wallet could not be updated. Contact billing@edublast.in with the payment reference.",
      },
      { status: 500 }
    );
  }

  const result = data as { ok?: boolean; error?: string; rdm?: number; already_refunded?: boolean } | null;
  if (!result?.ok) {
    return NextResponse.json({ error: result?.error ?? "Refund refused" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    alreadyRefunded: result.already_refunded === true,
    rdm: result.rdm ?? null,
  });
}
