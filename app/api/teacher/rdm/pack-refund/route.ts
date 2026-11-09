import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";
import { getRazorpayClient, parseRazorpayError } from "@/lib/razorpay/razorpayClient";
import { packRefundBlockReason } from "@/lib/teacherPortal/rdmPackRefund";

const PURCHASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RAZORPAY_ALREADY_REFUNDED =
  /fully refunded|already been refunded|refunded already|already refunded/i;

type PackRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function packRpc(admin: unknown): PackRpc {
  return admin as PackRpc;
}

function razorpayDefinitelyRejected(message: string, status: number): boolean {
  if (status >= 400 && status < 500) return true;
  return /authentication|rejected this key pair/i.test(message);
}

const PAYOUT_INCONSISTENT =
  "Razorpay refunded the payment, but the wallet could not be updated. Contact billing@edublast.in with the payment reference.";

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
    .select("id, teacher_id, rdm_granted, rdm_unspent, amount_paise, razorpay_payment_id, status")
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

  const { data: reservedRaw, error: reserveErr } = await packRpc(admin).rpc(
    "reserve_rdm_pack_refund",
    {
      p_purchase_id: purchase.id,
      p_teacher_id: auth.user.id,
    }
  );
  if (reserveErr) {
    return NextResponse.json({ error: reserveErr.message }, { status: 500 });
  }
  const reserved = reservedRaw as {
    ok?: boolean;
    error?: string;
    already_refunded?: boolean;
    already_reserved?: boolean;
  } | null;
  if (reserved?.already_refunded) {
    return NextResponse.json({ ok: true, alreadyRefunded: true });
  }
  if (!reserved?.ok) {
    if (reserved?.error === "not_found") {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }
    if (reserved?.error === "insufficient_balance") {
      return NextResponse.json(
        { error: "Your RDM balance is below this pack, so the payment cannot be refunded." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "This pack has been used, so the payment cannot be refunded." },
      { status: 409 }
    );
  }

  const createdReservation = reserved.already_reserved !== true;
  let refundId = "";
  try {
    const refund = (await razorpay.payments.refund(purchase.razorpay_payment_id, {
      amount: purchase.amount_paise,
    })) as { id?: string };
    refundId = typeof refund?.id === "string" ? refund.id : "";
  } catch (e) {
    const parsed = parseRazorpayError(e);
    if (!RAZORPAY_ALREADY_REFUNDED.test(parsed.message)) {
      if (createdReservation && razorpayDefinitelyRejected(parsed.message, parsed.status)) {
        const { error: releaseErr } = await packRpc(admin).rpc("release_rdm_pack_refund", {
          p_purchase_id: purchase.id,
          p_teacher_id: auth.user.id,
        });
        if (releaseErr) {
          return NextResponse.json(
            {
              error:
                "Razorpay did not refund the payment, and the reserved RDM could not be restored. Contact billing@edublast.in.",
            },
            { status: 500 }
          );
        }
      }
      const status = parsed.status >= 400 && parsed.status < 600 ? parsed.status : 502;
      const error =
        createdReservation && !razorpayDefinitelyRejected(parsed.message, parsed.status)
          ? "The refund could not be confirmed with Razorpay. Try again in a moment. This pack stays reserved until the refund finishes."
          : parsed.message;
      return NextResponse.json({ error }, { status });
    }
  }

  const { data, error } = await packRpc(admin).rpc("finalize_rdm_pack_refund", {
    p_purchase_id: purchase.id,
    p_teacher_id: auth.user.id,
    p_razorpay_refund_id: refundId,
  });

  if (error) {
    return NextResponse.json({ error: PAYOUT_INCONSISTENT }, { status: 500 });
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    rdm?: number;
    already_refunded?: boolean;
  } | null;
  if (!result?.ok) {
    return NextResponse.json({ error: PAYOUT_INCONSISTENT }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    alreadyRefunded: result.already_refunded === true,
    rdm: result.rdm ?? null,
  });
}
