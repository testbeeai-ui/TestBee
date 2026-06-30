"use client";

import { useMemo } from "react";
import { Crown, Zap, ArrowUp, AlertTriangle } from "lucide-react";
import type { SubViewId } from "./StudentSubscriptionHub";
import type { Profile } from "@/hooks/useAuth";
import { normalizePlanTier } from "@/lib/subscription/subscriptionConfig";
import {
  computePaidSubscriptionPeriod,
  resolveSubscriptionNowMs,
} from "@/lib/subscription/subscriptionBilling";

interface Props {
  profile: Profile;
  onNavigate: (view: SubViewId) => void;
}

export default function SubscriptionOverview({ profile, onNavigate }: Props) {
  const planKey = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
  
  const planNames = {
    free: "Free Plan",
    free_trial: "Free Trial",
    starter: "Starter Plan",
    pro: "Pro Plan",
  };
  const planName = planNames[planKey] || "Free Plan";

  const isTrial = planKey === "free_trial";
  const isPaid = planKey === "starter" || planKey === "pro";
  const isFree = planKey === "free";

  let startDateLabel = "";
  let endDateLabel = "";
  let expiresOnLabel = "";
  let remainingDaysText = "";
  let percentUsed = 0;
  let remainingDaysVal = 0;
  let totalDaysVal = 0;
  let billingRateLabel = "Rs 0";
  let inBonusMonth = false;

  const nowMs = resolveSubscriptionNowMs(profile);

  if (isPaid) {
    const period = computePaidSubscriptionPeriod(profile, nowMs);
    if (period) {
      const startDate = new Date(period.startMs);
      const endDate = new Date(period.endMs);
      startDateLabel = `Start: ${startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
      endDateLabel = `Expires: ${endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
      expiresOnLabel = endDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      remainingDaysText = `${period.remainingDays} days remaining`;
      percentUsed = period.percentUsed;
      remainingDaysVal = period.remainingDays;
      totalDaysVal = period.totalDays;
      billingRateLabel = period.billingRateLabel;
      inBonusMonth = period.inBonusMonth;
    }
  } else if (isTrial) {
    const startIso = profile?.free_trial_activated_at || profile?.created_at || new Date().toISOString();
    const startDate = new Date(startIso);
    const durationDays = profile?.trial_second_round_activated ? 28 : 14;
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const diffTime = endDate.getTime() - nowMs;
    const remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, durationDays - remainingDays);
    const pct = Math.min(100, Math.round((elapsedDays / durationDays) * 100));

    startDateLabel = `Start: ${startDate.toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' })}`;
    endDateLabel = `Expires: ${endDate.toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' })}`;
    expiresOnLabel = endDate.toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' });
    remainingDaysText = `${remainingDays} days remaining`;
    percentUsed = pct;
    remainingDaysVal = remainingDays;
    totalDaysVal = durationDays;
  } else {
    const startIso = profile?.created_at || new Date().toISOString();
    const startDate = new Date(startIso);
    startDateLabel = `Start: ${startDate.toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' })}`;
    endDateLabel = "Lifetime access";
    expiresOnLabel = "Never";
    remainingDaysText = "Unlimited access";
    percentUsed = 100;
    remainingDaysVal = 0;
    totalDaysVal = 0;
  }

  // Read auto-renewal status from card details
  const parsedCardDetails = useMemo(() => {
    if (!profile?.payment_card_details) return null;
    try {
      return typeof profile.payment_card_details === "string"
        ? JSON.parse(profile.payment_card_details)
        : profile.payment_card_details;
    } catch {
      return null;
    }
  }, [profile?.payment_card_details]);

  const autoRenewActive = isPaid && parsedCardDetails?.autoRenew !== false;

  // Dynamic Payment Method
  let paymentMethodLabel = "";
  if (profile?.payment_card_details) {
    try {
      const card = typeof profile.payment_card_details === "string"
        ? JSON.parse(profile.payment_card_details)
        : profile.payment_card_details;
      if (card) {
        const type = card.type || (card.cardNumber ? "card" : "upi");
        if (type === "card" && card.cardNumber) {
          const last4 = card.cardNumber.replace(/\s/g, "").slice(-4);
          paymentMethodLabel = `Card (Visa •••• ${last4})`;
        } else if (type === "upi" && card.upiId) {
          paymentMethodLabel = `UPI (${card.upiId})`;
        } else if (type === "netbanking" && card.bankName) {
          paymentMethodLabel = `Net banking (${card.bankName.toUpperCase()})`;
        } else if (type === "wallet" && card.walletName) {
          paymentMethodLabel = `Wallet (${card.walletName.toUpperCase()})`;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Dynamic Benefits
  const benefits = {
    free: [
      "Magic Wall: up to 2 active topics",
      "Gyan++ doubts: 1 per day limit",
      "Testbee mocks: 3 per month (max 6 tests total)",
      "DailyDose: 5 questions per day",
      "AI Calendar — basic study planner",
      "EduFund Sprout tier eligibility",
    ],
    free_trial: [
      "Magic Wall: up to 3 active topics",
      "Gyan++ doubts: 1 per day limit",
      "Testbee mocks: 3 per month",
      "DailyDose: 5 questions per day",
      "AI Calendar — basic study planner",
      "EduFund preview active",
    ],
    starter: [
      "Testbee adaptive mocks — unlimited",
      "Instacue spaced revision library — full access",
      "Live lessons + recorded library",
      "MentaMill quant speed training",
      "AI Calendar — smart study planner",
      "EduFund Starter tier eligibility",
    ],
    pro: [
      "Testbee adaptive mocks — unlimited",
      "Instacue spaced revision library — full access",
      "Live lessons + recorded library (unlimited)",
      "Topper community access & 1-on-1 mentor sessions",
      "AI Calendar — smart study planner",
      "EduFund Pro tier eligibility",
    ],
  }[planKey] || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Current Plan
          </p>
          <p className="mt-2 text-xl font-black tracking-tight text-emerald-400">{planName}</p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            Active
          </span>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Expires On
          </p>
          <p className="mt-2 text-xl font-bold tracking-tight text-white">{expiresOnLabel}</p>
          <p className="mt-1.5 text-xs font-semibold text-slate-400">{remainingDaysText}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Billing Rate
          </p>
          <p className="mt-2 text-xl font-bold tracking-tight text-white">{billingRateLabel}</p>
          <p className="mt-1.5 text-xs font-semibold text-slate-400">
            {isPaid
              ? inBonusMonth
                ? "Free bonus month — no charge yet"
                : "Auto-renewal active"
              : "No active charges"}
          </p>
        </div>
      </div>

      {/* Expiry tracker - only show when not forever free */}
      {!isFree && (
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-4">
            <Crown className="h-4.5 w-4.5 text-emerald-400 shadow-sm" />
            <span className="text-sm font-bold tracking-wide text-white">
              Subscription Period Tracker
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400">{startDateLabel}</span>
            <span className="font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full text-[11px]">
              {remainingDaysVal} days left of {totalDaysVal}
            </span>
            <span className="font-semibold text-slate-400">{endDateLabel}</span>
          </div>
          <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-slate-900 border border-white/5 shadow-inner">
            <div
              style={{ width: `${percentUsed}%` }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">
            {percentUsed}% of subscription period used
            {inBonusMonth
              ? ` · Free bonus month ends ${expiresOnLabel}; billing starts after unless cancelled.`
              : autoRenewActive
                ? ` · Auto-renews on ${expiresOnLabel} unless cancelled.`
                : ` · Subscription ends on ${expiresOnLabel} (auto-renewal off).`}
          </p>
          
          {autoRenewActive ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <Zap className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-400 animate-pulse" />
              <p className="text-xs leading-relaxed text-amber-200/90 font-medium">
                {inBonusMonth
                  ? `Your first month on ${planName} is free (trial-end bonus). After ${expiresOnLabel}, `
                  : "Auto-renewal is active. "}
                {billingRateLabel.split(" ")[0]} will be charged to {paymentMethodLabel || "your saved payment method"} on {expiresOnLabel}.{" "}
                <button
                  onClick={() => onNavigate("cancel")}
                  className="font-bold text-amber-300 underline underline-offset-2 hover:text-amber-200"
                >
                  Turn off auto-renewal
                </button>{" "}
                or{" "}
                <button
                  onClick={() => onNavigate("payment")}
                  className="font-bold text-amber-300 underline underline-offset-2 hover:text-amber-200"
                >
                  update payment method
                </button>
                .
              </p>
            </div>
          ) : isPaid ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
              <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-400" />
              <p className="text-xs leading-relaxed text-rose-200/90 font-medium">
                Auto-renewal has been turned off. Your premium benefits remain fully active until{" "}
                <span className="font-bold text-white">{expiresOnLabel}</span>. After this date, your
                account will automatically transition to the Free plan. To keep your plan active, click{" "}
                <button
                  onClick={() => onNavigate("plans")}
                  className="font-bold text-rose-300 underline underline-offset-2 hover:text-rose-200"
                >
                  Choose a plan
                </button>
                .
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Plan features */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-4">
          <Zap className="h-4.5 w-4.5 text-emerald-400" />
          <span className="text-sm font-bold tracking-wide text-white">{planName} Benefits</span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {benefits.map((f) => (
            <div key={f} className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                <span className="text-[10px]">✓</span>
              </div>
              <span className="leading-5">{f}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {planKey !== "pro" ? (
            <button
              onClick={() => onNavigate("plans")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.5)] transition-all active:scale-[0.98]"
            >
              <ArrowUp className="h-4 w-4" />
              {isPaid ? "Upgrade to Pro" : "Choose a Plan"}
            </button>
          ) : (
            <button
              onClick={() => onNavigate("plans")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_20px_rgba(139,92,246,0.5)] transition-all active:scale-[0.98]"
            >
              Change subscription plan
            </button>
          )}
          {isPaid && (
            <button
              onClick={() => onNavigate("cancel")}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
            >
              Manage Renewal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
