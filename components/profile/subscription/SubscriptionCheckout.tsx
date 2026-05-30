"use client";

import { useState } from "react";
import {
  Receipt,
  Lock,
  Smartphone,
  CreditCard,
  Building2,
  Wallet,
  ShieldCheck,
  Info,
} from "lucide-react";

const TABS = [
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "nb", label: "Net banking", icon: Building2 },
  { id: "wallet", label: "Wallets", icon: Wallet },
] as const;

const UPI_APPS = [
  { id: "phonepe", label: "PhonePe", icon: Smartphone },
  { id: "gpay", label: "Google Pay", icon: Smartphone },
  { id: "paytm", label: "Paytm", icon: Smartphone },
];

const BANKS = [
  { id: "hdfc", label: "HDFC Bank", sub: "Most used" },
  { id: "sbi", label: "SBI" },
  { id: "icici", label: "ICICI Bank" },
  { id: "axis", label: "Axis Bank" },
  { id: "kotak", label: "Kotak Bank" },
];

const WALLETS = [
  { id: "paytm", label: "Paytm wallet", sub: "Balance: ₹340" },
  { id: "amazon", label: "Amazon Pay" },
  { id: "mobikwik", label: "Mobikwik" },
  { id: "freecharge", label: "Freecharge" },
];

