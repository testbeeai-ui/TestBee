"use client";

import { useCallback, useEffect, useState } from "react";
import { Ticket, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import type { Profile } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCouponExpiryDate } from "@/lib/subscription/subscriptionCouponUtils";

interface Props {
  profile: Profile;
}

type AssignedCoupon = {
  id: string;
  code: string;
  plan_tier: "starter" | "pro";
  duration_months: number;
  created_at: string;
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter Plan",
  pro: "Pro Plan",
};

export default function SubscriptionCoupon({ profile }: Props) {
  const { refreshProfile } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [assignedCoupons, setAssignedCoupons] = useState<AssignedCoupon[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [claimingCode, setClaimingCode] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<{
    message: string;
    detail: string;
  } | null>(null);

  const loadAssignedCoupons = useCallback(async () => {
    setAssignedLoading(true);
    try {
      const headers = await getClientApiAuthHeaders();
      const res = await fetch("/api/user/coupons/claim-plan", { headers });
      const body = await res.json();
      if (res.ok) {
        setAssignedCoupons(body.coupons ?? []);
      }
    } catch (e) {
      console.error("Failed to load assigned coupons", e);
    } finally {
      setAssignedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignedCoupons();
  }, [loadAssignedCoupons]);

  const claimCode = async (rawCode: string, fromList = false) => {
    const trimmed = rawCode.trim().toUpperCase();
    if (!trimmed) {
      toast({ title: "Enter a coupon code", variant: "destructive" });
      return;
    }

    if (fromList) {
      setClaimingCode(trimmed);
    } else {
      setLoading(true);
    }
    setLastSuccess(null);
    try {
      const headers = await getClientApiAuthHeaders();
      const res = await fetch("/api/user/coupons/claim-plan", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not claim coupon");

      setLastSuccess({
        message: body.message,
        detail: body.detail ?? "",
      });
      if (!fromList) setCode("");
      await refreshProfile();
      await loadAssignedCoupons();
      toast({
        title: "Coupon claimed!",
        description: body.message,
      });
    } catch (err) {
      toast({
        title: "Claim failed",
        description: err instanceof Error ? err.message : "Invalid or expired code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setClaimingCode(null);
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    await claimCode(code);
  };

  const nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0);
  const activeExpiry = profile.subscription_expires_at
    ? new Date(profile.subscription_expires_at)
    : null;
  const hasFutureExpiry = activeExpiry && activeExpiry.getTime() > nowMs;
  const paidTiers = new Set(["starter", "pro", "scholar", "champion", "pro_plus"]);
  const hasActivePaidPlan =
    hasFutureExpiry && paidTiers.has(String(profile.plan_tier ?? "").toLowerCase());

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <div>
        <p className="text-sm font-semibold text-foreground dark:text-white flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          Claim your coupon code
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Coupons assigned to your account appear below. You can also enter a code manually.
          Your plan and duration are applied automatically.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017] space-y-3">
        <p className="text-xs font-semibold text-foreground dark:text-white">Your coupons</p>
        {assignedLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your coupons...
          </div>
        ) : assignedCoupons.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">
            No coupons assigned to your account yet. If you received a code from EduBlast,
            enter it below.
          </p>
        ) : (
          <ul className="space-y-2">
            {assignedCoupons.map((coupon) => (
              <li
                key={coupon.id}
                className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground dark:text-white">
                    {PLAN_LABELS[coupon.plan_tier] ?? coupon.plan_tier}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {coupon.duration_months} month{coupon.duration_months === 1 ? "" : "s"} ·{" "}
                    <span className="font-mono tracking-wider text-foreground/80 dark:text-white/80">
                      {coupon.code}
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 rounded-lg font-semibold"
                  disabled={claimingCode === coupon.code || loading}
                  onClick={() => void claimCode(coupon.code, true)}
                >
                  {claimingCode === coupon.code ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-3.5 w-3.5" />
                      Claim
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasActivePaidPlan && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
          <p className="font-semibold text-emerald-300">Current subscription</p>
          <p className="mt-1">
            {PLAN_LABELS[profile.plan_tier!] ?? profile.plan_tier} — active until{" "}
            {formatCouponExpiryDate(profile.subscription_expires_at!)}
          </p>
          <p className="mt-1 text-emerald-400/80">
            Another coupon adds more months on top of this date (it does not wait until next month).
          </p>
        </div>
      )}

      {!hasActivePaidPlan && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground dark:border-white/10">
          <p className="font-semibold text-foreground dark:text-white">You&apos;re on the free plan</p>
          <p className="mt-1">
            Claiming a coupon upgrades you immediately. A 1-month coupon means Pro or Starter
            starts today and stays active for one full month from today.
          </p>
        </div>
      )}

      <form
        onSubmit={handleClaim}
        className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017] space-y-4"
      >
        <p className="text-xs font-semibold text-foreground dark:text-white">Enter code manually</p>
        <div className="space-y-2">
          <label htmlFor="coupon-code" className="text-xs font-medium text-muted-foreground">
            Coupon code
          </label>
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. 26ABC123"
            className="font-mono text-lg tracking-widest uppercase bg-background"
            autoComplete="off"
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full rounded-xl font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Claiming...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Claim coupon
            </>
          )}
        </Button>
      </form>

      {lastSuccess && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-foreground dark:text-white">You&apos;re all set!</p>
            <p className="text-muted-foreground">{lastSuccess.message}</p>
            {lastSuccess.detail ? (
              <p className="text-xs text-muted-foreground">{lastSuccess.detail}</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
