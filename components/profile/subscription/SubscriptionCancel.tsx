"use client";

import { useState, useMemo } from "react";
import { CircleMinus, X, Check, ArrowDown, Heart, Info, Loader2, ShieldCheck } from "lucide-react";
import type { SubViewId } from "./StudentSubscriptionHub";
import type { Profile } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizePlanTier } from "@/lib/subscription/subscriptionConfig";
import {
  computePaidSubscriptionPeriod,
  parseProfilePaymentDetails,
  resolveSubscriptionNowMs,
} from "@/lib/subscription/subscriptionBilling";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  profile: Profile;
  onNavigate: (view: SubViewId) => void;
}

const REASONS = [
  "Too expensive for me right now",
  "Not using Testbee enough",
  "Switching to a different platform",
  "Exam is over — no longer need it",
  "Technical issues with the platform",
  "Missing a feature I need",
  "Other reason",
];

export default function SubscriptionCancel({ profile, onNavigate }: Props) {
  const { refreshProfile } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [loading, setLoading] = useState(false);

  const planKey = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
  const planName = planKey === "pro" ? "Pro" : planKey === "starter" ? "Starter" : "Paid";

  const parsedCardDetails = useMemo(() => {
    if (!profile?.payment_card_details) return null;
    try {
      return typeof profile.payment_card_details === "string"
        ? JSON.parse(profile.payment_card_details)
        : profile.payment_card_details;
    } catch {
      return null;
    }
  }, [profile?.payment_card_details]);

  const alreadyCancelled = parsedCardDetails?.autoRenew === false;

  const period = computePaidSubscriptionPeriod(profile, resolveSubscriptionNowMs(profile));
  const formattedEndDate = period
    ? new Date(period.endMs).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "the end of your current billing cycle";

  const handleCancelRenewal = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const currentCardDetails =
        parseProfilePaymentDetails(profile.payment_card_details) ?? {};

      const { error } = await supabase
        .from("profiles")
        .update({
          payment_card_details: {
            ...currentCardDetails,
            autoRenew: false,
          },
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Renewal Cancelled",
        description: `Successfully turned off auto-renewal. Access is active until ${formattedEndDate}.`,
      });

      await refreshProfile();
      setConfirmOpen(false);
      setCancelled(true);
    } catch (e) {
      toast({
        title: "Cancellation Failed",
        description: e instanceof Error ? e.message : "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReenableRenewal = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const currentCardDetails =
        parseProfilePaymentDetails(profile.payment_card_details) ?? {};

      const { error } = await supabase
        .from("profiles")
        .update({
          payment_card_details: {
            ...currentCardDetails,
            autoRenew: true,
          },
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Auto-Renewal Re-enabled",
        description: `Successfully re-enabled auto-renewal. Your subscription will renew on ${formattedEndDate}.`,
      });

      await refreshProfile();
      onNavigate("overview");
    } catch (e) {
      toast({
        title: "Failed to re-enable",
        description: e instanceof Error ? e.message : "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToMonthly = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          plan_tier: "starter", // switch to starter
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Switched to Monthly Starter Plan",
        description: `Your billing cycle has been updated to ₹499/month.`,
      });

      await refreshProfile();
      onNavigate("overview");
    } catch (e) {
      toast({
        title: "Error switching plan",
        description: e instanceof Error ? e.message : "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (cancelled || alreadyCancelled) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-emerald-500/30 bg-[#0c1017]/80 p-6 text-center flex flex-col items-center justify-center gap-4">
          <ShieldCheck className="h-12 w-12 text-emerald-400" />
          <div>
            <h3 className="text-lg font-bold text-foreground dark:text-white">Auto-renewal is off</h3>
            <p className="mt-2 text-sm text-muted-foreground dark:text-slate-400 max-w-md mx-auto">
              Your {planName} plan remains fully active with all premium features until{" "}
              <span className="font-semibold text-foreground dark:text-white">{formattedEndDate}</span>.
              After this date, you will not be charged and your account will automatically revert to the Free tier.
            </p>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onNavigate("overview")}
              className="rounded-lg border border-border px-5 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Back to overview
            </button>
            <button
              onClick={handleReenableRenewal}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Re-enable Auto-Renewal
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 dark:bg-[#0c1017] dark:border-white/10">
          <p className="text-xs font-bold text-muted-foreground dark:text-slate-400">
            What you will lose after {formattedEndDate}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {[
              "Testbee adaptive mocks — reverts to 3 mocks/month",
              "Full Instacue library — limited to 20 saved cards",
              "Live lessons access — loses enrolment ability",
              "EduFund Starter eligibility — reverts to Sprout tier",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs text-rose-300/80">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-rose-500/30 bg-card p-4 dark:bg-[#0c1017]">
        <div className="flex items-center gap-2 border-b border-border pb-3 dark:border-white/10">
          <CircleMinus className="h-4 w-4 text-rose-400" />
          <span className="text-sm font-semibold text-foreground dark:text-white">
            Cancel subscription
          </span>
          <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            Active
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
          <p className="text-sm font-semibold text-rose-300">Are you sure you want to cancel?</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-300/80">
            Your {planName} plan is active until{" "}
            <span className="font-semibold text-rose-200">{formattedEndDate}</span>. If you cancel
            today, you will retain full access until that date. No pro-rated refund is provided for
            annual plans (but you may request one within 7 days of renewal).
          </p>
        </div>

        <p className="mt-4 text-xs font-semibold text-muted-foreground dark:text-slate-400">
          What you will lose after {formattedEndDate}
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {[
            "Testbee adaptive mocks — reverts to 3 mocks/month",
            "Full Instacue library — limited to 20 saved cards",
            "Live lessons access — loses enrolment ability",
            "EduFund Starter eligibility — reverts to Sprout tier",
          ].map((item) => (
            <div key={item} className="flex items-start gap-1.5 text-xs text-rose-300/80">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              {item}
            </div>
          ))}
          <div className="flex items-start gap-1.5 text-xs text-emerald-400">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            Your account, RDM balance, and Gyan++ history are kept forever
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium text-muted-foreground dark:text-slate-400">
            Reason for cancelling <span className="text-rose-400">*</span>
          </label>
          <Select value={reason} onValueChange={(val) => setReason(val || "")}>
            <SelectTrigger className="mt-1 h-10 w-full min-w-0 border-muted-foreground/20 bg-muted dark:border-white/10 dark:bg-white/5 text-foreground dark:text-white">
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent className="bg-[#121324] border border-white/10 text-slate-100">
              <SelectGroup>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted p-3 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-semibold text-foreground dark:text-white">
            Before you cancel — have you considered?
          </p>
          <div className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground dark:text-slate-400">
            <div className="flex items-start gap-1.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              Pausing auto-renewal — you keep full access until expiry, with no future charge.
            </div>
            {planKey === "pro" && (
              <div className="flex items-start gap-1.5">
                <ArrowDown className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                Downgrading to monthly Starter billing — ₹499/month, no long-term commitment.
              </div>
            )}
            <div className="flex items-start gap-1.5">
              <Heart className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Your EduFund grant eligibility resets if you drop below Starter tier — you have earned RDM rewards.
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate("overview")}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 disabled:opacity-50"
          >
            Keep my subscription
          </button>
          {planKey === "pro" && (
            <button
              onClick={handleSwitchToMonthly}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 px-4 py-2 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/10 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDown className="h-3.5 w-3.5" />}
              Switch to monthly Starter
            </button>
          )}
          <button
            onClick={() => {
              if (!reason) {
                toast({
                  title: "Select Reason",
                  description: "Please select a reason for cancellation first.",
                  variant: "destructive",
                });
                return;
              }
              setConfirmOpen(true);
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            <CircleMinus className="h-3.5 w-3.5" />
            Cancel auto-renewal
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 dark:border-white/10 dark:bg-[#0c1017] shadow-xl">
            <div className="flex items-center gap-2">
              <CircleMinus className="h-5 w-5 text-rose-400" />
              <p className="text-base font-bold text-foreground dark:text-white">
                Confirm cancellation
              </p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground dark:text-slate-400">
              Auto-renewal will be turned off. You will retain {planName} access until{" "}
              <span className="font-semibold text-foreground dark:text-white">
                {formattedEndDate}
              </span>
              , then revert to the Free tier.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
              >
                Go back
              </button>
              <button
                onClick={handleCancelRenewal}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Yes, cancel renewal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
