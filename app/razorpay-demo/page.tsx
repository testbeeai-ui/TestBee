"use client";

import { useEffect, useState } from "react";
import RazorpayCheckoutButton from "@/components/payments/RazorpayCheckoutButton";
import RazorpayPaymentHints from "@/components/payments/RazorpayPaymentHints";

export default function RazorpayDemoPage() {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground dark:text-white">
          Razorpay Standard Checkout
        </h1>
        {origin ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Current origin: {origin}
          </p>
        ) : null}
      </div>

      <div className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
        <p className="font-semibold">Website URL must match this origin</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-100/90">
          Razorpay Dashboard → Account &amp; Settings → Website &amp; app settings → set{" "}
          <code className="font-mono">{origin || "https://www.edublast.in"}</code> exactly.
        </p>
      </div>

      <div className="w-full rounded-xl border border-border bg-card p-6 dark:border-white/10 dark:bg-[#0c1017]">
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground dark:text-slate-400">Demo amount</span>
          <span className="font-semibold text-foreground dark:text-white">₹500.00</span>
        </div>
        <RazorpayPaymentHints amountPaise={50000} className="mb-4" />
        <RazorpayCheckoutButton
          amount={50000}
          currency="INR"
          description="Razorpay demo payment"
        />
      </div>
    </main>
  );
}
