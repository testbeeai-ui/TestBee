"use client";

import { useState } from "react";
import {
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  Plus,
  Check,
  Lock,
  ShieldCheck,
} from "lucide-react";
import type { SubViewId } from "./StudentSubscriptionHub";

interface Props {
  onNavigate: (view: SubViewId) => void;
}

const METHODS = [
  {
    id: "upi",
    icon: Smartphone,
    label: "UPI — rahul@paytm",
    sub: "PhonePe / Google Pay / Paytm · Instant payment",
    color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    isDefault: true,
  },
  {
    id: "card",
    icon: CreditCard,
    label: "Visa debit card •••• 4242",
    sub: "Expires 08/2027 · SBI savings account",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    isDefault: false,
  },
  {
    id: "netbanking",
    icon: Building2,
    label: "Net banking — HDFC Bank",
    sub: "Linked via Razorpay — verified",
    color: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    isDefault: false,
  },
  {
    id: "wallet",
    icon: Wallet,
    label: "Razorpay wallet",
    sub: "Balance: ₹340 · top up available",
    color: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    isDefault: false,
  },
];

export default function SubscriptionPayment({ onNavigate }: Props) {
  const [selected, setSelected] = useState("upi");

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-4">
          <CreditCard className="h-4.5 w-4.5 text-emerald-400" />
          <span className="text-sm font-bold tracking-wide text-white">Payment Methods</span>
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-400">
          Choose your default payment method for auto-renewal and future charges.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const isSelected = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all duration-200 relative overflow-hidden ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                    : "border-white/[0.06] bg-black/20 hover:border-white/20"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${m.color}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white">{m.label}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">{m.sub}</p>
                </div>
                {m.isDefault && (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                    Default
                  </span>
                )}
                <div
                  className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-all ${
                    isSelected ? "border-emerald-500 bg-emerald-500" : "border-white/20"
                  }`}
                >
                  {isSelected && <div className="h-2 w-2 rounded-full bg-slate-950" />}
                </div>
              </button>
            );
          })}

          <button
            onClick={() => onNavigate("checkout")}
            className="flex items-center gap-3.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-left transition-colors hover:border-emerald-500/40 hover:bg-white/[0.04]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
              <Plus className="h-4.5 w-4.5 text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-300">Add a new payment method</p>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                UPI · Credit / Debit Card · Net Banking · Wallet
              </p>
            </div>
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.5)] transition-all active:scale-[0.98]">
            <Check className="h-4 w-4" />
            Save Default Method
          </button>
          <button
            onClick={() => onNavigate("checkout")}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
          >
            Pay now via Razorpay
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-4">
          <Lock className="h-4.5 w-4.5 text-emerald-400" />
          <span className="text-sm font-bold tracking-wide text-white">Security & Trust</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3.5 text-[11px] font-medium text-slate-400">
          {[
            "256-bit SSL encryption",
            "PCI DSS compliant",
            "Powered by Razorpay",
            "Auto-renewal can be cancelled anytime",
          ].map((s) => (
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
