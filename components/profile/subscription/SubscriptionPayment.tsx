"use client";

import { useState } from "react";
import { CreditCard, Smartphone, Building2, Wallet, Plus, Check, Lock, ShieldCheck } from "lucide-react";
import type { SubViewId } from "./StudentSubscriptionHub";

interface Props {
  onNavigate: (view: SubViewId) => void;
}

const METHODS = [
  { id: "upi", icon: Smartphone, label: "UPI — rahul@paytm", sub: "PhonePe / Google Pay / Paytm · instant payment", color: "bg-emerald-500/15 text-emerald-400", isDefault: true },
  { id: "card", icon: CreditCard, label: "Visa debit card •••• 4242", sub: "Expires 08/2027 · SBI savings account", color: "bg-blue-500/15 text-blue-400", isDefault: false },
  { id: "netbanking", icon: Building2, label: "Net banking — HDFC Bank", sub: "Linked via Razorpay — verified", color: "bg-amber-500/15 text-amber-400", isDefault: false },
  { id: "wallet", icon: Wallet, label: "Razorpay wallet", sub: "Balance: ₹340 · top up available", color: "bg-violet-500/15 text-violet-400", isDefault: false },
];

export default function SubscriptionPayment({ onNavigate }: Props) {
  const [selected, setSelected] = useState("upi");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
        <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <CreditCard className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-foreground dark:text-white">Payment methods</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground dark:text-slate-400">
          Choose your default payment method for auto-renewal and future charges.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const isSelected = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-border hover:border-border/80 dark:border-white/10 dark:hover:border-white/20"
                } bg-card dark:bg-[#0c1017]`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground dark:text-white">{m.label}</p>
                  <p className="text-[11px] text-muted-foreground dark:text-slate-500">{m.sub}</p>
                </div>
                {m.isDefault && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Default</span>
                )}
                <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
                  isSelected ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/30 dark:border-white/20"
                }`}>
                  {isSelected && <div className="h-[7px] w-[7px] rounded-full bg-white" />}
                </div>
              </button>
            );
          })}

          <button
            onClick={() => onNavigate("checkout")}
            className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 p-3 text-left transition-colors hover:border-emerald-500/40 dark:border-white/10"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted dark:bg-white/5">
              <Plus className="h-4 w-4 text-muted-foreground dark:text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground dark:text-slate-400">Add a new payment method</p>
              <p className="text-[11px] text-muted-foreground dark:text-slate-500">UPI · card · net banking · EMI · wallet</p>
            </div>
          </button>
        </div>

        <div className="mt-4 flex gap-3">
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700">
            <Check className="h-3.5 w-3.5" />
            Save default method
          </button>
          <button
            onClick={() => onNavigate("checkout")}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
          >
            Pay now via Razorpay
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
        <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <Lock className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-foreground dark:text-white">Security and trust</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground dark:text-slate-400">
          {["256-bit SSL encryption", "PCI DSS compliant", "Powered by Razorpay", "Auto-renewal can be cancelled anytime"].map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