export default function SubscriptionCheckout() {
  const [tab, setTab] = useState<string>("upi");
  const [selectedUPI, setSelectedUPI] = useState("phonepe");
  const [selectedBank, setSelectedBank] = useState("hdfc");
  const [selectedWallet, setSelectedWallet] = useState("paytm");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-foreground dark:text-white">
        Complete payment via Razorpay
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Order summary */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
            <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
              <Receipt className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-foreground dark:text-white">
                Order summary
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2 text-xs">
              <div className="flex justify-between border-b border-border pb-2 dark:border-white/10">
                <span className="text-muted-foreground dark:text-slate-400">
                  Champion plan — annual
                </span>
                <span className="font-semibold text-foreground dark:text-white">₹6,999</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 dark:border-white/10">
                <span className="text-muted-foreground dark:text-slate-400">
                  Scholar credit (unused)
                </span>
                <span className="font-semibold text-emerald-400">-₹1,833</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2 dark:border-white/10">
                <span className="text-muted-foreground dark:text-slate-400">GST (18%)</span>
                <span className="font-semibold text-foreground dark:text-white">₹921</span>
              </div>
              <div className="flex justify-between pt-2 text-sm">
                <span className="font-semibold text-foreground dark:text-white">
                  Total due today
                </span>
                <span className="font-bold text-emerald-400">₹6,087</span>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-500/10 p-3 text-xs leading-relaxed text-blue-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Pro-rated Scholar credit for the unused 179 days has been applied. Cancel anytime —
              refund policy applies within 7 days.
            </div>
          </div>
        </div>

        {/* Razorpay gateway */}
        <div className="rounded-xl border border-border bg-card dark:border-white/10 dark:bg-[#0c1017]">
          <div className="rounded-t-xl bg-[#041E3A] p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#3395FF] text-xs font-bold text-white">
                R
              </div>
              <span className="text-sm font-semibold text-white">Razorpay</span>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-[#5C7A9A]">Pay to Testbee</p>
              <p className="text-base font-semibold text-white">₹6,087</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border dark:border-white/10">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 border-b-2 py-2 text-center text-[11px] font-medium transition-colors ${
                    tab === t.id
                      ? "border-blue-400 text-blue-300"
                      : "border-transparent text-muted-foreground dark:text-slate-500"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-4">
            {/* UPI */}
            {tab === "upi" && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground dark:text-slate-400">
                  Enter your UPI ID or scan QR
                </p>
                <input
                  placeholder="yourname@upi (e.g. rahul@paytm)"
                  className="rounded-lg border border-muted-foreground/20 bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
                />
                <p className="text-[11px] text-muted-foreground dark:text-slate-500">Or pay with</p>
                <div className="flex gap-2">
                  {UPI_APPS.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => setSelectedUPI(app.id)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border p-2 text-xs transition-colors ${
                        selectedUPI === app.id
                          ? "border-blue-400 bg-blue-500/10"
                          : "border-border dark:border-white/10"
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      {app.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 p-6 dark:border-white/10">
                  <div className="text-center">
                    <p className="text-[11px] text-muted-foreground dark:text-slate-500">
                      QR code placeholder
                    </p>
                    <div className="mx-auto mt-2 flex h-20 w-20 items-center justify-center rounded-lg border border-muted-foreground/20 bg-muted dark:border-white/10 dark:bg-white/5">
                      <span className="text-3xl text-muted-foreground dark:text-slate-500">⊞</span>
                    </div>
                  </div>
                </div>
                <button className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#3395FF] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2B7FE0]">
                  <Lock className="h-3.5 w-3.5" />
                  Pay ₹6,087 securely
                </button>
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground dark:text-slate-500">
                  <Lock className="h-3 w-3" />
                  Secured by Razorpay
                </div>
              </div>
            )}

            {/* Card */}
            {tab === "card" && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground dark:text-slate-400">
                  Credit or debit card
                </p>
                <input
                  placeholder="Card number"
                  className="rounded-lg border border-muted-foreground/20 bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="MM / YY"
                    className="rounded-lg border border-muted-foreground/20 bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
                  />
                  <input
                    placeholder="CVV"
                    className="rounded-lg border border-muted-foreground/20 bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
                <input
                  placeholder="Name on card"
                  className="rounded-lg border border-muted-foreground/20 bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
                />
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground dark:text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  EMI available from ₹583/mo on select cards
                </div>
                <button className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#3395FF] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2B7FE0]">
                  <Lock className="h-3.5 w-3.5" />
                  Pay ₹6,087 securely
                </button>
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground dark:text-slate-500">
                  <Lock className="h-3 w-3" />
                  Secured by Razorpay
                </div>
              </div>
            )}

            {/* Net banking */}
            {tab === "nb" && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground dark:text-slate-400">
                  Select your bank
                </p>
                {BANKS.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() => setSelectedBank(bank.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selectedBank === bank.id
                        ? "border-blue-400 bg-blue-500/10"
                        : "border-border dark:border-white/10"
                    }`}
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground dark:text-slate-400" />
                    <div>
                      <p className="text-xs font-semibold text-foreground dark:text-white">
                        {bank.label}
                      </p>
                      {bank.sub && (
                        <p className="text-[10px] text-muted-foreground dark:text-slate-500">
                          {bank.sub}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
                <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#3395FF] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2B7FE0]">
                  <Lock className="h-3.5 w-3.5" />
                  Pay ₹6,087 securely
                </button>
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground dark:text-slate-500">
                  <Lock className="h-3 w-3" />
                  Secured by Razorpay
                </div>
              </div>
            )}

            {/* Wallets */}
            {tab === "wallet" && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground dark:text-slate-400">Select wallet</p>
                {WALLETS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWallet(w.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selectedWallet === w.id
                        ? "border-blue-400 bg-blue-500/10"
                        : "border-border dark:border-white/10"
                    }`}
                  >
                    <Wallet className="h-4 w-4 text-muted-foreground dark:text-slate-400" />
                    <div>
                      <p className="text-xs font-semibold text-foreground dark:text-white">
                        {w.label}
                      </p>
                      {w.sub && (
                        <p className="text-[10px] text-muted-foreground dark:text-slate-500">
                          {w.sub}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
                <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#3395FF] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2B7FE0]">
                  <Lock className="h-3.5 w-3.5" />
                  Pay ₹6,087 securely
                </button>
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground dark:text-slate-500">
                  <Lock className="h-3 w-3" />
                  Secured by Razorpay
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
