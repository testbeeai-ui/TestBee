"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  Copy,
  X,
  Ticket,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Coins,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RazorpayCheckoutButton from "@/components/payments/RazorpayCheckoutButton";

export type RdmTopUpPack = {
  id: string;
  rdmAmount: number;
  priceInr: number;
  badge?: string;
  description: string;
  benefits: string[];
};

export const TEACHER_RDM_TOP_UP_PACKS: RdmTopUpPack[] = [
  {
    id: "pack_500",
    rdmAmount: 500,
    priceInr: 300,
    description: "Ideal for basic teaching needs and simple quiz activities.",
    benefits: [
      "Credit of 500 RDM immediately",
      "Create up to 15+ classrooms or sections",
      "Schedule up to 15+ live lessons/webinars",
      "Publish up to 50+ student assignments",
      "Generate up to 15+ new MCQ test papers",
    ],
  },
  {
    id: "pack_1000",
    rdmAmount: 1000,
    priceInr: 500,
    badge: "Popular",
    description: "Perfect for active teachers requiring frequent test updates.",
    benefits: [
      "Credit of 1000 RDM (saves 16%)",
      "Create up to 30+ classrooms or sections",
      "Schedule up to 30+ live lessons/webinars",
      "Publish up to 100+ student assignments",
      "Generate up to 30+ new MCQ test papers",
    ],
  },
  {
    id: "pack_2200",
    rdmAmount: 2200,
    priceInr: 1000,
    badge: "Best value",
    description: "Full classroom suite for advanced AI integrations & RAG analytics.",
    benefits: [
      "Credit of 2200 RDM (saves 31%)",
      "Create up to 70+ classrooms or sections",
      "Schedule up to 70+ live lessons/webinars",
      "Publish up to 200+ student assignments",
      "Generate up to 70+ new MCQ test papers",
    ],
  },
];

