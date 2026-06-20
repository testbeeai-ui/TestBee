"use client";

import { useMemo, useState } from "react";
import { Receipt, Info } from "lucide-react";
import type { Profile } from "@/hooks/useAuth";
import type { SubViewId } from "./StudentSubscriptionHub";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import RazorpayCheckoutButton from "@/components/payments/RazorpayCheckoutButton";
import { computeSubscriptionCheckoutSummary } from "@/lib/subscription/subscriptionCheckoutSummary";
import type { PaidSubscriptionPlan } from "@/lib/subscription/subscriptionCheckoutSummary";

interface Props {
  profile: Profile;
  onNavigate: (view: SubViewId) => void;
}

function readStoredCheckoutPlan(): PaidSubscriptionPlan {
  if (typeof window === "undefined") return "starter";
  const p = localStorage.getItem("testbee_checkout_plan");
  return p === "starter" || p === "pro" ? p : "starter";
}

function readStoredBillingMode(): "monthly" | "annual" {
  if (typeof window === "undefined") return "monthly";
  const m = localStorage.getItem("testbee_checkout_billing_mode");
  return m === "monthly" || m === "annual" ? m : "monthly";
}

export default function SubscriptionCheckout({ profile, onNavigate }: Props) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [checkoutPlan] = useState(readStoredCheckoutPlan);
  const [billingMode] = useState(readStoredBillingMode);

  const planName = checkoutPlan === "pro" ? "Pro Plan" : "Starter Plan";

  const summary = useMemo(
    () => computeSubscriptionCheckoutSummary(checkoutPlan, billingMode),
    [checkoutPlan, billingMode],
  );

  const handlePaymentVerified = async (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    const res = await fetch("/api/user/subscription/activate-after-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        ...response,
        plan: checkoutPlan,
        billingCycle: billingMode,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error ?? "Could not activate subscription");
    }

    toast({
      title: "Payment successful",
      description: `Welcome to the ${planName}! Your subscription is now active.`,
    });

    await refreshProfile();
    onNavigate("overview");
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-foreground dark:text-white">
        Complete payment via Razorpay
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
            <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
              <Receipt className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-foreground dark:text-white">
                Order summary
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2 text-xs">
              <div className="flex justify-between border-b border-border pb-2 dark:border-white/10">
                <span className="text-muted-foreground dark:text-slate-400">
                  {planName} — {billingMode}
                </span>
                <span className="font-semibold text-foreground dark:text-white">
                  ₹{summary.baseInr}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 dark:border-white/10">
                <span className="text-muted-foreground dark:text-slate-400">
                  Scholar credit (unused)
                </span>
                <span className="font-semibold text-emerald-400">-₹{summary.creditInr}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 dark:border-white/10">
                <span className="text-muted-foreground dark:text-slate-400">GST (18%)</span>
                <span className="font-semibold text-foreground dark:text-white">
                  ₹{summary.gstInr}
                </span>
              </div>
              <div className="flex justify-between pt-2 text-sm">
                <span className="font-semibold text-foreground dark:text-white">
                  Total due today
                </span>
                <span className="font-bold text-emerald-400">₹{summary.totalInr}</span>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-500/10 p-3 text-xs leading-relaxed text-blue-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Pro-rated Scholar credit for the unused billing period has been applied. Payments are
              processed securely by Razorpay — we never store card or UPI details.
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
          <p className="mb-3 text-xs text-muted-foreground dark:text-slate-400">
            You will be redirected to Razorpay&apos;s secure checkout. In test mode, use{" "}
            <strong>Netbanking</strong> → any bank → <strong>Success</strong> for the most reliable
            mock payment.
          </p>
          <RazorpayCheckoutButton
            amount={summary.amountPaise}
            description={`${planName} — ${billingMode}`}
            label={`Pay ₹${summary.totalInr} securely`}
            prefill={{
              name: profile.name || "Student",
              email: user?.email ?? undefined,
              contact: profile.phone ?? undefined,
            }}
            createOrderBody={{
              purpose: "subscription",
              plan: checkoutPlan,
              billingCycle: billingMode,
              currency: "INR",
            }}
            onPaymentVerified={handlePaymentVerified}
            showSuccessToast={false}
          />
          <p className="mt-3 text-center text-[10px] text-muted-foreground dark:text-slate-500">
            Secured by Razorpay · PCI-DSS compliant
          </p>
        </div>
      </div>
    </div>
  );
}
