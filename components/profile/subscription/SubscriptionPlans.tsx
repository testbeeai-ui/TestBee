"use client";

import { Check, X, ArrowUp } from "lucide-react";
import { PLAN_TIERS } from "./types";
import type { SubViewId } from "./StudentSubscriptionHub";

interface Props {
  onNavigate: (view: SubViewId) => void;
}

export default function SubscriptionPlans({ onNavigate }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-foreground dark:text-white">Choose a plan</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLAN_TIERS.map((plan) => {
          const isCurrent = plan.id === "scholar";
          const isFeatured = plan.id === "champion";
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-4 transition-colors ${
                isCurrent
                  ? "border-emerald-500 bg-emerald-500/10"
                  : isFeatured
                    ? "border-violet-500/60"
                    : "border-border hover:border-border/80 dark:border-white/10 dark:hover:border-white/20"
              } bg-card dark:bg-[#0c1017]`}
            >
              {isCurrent && (
                <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <Check className="h-3 w-3" /> Current plan
                </span>
              )}
              {plan.badge && (
                <span className="mb-2 inline-flex rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
                  {plan.badge}
                </span>
              )}
              <p className="text-sm font-semibold text-foreground dark:text-white">{plan.name}</p>
              <p className="mt-1 text-2xl font-bold text-foreground dark:text-white">
                {plan.priceMonthly === 0 ? "₹0" : `₹${plan.priceMonthly}`}
                {plan.priceMonthly > 0 && (
                  <span className="text-xs font-normal text-muted-foreground dark:text-slate-500">/mo</span>
                )}
              </p>
              {plan.priceYearly > 0 && (
                <p className="text-[11px] text-muted-foreground dark:text-slate-500">
                  or ₹{plan.priceYearly.toLocaleString()} / year · save {Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)}%
                </p>
              )}
              {plan.priceMonthly === 0 && (
                <p className="text-[11px] text-muted-foreground dark:text-slate-500">forever</p>
              )}
              <div className="mt-3 flex flex-col gap-1.5">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground dark:text-slate-300">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {f}
                  </div>
                ))}
                {plan.missing.map((f) => (
                  <div key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground dark:text-slate-500">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                    {f}
                  </div>
                ))}
              </div>
              {isCurrent ? (
                <button className="mt-4 w-full rounded-lg bg-emerald-600/20 py-2 text-xs font-semibold text-emerald-400" disabled>
                  Active plan
                </button>
              ) : plan.id === "free" ? (
                <button className="mt-4 w-full rounded-lg border border-border bg-muted py-2 text-xs font-medium text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-slate-500" disabled>
                  Current base
                </button>
              ) : (
                <button
                  onClick={() => onNavigate("checkout")}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  Upgrade now
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-center text-[11px] text-muted-foreground dark:text-slate-500">
        All plans include RDM accumulation toward EduFund grants. Eligible students may offset subscription cost entirely through financial aid.
      </p>
    </div>
  );
}