type SubscriptionsViewProps = {
  rdmBalance: number;
  teacherId: string;
  onRefresh: () => Promise<void>;
};

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Gold RDM Coin SVG Illustration
const RDM_COIN_SVG = (
  <svg className="w-12 h-12 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="50%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" stroke="url(#coinGrad)" strokeWidth="2" fill="rgba(245, 158, 11, 0.08)"/>
    <circle cx="12" cy="12" r="7.5" stroke="url(#coinGrad)" strokeWidth="1" strokeDasharray="3 2" fill="rgba(245, 158, 11, 0.12)"/>
    <path d="M10 8.5H13C13.8 8.5 14.5 9 14.5 9.8C14.5 10.6 13.8 11.1 13 11.1H10V8.5ZM10 11.1H13C13.8 11.1 14.5 11.6 14.5 12.4C14.5 13.2 13.8 13.7 13 13.7H10V11.1ZM10 13.7V15.5" stroke="url(#coinGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function SubscriptionsView({
  rdmBalance,
  teacherId,
  onRefresh,
}: SubscriptionsViewProps) {
  const { toast } = useToast();
  const [selectedPackId, setSelectedPackId] = useState<string>(
    TEACHER_RDM_TOP_UP_PACKS[1]?.id || TEACHER_RDM_TOP_UP_PACKS[0]?.id || ""
  );
  
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // Razorpay checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [purchasedCouponCode, setPurchasedCouponCode] = useState<string | null>(null);
  const [redeemingPurchased, setRedeemingPurchased] = useState(false);

  // User Coupon lists
  const [userCoupons, setUserCoupons] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);

  const selectedPack = TEACHER_RDM_TOP_UP_PACKS.find((p) => p.id === selectedPackId) ?? null;

  const loadUserCoupons = async () => {
    setCouponsLoading(true);
    try {
      const res = await fetch("/api/user/coupons");
      const body = await res.json();
      if (res.ok) {
        setUserCoupons(body.coupons || []);
      }
    } catch (e) {
      console.error("Failed to load user coupons", e);
    } finally {
      setCouponsLoading(false);
    }
  };

  useEffect(() => {
    void loadUserCoupons();
  }, []);

  const handleManualRefresh = async () => {
    setRefreshingBalance(true);
    try {
      await onRefresh();
      await loadUserCoupons();
      toast({ title: "Updated", description: "Wallet details refreshed successfully." });
    } finally {
      setRefreshingBalance(false);
    }
  };

  const handleApplyCoupon = async (codeToRedeem?: string) => {
    const code = (codeToRedeem || couponCode).trim();
    if (!code) {
      toast({ title: "Enter a coupon code", variant: "destructive" });
      return;
    }
    
    setCouponLoading(true);
    try {
      const res = await fetch("/api/user/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json();
      
      if (!res.ok) throw new Error(body.error || "Failed to redeem coupon");

      toast({
        title: "Coupon Redeemed! 🎉",
        description: body.message || `Successfully added RDM to your balance`,
      });
      
      if (!codeToRedeem) {
        setCouponCode("");
      }
      
      await onRefresh();
      await loadUserCoupons();
    } catch (err) {
      toast({
        title: "Redemption Failed",
        description: err instanceof Error ? err.message : "Invalid coupon",
        variant: "destructive",
      });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleStartCheckout = () => {
    if (!selectedPack) return;
    setIsCheckoutOpen(true);
    setPurchasedCouponCode(null);
  };

  const handleRdmPaymentVerified = async (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    if (!selectedPack) return;

    const res = await fetch("/api/user/coupons/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        packId: selectedPack.id,
        ...response,
      }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Payment failed");

    setPurchasedCouponCode(body.code);
    await loadUserCoupons();
    toast({
      title: "Payment Successful! 🎉",
      description: `Your unique coupon for ${body.rdmAmount} RDM has been generated.`,
    });
  };

  const handleRedeemPurchased = async () => {
    if (!purchasedCouponCode) return;
    setRedeemingPurchased(true);
    try {
      await handleApplyCoupon(purchasedCouponCode);
      setIsCheckoutOpen(false);
      setPurchasedCouponCode(null);
    } finally {
      setRedeemingPurchased(false);
    }
  };

  const handleCopyCode = (code: string) => {
    void navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `Coupon code "${code}" copied.` });
  };

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-4 md:py-6 text-slate-100 max-w-[1200px] mx-auto animate-fade-in scrollbar-thin">
      
      {/* Upper header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-white/[0.05] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl flex items-center gap-2">
            <Coins className="h-6 w-6 text-amber-400" />
            Wallet &amp; Credits
          </h1>
          <p className="text-xs text-slate-400">
            Purchase RDM points, redeem promotional vouchers, and manage your credit history.
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshingBalance}
          className="flex items-center gap-1.5 self-start md:self-auto rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshingBalance ? "animate-spin" : ""}`} />
          Refresh Balance
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: BALANCE CARD & RDM PACKAGES (2 Columns wide) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* BALANCE CARD */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 px-6 py-6 shadow-xl flex items-center justify-between">
            {/* Ambient background glows */}
            <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
            <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
            
            <div className="relative z-10 space-y-2 max-w-md">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-300 uppercase">
                Active Balance
              </span>
              <h2 className="text-sm font-semibold text-slate-300">Available RDM Points</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                RDM points are consumed when you perform teacher actions such as creating classrooms, adding class sections, publishing assignments, scheduling live lessons, or generating new MCQ test papers.
              </p>
            </div>
            
            <div className="relative z-10 flex flex-col items-end gap-1.5 shrink-0 bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-4 min-w-[130px] justify-center text-center">
              {RDM_COIN_SVG}
              <div className="text-right">
                <span className="font-mono text-2xl font-bold tracking-tight text-white md:text-3xl tabular-nums">
                  {rdmBalance.toLocaleString("en-IN")}
                </span>
                <span className="ml-1 text-xs font-semibold text-slate-400">RDM</span>
              </div>
            </div>
          </div>

          {/* RDM PACKS SECTION */}
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Purchase RDM Credits</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Top up your teacher account with premium credits. Pay securely using UPI, Credit Cards, or Wallets.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TEACHER_RDM_TOP_UP_PACKS.map((pack) => {
                const isSelected = selectedPackId === pack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`group relative flex flex-col rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-amber-400 bg-amber-500/[0.04] ring-1 ring-amber-400/20 shadow-lg shadow-amber-500/5"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    {pack.badge && (
                      <span className="absolute -top-2.5 left-4 whitespace-nowrap rounded-lg bg-amber-400 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-black font-extrabold shadow-sm">
                        {pack.badge}
                      </span>
                    )}

                    <div className="mb-2">
                      <span className="font-mono text-xl font-extrabold text-white tracking-tight group-hover:text-amber-300 transition">
                        {pack.rdmAmount.toLocaleString("en-IN")}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400 font-semibold uppercase">RDM</span>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-snug flex-1 mb-4">
                      {pack.description}
                    </p>

                    <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between mt-auto">
                      <span className="text-xs text-slate-400">Total Price</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {formatInr(pack.priceInr)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* SELECTED PACK DETAILS */}
            {selectedPack && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 space-y-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Included with {selectedPack.rdmAmount} RDM package:
                  </h4>
                </div>
                
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {selectedPack.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-slate-400">
                      <span className="text-emerald-400 text-sm">✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={handleStartCheckout}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-200 text-[#07070f] font-bold py-3 text-xs md:text-sm transition cursor-pointer shadow-md"
                >
                  <span>Proceed to Payment ({formatInr(selectedPack.priceInr)})</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: REDEEM COUPONS & HISTORY (1 Column wide) */}
        <div className="space-y-6">
          
          {/* REDEEM COUPON CARD */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4 shadow-xl">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Ticket className="h-4 w-4 text-amber-400" />
                Redeem Voucher
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Enter an 8-digit promotional or purchased coupon code to claim your credits.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && void handleApplyCoupon()}
                  placeholder="VOUCHER CODE (e.g. 26ABCDEF)"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-center tracking-widest text-white placeholder:text-slate-600 focus:border-amber-400 focus:outline-none transition uppercase text-xs sm:text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <button
                type="button"
                disabled={couponLoading || !couponCode.trim()}
                onClick={() => void handleApplyCoupon()}
                className="w-full flex items-center justify-center rounded-xl bg-amber-400 hover:bg-amber-500 disabled:bg-white/10 text-black disabled:text-slate-500 font-bold py-2.5 text-xs transition cursor-pointer"
              >
                {couponLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Claim RDM Credits"
                )}
              </button>
            </div>
          </div>

          {/* TEACHER COUPON LISTING */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4 shadow-xl flex flex-col min-h-[300px] max-h-[460px]">
            <div>
              <h3 className="text-sm font-bold text-white">Voucher Wallet</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Vouchers purchased or restricted to your teacher profile. Redemptions are permanent.
              </p>
            </div>

            {couponsLoading && userCoupons.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Loading vouchers...
              </div>
            ) : userCoupons.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-4 border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                <Ticket className="h-8 w-8 text-slate-600 mb-2 stroke-1" />
                <p className="text-xs text-slate-500 font-medium">No vouchers found</p>
                <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                  Any coupons you buy or receive from admins will appear here.
                </p>
              </div>
            ) : (() => {
              const activeUserCoupons = userCoupons.filter((c: any) => c.status === "active");
              const redeemedUserCoupons = userCoupons.filter((c: any) => c.status !== "active");
              
              return (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                  {/* ACTIVE VOUCHERS */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5 mb-2.5">
                      <Ticket className="h-3.5 w-3.5" />
                      Active Vouchers ({activeUserCoupons.length})
                    </h4>
                    {activeUserCoupons.length === 0 ? (
                      <div className="p-3 text-center border border-dashed border-white/5 rounded-xl bg-white/[0.005]">
                        <p className="text-[10px] text-slate-500">No active vouchers available.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {activeUserCoupons.map((coupon: any) => (
                          <div
                            key={coupon.id}
                            className="rounded-xl border border-amber-400/20 hover:border-amber-400/35 bg-white/[0.01] transition-all flex flex-col gap-2 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold tracking-wider text-white">
                                {coupon.code}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {coupon.is_purchased ? (
                                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[8px] font-bold text-blue-300 uppercase">
                                    Paid
                                  </span>
                                ) : (
                                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold text-amber-300 uppercase">
                                    Promo
                                  </span>
                                )}
                                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400 uppercase">
                                  Active
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-white/[0.04] pt-2 mt-0.5">
                              <div className="text-[10px] text-slate-400 font-mono font-bold">
                                {coupon.rdm_amount} RDM
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleCopyCode(coupon.code)}
                                  className="text-[10px] text-slate-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Copy className="h-3 w-3" /> Copy
                                </button>
                                <button
                                  onClick={() => handleApplyCoupon(coupon.code)}
                                  disabled={couponLoading}
                                  className="text-[10px] text-amber-300 hover:text-amber-200 transition font-bold cursor-pointer"
                                >
                                  Redeem
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* REDEMPTION HISTORY */}
                  {redeemedUserCoupons.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5 mt-1.5">
                        <History className="h-3.5 w-3.5" />
                        Redemption History ({redeemedUserCoupons.length})
                      </h4>
                      <div className="space-y-2.5">
                        {redeemedUserCoupons.map((coupon: any) => (
                          <div
                            key={coupon.id}
                            className="rounded-xl border border-white/5 bg-white/[0.003] opacity-45 select-none flex flex-col gap-2 p-3 hover:opacity-60 transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-semibold tracking-wider text-slate-500 line-through">
                                {coupon.code}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {coupon.is_purchased ? (
                                  <span className="rounded bg-slate-500/5 px-1.5 py-0.5 text-[8px] font-bold text-slate-500 uppercase">
                                    Paid
                                  </span>
                                ) : (
                                  <span className="rounded bg-slate-500/5 px-1.5 py-0.5 text-[8px] font-bold text-slate-500 uppercase">
                                    Promo
                                  </span>
                                )}
                                <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[8px] font-bold text-slate-400 uppercase">
                                  {coupon.status}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-white/[0.03] pt-2 mt-0.5">
                              <div className="text-[10px] text-slate-500 font-mono line-through">
                                {coupon.rdm_amount} RDM
                              </div>
                              <span className="text-[9px] text-slate-500">
                                {coupon.redeemed_at
                                  ? `Redeemed: ${new Date(coupon.redeemed_at).toLocaleDateString("en-IN")}`
                                  : "Expired"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* RAZORPAY CHECKOUT MODAL OVERLAY */}
      {isCheckoutOpen && selectedPack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07070f]/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative flex w-full max-w-md flex-col rounded-2xl border border-white/10 bg-[#0c1017] shadow-2xl overflow-hidden">
            
            {/* Razorpay Top Header Branding */}
            <div className="bg-[#041E3A] px-5 py-4 flex items-center justify-between border-b border-white/[0.03]">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#3395FF] text-xs font-bold text-white font-sans">
                  R
                </div>
                <span className="text-sm font-semibold text-white">Razorpay</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] text-[#5C7A9A] uppercase tracking-wide">Testbee top-up</p>
                  <p className="text-base font-semibold text-white font-mono leading-none mt-1">{formatInr(selectedPack.priceInr)}</p>
                </div>
                
                {!purchasedCouponCode && (
                  <button
                    type="button"
                    onClick={() => setIsCheckoutOpen(false)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0 ml-1 cursor-pointer"
                    aria-label="Close checkout"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Main Content Area */}
            {!purchasedCouponCode ? (
              <div className="flex flex-col p-4 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Top up {selectedPack.rdmAmount} RDM credits. Payment is processed securely by
                  Razorpay — test or live mode is controlled only by your API keys in the environment.
                </p>
                <RazorpayCheckoutButton
                  amount={selectedPack.priceInr * 100}
                  description={`RDM pack — ${selectedPack.rdmAmount} credits`}
                  label={`Pay ${formatInr(selectedPack.priceInr)} securely`}
                  createOrderBody={{
                    purpose: "rdm_pack",
                    packId: selectedPack.id,
                    currency: "INR",
                  }}
                  onPaymentVerified={handleRdmPaymentVerified}
                  showSuccessToast={false}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-3 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60 cursor-pointer"
                />
                <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-500">
                  Secured by Razorpay • PCI-DSS Compliant
                </div>
              </div>
            ) : (
              /* Success View showing coupon code */
              <div className="p-6 flex flex-col items-center text-center space-y-4 bg-emerald-500/[0.02]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-white">Payment Successful!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    ₹{selectedPack.priceInr} was processed successfully. Your RDM coupon code is ready.
                  </p>
                </div>

                <div className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Coupon Code</span>
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 w-full justify-between">
                    <span className="font-mono text-lg font-bold tracking-widest text-emerald-300">
                      {purchasedCouponCode}
                    </span>
                    <button
                      onClick={() => handleCopyCode(purchasedCouponCode!)}
                      className="text-slate-400 hover:text-white transition"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-[9px] text-slate-500 leading-snug">
                    *This coupon has no expiration date and is linked exclusively to your account.
                  </span>
                </div>

                <div className="w-full flex flex-col gap-2 pt-2">
                  <button
                    onClick={handleRedeemPurchased}
                    disabled={redeemingPurchased}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 text-xs transition cursor-pointer disabled:opacity-60"
                  >
                    {redeemingPurchased ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <>
                        <Ticket className="h-4 w-4" />
                        <span>Redeem Now</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsCheckoutOpen(false);
                      setPurchasedCouponCode(null);
                    }}
                    disabled={redeemingPurchased}
                    className="w-full rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 font-medium py-2.5 text-xs transition cursor-pointer"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
