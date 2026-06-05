"use client";

import { useMemo } from "react";
import {
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  Plus,
  Lock,
  ShieldCheck,
} from "lucide-react";
import type { SubViewId } from "./StudentSubscriptionHub";
import type { Profile } from "@/hooks/useAuth";

interface Props {
  profile: Profile;
  onNavigate: (view: SubViewId) => void;
}

export default function SubscriptionPayment({ profile, onNavigate }: Props) {
  // Parse card details dynamically from the logged-in user's profile
  const paymentDetails = useMemo(() => {
    if (!profile?.payment_card_details) return null;
    try {
      return typeof profile.payment_card_details === "string"
        ? JSON.parse(profile.payment_card_details)
        : profile.payment_card_details;
    } catch {
      return null;
    }
  }, [profile?.payment_card_details]);

  // Construct the actual user's payment method dynamically
  const userMethods = useMemo(() => {
    if (!paymentDetails) return [];

    // Check type of payment details
    const type = paymentDetails.type || (paymentDetails.cardNumber ? "card" : "upi");

    if (type === "card") {
      const last4 = paymentDetails.cardNumber ? paymentDetails.cardNumber.replace(/\s/g, "").slice(-4) : "xxxx";
      return [
        {
          id: "card",
          icon: CreditCard,
          label: `Visa debit card •••• ${last4}`,
          sub: paymentDetails.expiryDate ? `Expires ${paymentDetails.expiryDate} · Active` : "Active credit/debit card",
          color: "bg-blue-500/10 border-blue-500/20 text-blue-400",
        },
      ];
    }

    if (type === "upi") {
      return [
        {
          id: "upi",
          icon: Smartphone,
          label: `UPI — ${paymentDetails.upiId || "Registered UPI"}`,
          sub: "PhonePe / Google Pay / Paytm · Auto-renewal active",
          color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
        },
      ];
    }

    if (type === "netbanking") {
      const bank = paymentDetails.bankName ? paymentDetails.bankName.toUpperCase() : "HDFC";
      return [
        {
          id: "netbanking",
          icon: Building2,
          label: `Net banking — ${bank} Bank`,
          sub: "Linked via Razorpay — verified",
          color: "bg-amber-500/10 border-amber-500/20 text-amber-400",
        },
      ];
    }

    if (type === "wallet") {
      const wallet = paymentDetails.walletName ? paymentDetails.walletName.toUpperCase() : "Razorpay";
      return [
        {
          id: "wallet",
          icon: Wallet,
          label: `${wallet} wallet`,
          sub: "Linked via Razorpay",
          color: "bg-purple-500/10 border-purple-500/20 text-purple-400",
        },
      ];
    }

    return [];
  }, [paymentDetails]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-4">
          <CreditCard className="h-4.5 w-4.5 text-emerald-400" />
          <span className="text-sm font-bold tracking-wide text-white">Payment Methods</span>
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-400">
          Your active payment methods for subscription auto-renewal.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {userMethods.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 border border-dashed border-white/10 rounded-xl bg-black/10 text-center">
              <CreditCard className="h-8 w-8 text-slate-600 mb-2 opacity-55" />
              <p className="text-xs font-semibold text-slate-400">No payment methods linked to this account yet.</p>
              <p className="text-[10px] text-slate-500 mt-1">Please proceed to checkout via Razorpay to link your account.</p>
            </div>
          ) : (
            userMethods.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3.5 rounded-xl border p-4 text-left border-emerald-500 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)] relative overflow-hidden"
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
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                    Default
                  </span>
                  <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500">
                    <div className="h-2 w-2 rounded-full bg-slate-950" />
                  </div>
                </div>
              );
            })
          )}

          <button
            type="button"
            onClick={() => onNavigate("checkout")}
            className="flex items-center gap-3.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-left transition-colors hover:border-emerald-500/40 hover:bg-white/[0.04]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
              <Plus className="h-4.5 w-4.5 text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-300">Link a new payment method</p>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                UPI · Credit / Debit Card · Net Banking · Wallet
              </p>
            </div>
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
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
