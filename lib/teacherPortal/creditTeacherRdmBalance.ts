import type { SupabaseClient } from "@supabase/supabase-js";

type AdminDb = SupabaseClient;

export async function readTeacherRdmBalance(
  admin: AdminDb,
  userId: string
): Promise<number> {
  const { data, error } = await admin
    .from("profiles")
    .select("rdm")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Math.max(0, Number(data?.rdm ?? 0));
}

/** Credits RDM via add_rdm; throws if the RPC returns no balance (e.g. missing profile). */
export async function creditTeacherRdmBalance(
  admin: AdminDb,
  userId: string,
  amount: number
): Promise<number> {
  const amt = Math.round(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error("Invalid RDM credit amount");
  }

  const { data: newBalance, error } = await admin.rpc("add_rdm", {
    uid: userId,
    amt,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (typeof newBalance !== "number" || !Number.isFinite(newBalance)) {
    throw new Error("Failed to credit RDM — balance was not updated");
  }

  return Math.max(0, Math.round(newBalance));
}

export type PurchasedCouponRow = {
  id: string;
  code: string;
  rdm_amount: number;
  status: string;
  balance_applied_at?: string | null;
  redeemed_at?: string | null;
  redeemed_by_teacher_id?: string | null;
};

/** Idempotent: credits once per coupon row (tracks balance_applied_at). */
export async function applyPurchasedCouponRdmCredit(
  admin: AdminDb,
  userId: string,
  coupon: PurchasedCouponRow
): Promise<number> {
  if (coupon.balance_applied_at) {
    return readTeacherRdmBalance(admin, userId);
  }

  const newBalance = await creditTeacherRdmBalance(admin, userId, coupon.rdm_amount);
  const now = new Date().toISOString();

  const { error: updateError } = await (admin as AdminDb & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
  })
    .from("coupons")
    .update({
      balance_applied_at: now,
      status: "redeemed",
      redeemed_at: coupon.redeemed_at ?? now,
      redeemed_by_teacher_id: coupon.redeemed_by_teacher_id ?? userId,
    })
    .eq("id", coupon.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return newBalance;
}
