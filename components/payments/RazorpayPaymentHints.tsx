"use client";

import {
  isRazorpayEmiEligible,
  razorpayKeyModeFromKeyId,
  type RazorpayKeyMode,
} from "@/lib/razorpay/razorpayCheckoutDisplay";

interface RazorpayPaymentHintsProps {
  amountPaise?: number;
  keyMode?: RazorpayKeyMode;
  className?: string;
}

function resolveKeyMode(keyMode?: RazorpayKeyMode): RazorpayKeyMode {
  if (keyMode && keyMode !== "unknown") return keyMode;
  return razorpayKeyModeFromKeyId(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
}

export default function RazorpayPaymentHints({
  amountPaise,
  keyMode,
  className,
}: RazorpayPaymentHintsProps) {
  const mode = resolveKeyMode(keyMode);
  const emiEligible = amountPaise != null ? isRazorpayEmiEligible(amountPaise) : null;

  return (
    <ul
      className={
        className ??
        "list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground dark:text-slate-400"
      }
    >
      <li>
        <strong>UPI:</strong> tap UPI → use <strong>Pay with UPI ID</strong> (not QR scan in test).
        {mode === "test" ? (
          <>
            {" "}
            Enter <span className="font-mono">success@razorpay</span> to mock success.
          </>
        ) : (
          <> Scan QR or pay with your UPI app.</>
        )}
      </li>
      <li>
        <strong>Netbanking:</strong>
        {mode === "test" ? (
          <> choose any bank → mock page → <strong>Success</strong>.</>
        ) : (
          <> select your bank and complete login.</>
        )}
      </li>
      <li>
        <strong>Cards / wallets / pay later / EMI</strong> appear when enabled on your Razorpay
        account.
        {emiEligible === false ? (
          <> EMI usually needs orders of ₹3,000+ (this order is below that).</>
        ) : null}
      </li>
    </ul>
  );
}
