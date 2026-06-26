"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Copy,
  Ticket,
  RefreshCw,
  Coins,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TeacherPlanSubscriptionSection } from "@/components/teacher-portal/views/subscriptions/TeacherPlanSubscriptionSection";

type SubscriptionsViewProps = {
  onRefresh: () => Promise<void>;
};

export default function SubscriptionsView({
  onRefresh,
}: SubscriptionsViewProps) {
  const { toast } = useToast();

  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const [userCoupons, setUserCoupons] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);

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

  const handleCopyCode = (code: string) => {
    void navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `Coupon code "${code}" copied.` });
  };

  return (
    <div className="animate-fade-in scrollbar-thin mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-4 text-slate-100 md:py-6">
      <div className="flex flex-col gap-2 border-b border-white/[0.05] pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white md:text-2xl">
            <Coins className="h-6 w-6 text-amber-400" />
            Wallet &amp; Credits
          </h1>
          <p className="text-xs text-slate-400">
            Manage your teacher plan and promotional vouchers.
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshingBalance}
          className="flex items-center gap-1.5 self-start rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50 md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshingBalance ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TeacherPlanSubscriptionSection onPlanChanged={onRefresh} />
        </div>

        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-xl">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-white">
                <Ticket className="h-4 w-4 text-amber-400" />
                Redeem Voucher
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                Enter a promotional or admin-issued coupon code to claim RDM credits.
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && void handleApplyCoupon()}
                placeholder="VOUCHER CODE (e.g. 26ABCDEF)"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center font-mono text-xs uppercase tracking-widest text-white placeholder:text-slate-600 transition focus:border-amber-400 focus:outline-none sm:text-sm"
                autoComplete="off"
                spellCheck={false}
              />

              <button
                type="button"
                disabled={couponLoading || !couponCode.trim()}
                onClick={() => void handleApplyCoupon()}
                className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-amber-400 py-2.5 text-xs font-bold text-black transition hover:bg-amber-500 disabled:bg-white/10 disabled:text-slate-500"
              >
                {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim RDM Credits"}
              </button>
            </div>
          </div>

          <div className="flex min-h-[300px] max-h-[460px] flex-col space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-xl">
            <div>
              <h3 className="text-sm font-bold text-white">Voucher Wallet</h3>
              <p className="mt-1 text-[11px] text-slate-400">
                Vouchers linked to your teacher profile. Redemptions are permanent.
              </p>
            </div>

            {couponsLoading && userCoupons.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading vouchers...
              </div>
            ) : userCoupons.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/5 bg-white/[0.01] p-4 text-center">
                <Ticket className="mb-2 h-8 w-8 stroke-1 text-slate-600" />
                <p className="text-xs font-medium text-slate-500">No vouchers found</p>
                <p className="mt-0.5 text-[10px] leading-snug text-slate-600">
                  Coupons from admins or promotions will appear here.
                </p>
              </div>
            ) : (
              (() => {
                const activeUserCoupons = userCoupons.filter((c: any) => c.status === "active");
                const redeemedUserCoupons = userCoupons.filter((c: any) => c.status !== "active");

                return (
                  <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      <h4 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
                        <Ticket className="h-3.5 w-3.5" />
                        Active Vouchers ({activeUserCoupons.length})
                      </h4>
                      {activeUserCoupons.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/5 bg-white/[0.005] p-3 text-center">
                          <p className="text-[10px] text-slate-500">No active vouchers available.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {activeUserCoupons.map((coupon: any) => (
                            <div
                              key={coupon.id}
                              className="flex flex-col gap-2 rounded-xl border border-amber-400/20 bg-white/[0.01] p-3 transition-all hover:border-amber-400/35"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold tracking-wider text-white">
                                  {coupon.code}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {coupon.is_purchased ? (
                                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-blue-300">
                                      Paid
                                    </span>
                                  ) : (
                                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-300">
                                      Promo
                                    </span>
                                  )}
                                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-400">
                                    Active
                                  </span>
                                </div>
                              </div>

                              <div className="mt-0.5 flex items-center justify-between border-t border-white/[0.04] pt-2">
                                <div className="font-mono text-[10px] font-bold text-slate-400">
                                  {coupon.rdm_amount} RDM
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => handleCopyCode(coupon.code)}
                                    className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-400 transition hover:text-white"
                                  >
                                    <Copy className="h-3 w-3" /> Copy
                                  </button>
                                  <button
                                    onClick={() => handleApplyCoupon(coupon.code)}
                                    disabled={couponLoading}
                                    className="cursor-pointer text-[10px] font-bold text-amber-300 transition hover:text-amber-200"
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

                    {redeemedUserCoupons.length > 0 && (
                      <div className="space-y-2 border-t border-white/[0.06] pt-2">
                        <h4 className="mb-2.5 mt-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <History className="h-3.5 w-3.5" />
                          Redemption History ({redeemedUserCoupons.length})
                        </h4>
                        <div className="space-y-2.5">
                          {redeemedUserCoupons.map((coupon: any) => (
                            <div
                              key={coupon.id}
                              className="flex select-none flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.003] p-3 opacity-45 transition hover:opacity-60"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-semibold tracking-wider text-slate-500 line-through">
                                  {coupon.code}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="rounded bg-slate-500/5 px-1.5 py-0.5 text-[8px] font-bold uppercase text-slate-500">
                                    {coupon.is_purchased ? "Paid" : "Promo"}
                                  </span>
                                  <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-slate-400">
                                    {coupon.status}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-0.5 flex items-center justify-between border-t border-white/[0.03] pt-2">
                                <div className="font-mono text-[10px] text-slate-500 line-through">
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
              })()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
