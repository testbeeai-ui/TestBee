"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Crown, Loader2, Sparkles } from "lucide-react";
import RazorpayCheckoutButton from "@/components/payments/RazorpayCheckoutButton";
import { useToast } from "@/hooks/use-toast";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import {
  computeTeacherCheckoutSummary,
  type PaidTeacherPlan,
} from "@/lib/subscription/teacherCheckoutSummary";
import {
  TEACHER_PLAN_TIERS,
  teacherPlanDisplayName,
  type TeacherPlanKey,
} from "@/lib/teacherPortal/teacherPlan";
import {
  TeacherSubscriptionStatusCard,
  type TeacherSubscriptionStatus,
} from "@/components/teacher-portal/views/subscriptions/TeacherSubscriptionStatusCard";

type Props = {
  onPlanChanged: () => Promise<void>;
};

const PLAN_ACCENT: Record<TeacherPlanKey, { ring: string; badge: string; glow: string }> = {
  free: {
    ring: "border-white/10",
    badge: "bg-slate-500/15 text-slate-300 border-slate-500/25",
    glow: "from-slate-600/5",
  },
  starter: {
    ring: "border-violet-400/35",
    badge: "bg-violet-500/20 text-violet-200 border-violet-400/30",
    glow: "from-violet-600/15",
  },
  pro: {
    ring: "border-amber-400/40",
    badge: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    glow: "from-amber-500/12",
  },
};

