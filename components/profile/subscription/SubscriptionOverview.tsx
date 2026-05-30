"use client";

import { Crown, Zap, ArrowUp, Settings } from "lucide-react";
import type { SubViewId } from "./StudentSubscriptionHub";

interface Props {
  onNavigate: (view: SubViewId) => void;
}

export default function SubscriptionOverview({ onNavigate }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Current Plan
          </p>
          <p className="mt-2 text-xl font-black tracking-tight text-emerald-400">Starter</p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            Active
          </span>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Expires On
          </p>
          <p className="mt-2 text-xl font-bold tracking-tight text-white">14 Nov 2026</p>
          <p className="mt-1.5 text-xs font-semibold text-slate-400">179 days remaining</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Billing Rate
          </p>
          <p className="mt-2 text-xl font-bold tracking-tight text-white">₹3,999 / year</p>
          <p className="mt-1.5 text-xs font-semibold text-slate-400">Auto-renewal active</p>
        </div>
      </div>

      {/* Expiry tracker */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-4">
          <Crown className="h-4.5 w-4.5 text-emerald-400 shadow-sm" />
          <span className="text-sm font-bold tracking-wide text-white">
            Subscription Period Tracker
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-400">Start: 14 May 2026</span>
          <span className="font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full text-[11px]">
            179 days left of 365
          </span>
          <span className="font-semibold text-slate-400">Expires: 14 Nov 2026</span>
        </div>
        <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-slate-900 border border-white/5 shadow-inner">
          <div className="h-full w-[51%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        </div>
        <p className="mt-3 text-xs font-medium text-slate-500">
          51% of subscription period used · Auto-renews on 14 Nov 2026 unless cancelled.
        </p>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <Zap className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-400 animate-pulse" />
          <p className="text-xs leading-relaxed text-amber-200/90 font-medium">
            Auto-renewal is active. ₹3,999 will be charged to UPI —{" "}
            <span className="text-amber-100 font-bold">rahul@paytm</span> on 14 Nov 2026.{" "}
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
      </div>

      {/* Plan features */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-4">
          <Zap className="h-4.5 w-4.5 text-emerald-400" />
          <span className="text-sm font-bold tracking-wide text-white">Starter Plan Benefits</span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {[
            "Testbee adaptive mocks — unlimited",
            "Instacue spaced revision library — full access",
            "Live classes + recorded library",
            "MentaMill quant speed training",
            "AI Calendar — smart study planner",
            "EduFund Starter tier eligibility",
          ].map((f) => (
            <div key={f} className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                <span className="text-[10px]">✓</span>
              </div>
              <span className="leading-5">{f}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate("plans")}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.5)] transition-all active:scale-[0.98]"
          >
            <ArrowUp className="h-4 w-4" />
            Upgrade to Pro
          </button>
          <button
            onClick={() => onNavigate("cancel")}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
          >
            Manage Renewal
          </button>
        </div>
      </div>
    </div>
  );
}
