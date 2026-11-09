import type { SupabaseClient } from "@supabase/supabase-js";

type AdminDb = SupabaseClient;

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type CommitRdmPackPurchaseResult = {
  balance: number;
  alreadyCredited: boolean;
};

/** Credits the coupon and writes the pack row in one transaction. */
export async function commitRdmPackPurchase(
  admin: AdminDb,
  input: {
    teacherId: string;
    couponId: string;
    packId: string;
    amountPaise: number;
    razorpayOrderId: string;
    razorpayPaymentId: string;
  }
): Promise<CommitRdmPackPurchaseResult> {
  const { data, error } = await (admin as unknown as RpcClient).rpc("commit_rdm_pack_purchase", {
    p_teacher_id: input.teacherId,
    p_coupon_id: input.couponId,
    p_pack_id: input.packId,
    p_amount_paise: input.amountPaise,
    p_razorpay_order_id: input.razorpayOrderId,
    p_razorpay_payment_id: input.razorpayPaymentId,
  });
  if (error) throw new Error(error.message);
  const body = data as {
    ok?: boolean;
    error?: string;
    rdm?: number;
    already_credited?: boolean;
  } | null;
  if (!body?.ok || typeof body.rdm !== "number" || !Number.isFinite(body.rdm)) {
    throw new Error(body?.error ?? "Could not record the RDM pack");
  }
  return {
    balance: Math.max(0, Math.round(body.rdm)),
    alreadyCredited: body.already_credited === true,
  };
}
