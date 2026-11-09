import type { SupabaseClient } from "@supabase/supabase-js";

type AdminDb = SupabaseClient;

export async function recordRdmPackPurchase(
  admin: AdminDb,
  input: {
    teacherId: string;
    packId: string;
    rdmGranted: number;
    amountPaise: number;
    razorpayOrderId: string;
    razorpayPaymentId: string;
  }
): Promise<void> {
  const db = admin as AdminDb & { from: (table: string) => any };
  const { data: existing } = await db
    .from("rdm_pack_purchases")
    .select("id")
    .eq("razorpay_order_id", input.razorpayOrderId)
    .maybeSingle();
  if (existing?.id) return;

  const { error } = await db.from("rdm_pack_purchases").insert({
    teacher_id: input.teacherId,
    pack_id: input.packId,
    rdm_granted: input.rdmGranted,
    rdm_unspent: input.rdmGranted,
    amount_paise: input.amountPaise,
    razorpay_order_id: input.razorpayOrderId,
    razorpay_payment_id: input.razorpayPaymentId,
    status: "paid",
  });
  if (error) throw new Error(error.message);
}
