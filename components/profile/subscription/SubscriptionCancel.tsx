"use client";

import { useState } from "react";
import { CircleMinus, X, Check, ArrowDown, Heart, Info } from "lucide-react";
import type { SubViewId } from "./StudentSubscriptionHub";

interface Props {
  onNavigate: (view: SubViewId) => void;
}

const REASONS = [
  "Too expensive for me right now",
  "Not using Testbee enough",
  "Switching to a different platform",
  "Exam is over — no longer need it",
  "Technical issues with the platform",
  "Missing a feature I need",
  "Other reason",
];

export default function SubscriptionCancel({ onNavigate }: Props) {
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (cancelled) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <Check className="h-10 w-10 text-emerald-400" />
        <p className="text-lg font-bold text-foreground dark:text-white">Auto-renewal cancelled</p>
        <p className="text-sm text-muted-foreground dark:text-slate-400">
          You retain Scholar access until <span className="font-semibold text-foreground dark:text-white">14 Nov 2026</span>.
          You can re-enable auto-renewal anytime before that date.
        </p>
        <button
          onClick={() => onNavigate("overview")}
          className="mt-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Back to overview
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-rose-500/30 bg-card p-4 dark:bg-[#0c1017]">
        <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <CircleMinus className="h-4 w-4 text-rose-400" />
          <span className="text-sm font-semibold text-foreground dark:text-white">Cancel subscription</span>
          <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Active</span>
        </div>

        <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
          <p className="text-sm font-semibold text-rose-300">Are you sure you want to cancel?</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-300/80">
            Your Scholar plan is active until <span className="font-semibold text-rose-200">14 November 2026</span>.
            If you cancel today, you will retain full access until that date.
            No pro-rated refund is provided for annual plans (but you may request one within 7 days of renewal).
          </p>
        </div>

        <p className="mt-4 text-xs font-semibold text-muted-foreground dark:text-slate-400">What you will lose after 14 Nov 2026</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {[
            "Testbee adaptive mocks — reverts to 2 mocks/month",
            "Full Instacue library — limited to 20 saved cards",
            "Live classes access — loses enrolment ability",
            "EduFund Scholar eligibility — reverts to Sprout tier",
          ].map((item) => (
            <div key={item} className="flex items-start gap-1.5 text-xs text-rose-300/80">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              {item}
            </div>
          ))}
          <div className="flex items-start gap-1.5 text-xs text-emerald-400">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            Your account, RDM balance, and Gyan++ history are kept forever
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium text-muted-foreground dark:text-slate-400">
            Reason for cancelling <span className="text-rose-400">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-muted-foreground/20 bg-muted px-3 py-2 text-sm text-foreground focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            <option value="">Select a reason</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted p-3 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-semibold text-foreground dark:text-white">Before you cancel — have you considered?</p>
          <div className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground dark:text-slate-400">
            <div className="flex items-start gap-1.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              Pausing auto-renewal — you keep full access until expiry, with no future charge.
            </div>
            <div className="flex items-start gap-1.5">
              <ArrowDown className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              Downgrading to monthly billing — ₹499/month, no long-term commitment.
            </div>
            <div className="flex items-start gap-1.5">
              <Heart className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Your EduFund grant eligibility resets if you drop below Scholar tier — you have earned 2,340 RDM.
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate("overview")}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
          >
            Keep my subscription
          </button>
          <button
            onClick={() => onNavigate("overview")}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 px-4 py-2 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/10"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Switch to monthly
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
          >
            <CircleMinus className="h-3.5 w-3.5" />
            Cancel auto-renewal
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="flex items-center justify-center rounded-xl bg-black/60 p-8">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 dark:border-white/10 dark:bg-[#0c1017]">
            <div className="flex items-center gap-2">
              <CircleMinus className="h-5 w-5 text-rose-400" />
              <p className="text-base font-bold text-foreground dark:text-white">Confirm cancellation</p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground dark:text-slate-400">
              Auto-renewal will be turned off. You will retain Scholar access until{" "}
              <span className="font-semibold text-foreground dark:text-white">14 November 2026</span>,
              then revert to the Free tier. This action can be undone by re-enabling auto-renewal before the expiry date.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
              >
                Go back
              </button>
              <button
                onClick={() => { setConfirmOpen(false); setCancelled(true); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
              >
                <Check className="h-4 w-4" />
                Yes, cancel renewal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
