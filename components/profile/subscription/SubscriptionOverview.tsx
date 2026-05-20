"use client";

import { Crown, Zap, ArrowUp, Settings } from "lucide-react";
import type { SubViewId } from "./StudentSubscriptionHub";

interface Props {
  onNavigate: (view: SubViewId) => void;
}

export default function SubscriptionOverview({ onNavigate }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
          <p className="text-xs text-muted-foreground dark:text-slate-500">Current plan</p>
          <p className="mt-1 text-lg font-bold text-emerald-400">Scholar</p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
            Active
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
          <p className="text-xs text-muted-foreground dark:text-slate-500">Expires on</p>
          <p className="mt-1 text-base font-bold text-foreground dark:text-white">14 Nov 2026</p>
          <p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">179 days remaining</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
          <p className="text-xs text-muted-foreground dark:text-slate-500">Billed</p>
          <p className="mt-1 text-base font-bold text-foreground dark:text-white">₹3,999 / yr</p>
          <p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">Auto-renewal on</p>
        </div>
      </div>

      {/* Expiry tracker */}
      <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
        <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <Crown className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-foreground dark:text-white">Subscription expiry tracker</span>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-muted-foreground dark:text-slate-500">Start: 14 May 2026</span>
          <span className="font-semibold text-emerald-400">179 days left of 365</span>
          <span className="text-muted-foreground dark:text-slate-500">Expires: 14 Nov 2026</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted dark:bg-white/10">
          <div className="h-full w-[51%] rounded-full bg-emerald-500" />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground dark:text-slate-500">
          51% of subscription period used · auto-renews 14 Nov 2026 unless cancelled
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-200">
            Auto-renewal is active. ₹3,999 will be charged to UPI — rahul@paytm on 14 Nov 2026.{" "}
            <button onClick={() => onNavigate("cancel")} className="font-semibold text-amber-100 underline underline-offset-2">
              Turn off auto-renewal
            </button>{" "}
            or{" "}
            <button onClick={() => onNavigate("payment")} className="font-semibold text-amber-100 underline underline-offset-2">
              update payment method
            </button>.
          </p>
        </div>
      </div>

      {/* Plan features */}
      <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
        <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <Zap className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-foreground dark:text-white">Scholar plan — what you get</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {["Testbee adaptive mocks — unlimited", "Instacue spaced revision library — full access", "Live classes + recorded library", "MentaMill quant speed training", "AI Calendar — smart study planner", "EduFund Scholar tier eligibility"].map((f) => (
            <div key={f} className="flex items-start gap-2 text-xs text-muted-foreground dark:text-slate-300">
              <span className="mt-0.5 text-emerald-400">✓</span>
              {f}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => onNavigate("plans")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Upgrade to Champion
          </button>
          <button
            onClick={() => onNavigate("cancel")}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
          >
            Manage renewal
          </button>
        </div>
      </div>
    </div>
  );
}
