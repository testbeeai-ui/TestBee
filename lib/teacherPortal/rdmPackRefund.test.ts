import { describe, expect, it } from "vitest";
import { packRefundBlockReason } from "@/lib/teacherPortal/rdmPackRefund";

describe("packRefundBlockReason", () => {
  it("allows a paid pack that has not been spent", () => {
    expect(
      packRefundBlockReason({ status: "paid", rdmGranted: 1000, rdmUnspent: 1000 })
    ).toBeNull();
  });

  it("refuses a pack once any of its RDM is spent", () => {
    expect(packRefundBlockReason({ status: "paid", rdmGranted: 1000, rdmUnspent: 999 })).toBe(
      "pack_used"
    );
  });

  it("refuses a second refund", () => {
    expect(packRefundBlockReason({ status: "refunded", rdmGranted: 1000, rdmUnspent: 0 })).toBe(
      "already_refunded"
    );
  });

  it("does not treat an empty earned balance as a purchase", () => {
    expect(packRefundBlockReason({ status: "paid", rdmGranted: 0, rdmUnspent: 0 })).toBe(
      "invalid_pack"
    );
  });

  it("lets a reserved unused pack finish its refund", () => {
    expect(
      packRefundBlockReason({ status: "refund_pending", rdmGranted: 1000, rdmUnspent: 1000 })
    ).toBeNull();
  });
});