export function TeacherPlanSubscriptionSection({ onPlanChanged }: Props) {
  const { toast } = useToast();
  const [tier, setTier] = useState<TeacherPlanKey>("free");
  const [subscription, setSubscription] = useState<TeacherSubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [planCouponCode, setPlanCouponCode] = useState("");
  const [claimingPlanCoupon, setClaimingPlanCoupon] = useState(false);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const res = await fetchWithClientAuth("/api/teacher/plan/limits");
      const body = (await res.json()) as {
        tier?: TeacherPlanKey;
        subscription?: TeacherSubscriptionStatus | null;
      };
      if (res.ok && body.tier) {
        setTier(body.tier);
        setSubscription(body.subscription ?? null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlan();
  }, []);

  const handlePlanPaymentVerified = async (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan: "starter" | "pro";
  }) => {
    const res = await fetchWithClientAuth("/api/teacher/subscription/activate-after-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Activation failed");
    await loadPlan();
    await onPlanChanged();
    toast({
      title: "Plan activated",
      description: `${teacherPlanDisplayName(response.plan)} is now active.`,
    });
  };

  const claimPlanCoupon = async () => {
    const code = planCouponCode.trim();
    if (!code) return;
    setClaimingPlanCoupon(true);
    try {
      const res = await fetchWithClientAuth("/api/teacher/coupons/claim-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Invalid coupon");
      setPlanCouponCode("");
      await loadPlan();
      await onPlanChanged();
      toast({ title: "Plan coupon claimed", description: body.message });
    } catch (e) {
      toast({
        title: "Could not claim coupon",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setClaimingPlanCoupon(false);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-b from-violet-950/35 via-[#0b0e16] to-slate-950/90 shadow-2xl shadow-violet-950/20">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-amber-500/8 blur-3xl" />

      <div className="relative border-b border-white/[0.06] px-5 py-5 md:px-7 md:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-400/20">
                <Crown className="h-4 w-4 text-violet-300" />
              </span>
              <h2 className="text-lg font-bold tracking-tight text-white md:text-xl">
                Teacher subscription
              </h2>
            </div>
            <p className="max-w-xl text-xs leading-relaxed text-slate-400 md:text-sm">
              Unlock live lesson slots, assignment limits, and directory visibility. Pay monthly via
              Razorpay — UPI, cards, or wallets.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Current plan
            </p>
            <p className="text-sm font-bold text-violet-200">
              {loading ? "Loading…" : teacherPlanDisplayName(tier)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative grid gap-4 p-5 md:grid-cols-3 md:p-7 md:pt-6">
        {TEACHER_PLAN_TIERS.map((plan) => {
          const isCurrent = plan.id === tier;
          const paidPlan: PaidTeacherPlan | null =
            plan.id === "starter" ? "starter" : plan.id === "pro" ? "pro" : null;
          const isPaid = paidPlan !== null;
          const summary = paidPlan ? computeTeacherCheckoutSummary(paidPlan) : null;
          const accent = PLAN_ACCENT[plan.id];
          const isPopular = plan.id === "starter" && tier === "free";
          const isPremium = plan.id === "pro";

          return (
            <article
              key={plan.id}
              className={`relative flex min-h-[340px] flex-col rounded-2xl border bg-gradient-to-b ${accent.glow} to-transparent p-5 transition ${
                isCurrent
                  ? `${accent.ring} bg-white/[0.04] ring-1 ring-inset ring-white/10`
                  : isPopular
                    ? "border-violet-400/30 bg-violet-500/[0.04] shadow-lg shadow-violet-900/20"
                    : isPremium
                      ? "border-amber-400/25 bg-amber-500/[0.03]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/15"
              }`}
            >
              {isCurrent ? (
                <span
                  className={`absolute -top-2.5 left-4 rounded-lg border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${accent.badge}`}
                >
                  Current plan
                </span>
              ) : isPopular ? (
                <span className="absolute -top-2.5 left-4 rounded-lg bg-violet-400 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#0b0e16]">
                  Popular
                </span>
              ) : isPremium ? (
                <span className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                  <Sparkles className="h-3 w-3" />
                  Pro
                </span>
              ) : null}

              <header className="mb-4 pt-1">
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{plan.tagline}</p>
              </header>

              <div className="mb-5 border-b border-white/[0.06] pb-4">
                {plan.priceInr != null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-3xl font-extrabold tracking-tight text-white">
                        ₹{plan.priceInr}
                      </span>
                      <span className="text-xs font-medium text-slate-500">/mo</span>
                    </div>
                    {summary ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        +18% GST →{" "}
                        <span className="font-semibold text-slate-300">₹{summary.totalInr}</span>{" "}
                        billed monthly
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="font-mono text-3xl font-extrabold tracking-tight text-white">
                    Free
                  </div>
                )}
              </div>

              <ul className="mb-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-[11px] leading-snug text-slate-300">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                {isCurrent ? (
                  isPaid && subscription && !subscription.isCouponGrant ? (
                    subscription.autoRenewActive ? (
                      <div className="flex items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 py-3 text-[11px] font-bold uppercase tracking-wide text-emerald-200">
                        Active · renews {new Date(subscription.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 py-3 text-[11px] font-bold uppercase tracking-wide text-amber-200">
                        Active until {new Date(subscription.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Active on your account
                    </div>
                  )
                ) : paidPlan ? (
                  <RazorpayCheckoutButton
                    amount={summary!.amountPaise}
                    label={`Subscribe — ₹${summary!.totalInr}`}
                    createOrderBody={{
                      purpose: "teacher_subscription",
                      plan: paidPlan,
                    }}
                    onPaymentVerified={async (r) =>
                      handlePlanPaymentVerified({ ...r, plan: paidPlan })
                    }
                    showLockIcon={false}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-violet-500 py-3 text-xs font-bold text-white transition hover:bg-violet-400 disabled:opacity-60"
                  />
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {subscription && (tier === "starter" || tier === "pro") ? (
        <TeacherSubscriptionStatusCard
          tier={tier}
          subscription={subscription}
          onChanged={async () => {
            await loadPlan();
            await onPlanChanged();
          }}
        />
      ) : null}

      <div className="relative border-t border-white/[0.06] bg-black/20 px-5 py-4 md:px-7">
        <p className="mb-2.5 text-[11px] font-semibold text-slate-400">
          Have a plan coupon from admin?
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={planCouponCode}
            onChange={(e) => setPlanCouponCode(e.target.value.toUpperCase())}
            placeholder="Plan coupon code"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-mono tracking-wider text-white placeholder:text-slate-600 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            disabled={claimingPlanCoupon || !planCouponCode.trim()}
            onClick={() => void claimPlanCoupon()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/20 px-5 py-2.5 text-xs font-bold text-violet-100 transition hover:bg-violet-500/35 disabled:opacity-50"
          >
            {claimingPlanCoupon ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                Claim plan coupon
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
