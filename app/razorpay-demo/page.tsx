"use client";

import { useEffect, useState } from "react";
import RazorpayCheckoutButton from "@/components/payments/RazorpayCheckoutButton";

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

      <div className="w-full rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
        <p className="font-semibold">If checkout Continue / card gives 401 in console</p>
        <p className="mt-2 text-xs leading-relaxed text-red-100/90">
          Razorpay binds checkout to the <strong>Website URL</strong> in your dashboard. That URL
          must match where you pay — exactly.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-red-100/90">
          <li>
            Dashboard → <strong>Account &amp; Settings → Website &amp; app settings</strong>
          </li>
          <li>
            If website is <code className="font-mono">https://edublast.vercel.app</code>, pay there
            — not localhost.
          </li>
          <li>
            If testing locally, add <code className="font-mono">http://localhost:3000</code> as the
            website URL in the wizard / dashboard.
          </li>
          <li>
            Mismatch → <code className="font-mono">standard_checkout/payment/iin 401</code> and
            broken QR/cards.
          </li>
        </ul>
      </div>

      <div className="w-full rounded-xl border border-border bg-card p-6 dark:border-white/10 dark:bg-[#0c1017]">
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground dark:text-slate-400">Demo amount</span>
          <span className="font-semibold text-foreground dark:text-white">₹500.00</span>
        </div>
        <RazorpayCheckoutButton
          amount={50000}
          currency="INR"
          description="Razorpay demo payment"
        />
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-xs text-muted-foreground dark:text-slate-500">
          <li>
            Restart dev server after <code className="font-mono">next.config.ts</code> changes.
          </li>
          <li>
            Use <strong>Netbanking</strong> → any bank → mock <strong>Success</strong> (most reliable
            in test mode).
          </li>
          <li>
            Card test: <span className="font-mono">4111 1111 1111 1111</span>,{" "}
            <span className="font-mono">12/26</span>, CVV <span className="font-mono">123</span>.
          </li>
        </ol>
      </div>
    </main>
  );
}
