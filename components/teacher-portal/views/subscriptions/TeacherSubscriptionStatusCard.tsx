"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CircleMinus,
  Crown,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { teacherPlanDisplayName } from "@/lib/teacherPortal/teacherPlan";
import type { TeacherPlanKey } from "@/lib/teacherPortal/teacherPlan";

export type TeacherSubscriptionStatus = {
  planKey: TeacherPlanKey;
  startedAt: string;
  expiresAt: string;
  totalDays: number;
  remainingDays: number;
  percentUsed: number;
  billingRateLabel: string;
  isCouponGrant: boolean;
  autoRenewActive: boolean;
};

type Props = {
  tier: TeacherPlanKey;
  subscription: TeacherSubscriptionStatus;
  onChanged: () => Promise<void>;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TeacherSubscriptionStatusCard({ tier, subscription, onChanged }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const expiresLabel = formatDate(subscription.expiresAt);
  const startedLabel = formatDate(subscription.startedAt);
  const planName = teacherPlanDisplayName(tier);

  const handleCancelRenewal = async () => {
    setLoading(true);
    try {
      const res = await fetchWithClientAuth("/api/teacher/subscription/cancel-renewal", {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not cancel renewal");
      await onChanged();
      setConfirmCancel(false);
      toast({
        title: "Auto-renewal turned off",
        description: `Your ${planName} stays active until ${expiresLabel}.`,
      });
    } catch (e) {
      toast({
        title: "Cancellation failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResumeRenewal = async () => {
    setLoading(true);
    try {
      const res = await fetchWithClientAuth("/api/teacher/subscription/resume-renewal", {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not resume renewal");
      await onChanged();
      toast({
        title: "Auto-renewal re-enabled",
        description: `Your plan will renew on ${expiresLabel}.`,
      });
    } catch (e) {
      toast({
        title: "Could not re-enable",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative border-t border-white/[0.06] px-5 py-5 md:px-7 md:py-6">
      <div className="mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-bold text-white">Your subscription</h3>
        <span className="text-xs text-slate-500">Billing &amp; renewal</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Current plan
          </p>
          <p className="mt-2 text-lg font-bold text-violet-200">{planName}</p>
          <span className="mt-2 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            Active
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            {subscription.autoRenewActive ? "Renews on" : "Ends on"}
          </p>
          <p className="mt-2 text-lg font-bold text-white">{expiresLabel}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            {subscription.remainingDays} days remaining
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Billing
          </p>
          <p className="mt-2 text-lg font-bold text-white">{subscription.billingRateLabel}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            {subscription.isCouponGrant
              ? "No recurring charge"
              : subscription.autoRenewActive
                ? "Auto-renewal on"
                : "Auto-renewal off"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 md:p-5">
        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
          <Crown className="h-4 w-4 text-violet-300" />
          <span className="text-sm font-bold text-white">Billing period</span>
          <span className="ml-auto rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-violet-200">
            {subscription.remainingDays} / {subscription.totalDays} days left
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span>Started {startedLabel}</span>
          <span>{subscription.autoRenewActive ? "Renews" : "Ends"} {expiresLabel}</span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full border border-white/5 bg-slate-900/80">
          <div
            style={{ width: `${subscription.percentUsed}%` }}
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-500"
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {subscription.percentUsed}% of this billing period used
          {subscription.isCouponGrant
            ? ` · Coupon access ends ${expiresLabel}.`
            : subscription.autoRenewActive
              ? ` · Auto-renews on ${expiresLabel} unless you cancel.`
              : ` · Access ends ${expiresLabel} (no further charge).`}
        </p>

        {subscription.isCouponGrant ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <p className="text-xs leading-relaxed text-sky-100/90">
              This plan was granted via admin coupon. It does not auto-renew — subscribe below
              before {expiresLabel} to keep live lessons and assignment limits.
            </p>
          </div>
        ) : subscription.autoRenewActive ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-xs leading-relaxed text-amber-100/90">
                Auto-renewal is on. {subscription.billingRateLabel} will be charged on{" "}
                {expiresLabel} via Razorpay.
              </p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirmCancel(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-[11px] font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              <CircleMinus className="h-3.5 w-3.5" />
              Cancel auto-renewal
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <p className="text-xs leading-relaxed text-rose-100/90">
                Auto-renewal is off. You keep full {planName} access until {expiresLabel}, then
                revert to Grassroots (Free).
              </p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleResumeRenewal()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-[11px] font-bold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Re-enable auto-renewal
            </button>
          </div>
        )}
      </div>

      {confirmCancel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f1329] p-5 shadow-2xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-rose-300" />
              <p className="text-base font-bold text-white">Turn off auto-renewal?</p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              You will keep {planName} until <span className="font-semibold text-white">{expiresLabel}</span>.
              After that, your account moves to the free tier. No refund for the current month.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirmCancel(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5"
              >
                Keep renewal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleCancelRenewal()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
