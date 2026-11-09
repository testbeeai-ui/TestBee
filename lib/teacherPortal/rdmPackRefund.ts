export type PackRefundPurchase = {
  status: string;
  rdmGranted: number;
  rdmUnspent: number;
};

/** A pack is refundable only while every RDM from that purchase is still unused. */
export function packRefundBlockReason(purchase: PackRefundPurchase): string | null {
  if (purchase.status === "refunded") return "already_refunded";
  if (
    !Number.isInteger(purchase.rdmGranted) ||
    purchase.rdmGranted <= 0 ||
    !Number.isInteger(purchase.rdmUnspent) ||
    purchase.rdmUnspent < 0
  ) {
    return "invalid_pack";
  }
  if (purchase.status === "refund_pending") {
    return purchase.rdmUnspent === purchase.rdmGranted ? null : "pack_used";
  }
  if (purchase.status !== "paid") return "not_paid";
  if (purchase.rdmUnspent !== purchase.rdmGranted) return "pack_used";
  return null;
}
