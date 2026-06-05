"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Clock, CreditCard, Lock, CheckCircle2, ArrowRight, Flame, Award, AlertTriangle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import type { Profile } from "@/hooks/auth-context";
import { TIME_TRAVEL_OFFSET_CHANGED_EVENT } from "@/lib/dev/timeTravel";
import {
  FREE_TRIAL_DURATION_MS,
  resolveFreeTrialStartMs,
} from "@/lib/subscription/freeTrialTimer";
import {
  qualifiesForTrialExtensionBonus,
  parseDailyStreakServerState,
} from "@/lib/onboarding/dailyStreakProgress";

type CardDetails = {
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
};

type TrialExpirationOverlayProps = {
  /** Parent gates trial end + no prior bonus claim (dashboard simulated clock). */
  open: boolean;
  profile: Profile | null;
  /** Days 1–10 onboarding track completed (site tour + daily streak claims). */
  trialTrackerDaysCompleted: number;
  onSuccess: () => Promise<void>;
  /** Parent keeps overlay mounted after save until user dismisses success screen. */
  onCompletionHold?: () => void;
  onFinished?: () => void;
};

const BONUS_WINDOW_MS = 24 * 60 * 60 * 1000;

// Simple card detection utility
function detectCardBrand(num: string): "visa" | "mastercard" | "rupay" | "amex" | "generic" {
  const clean = num.replace(/\s/g, "");
  if (clean.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(clean)) return "mastercard";
  if (/^(508|60|65)/.test(clean)) return "rupay";
  if (clean.startsWith("3")) return "amex";
  return "generic";
}

export default function TrialExpirationOverlay({
  open,
  profile,
  trialTrackerDaysCompleted,
  onSuccess,
  onCompletionHold,
  onFinished,
}: TrialExpirationOverlayProps) {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "pro">("starter");
  const [loading, setLoading] = useState(false);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [successData, setSuccessData] = useState<{
    scenario: number;
    plan: string;
  } | null>(null);

  // Form states
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    cardNumber: "",
    cardholderName: "",
    expiryDate: "",
    cvv: "",
  });

  const [formErrors, setFormErrors] = useState<Partial<CardDetails>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const serverStreak = useMemo(
    () => parseDailyStreakServerState(profile?.free_trial_daily_streak),
    [profile?.free_trial_daily_streak]
  );

  const isScenario1 = useMemo(
    () =>
      qualifiesForTrialExtensionBonus(
        profile?.id,
        profile?.onboarding_reward_claimed_at,
        serverStreak
      ),
    [profile?.id, profile?.onboarding_reward_claimed_at, serverStreak]
  );

  const [portalReady, setPortalReady] = useState(false);
  const [now, setNow] = useState(() => Date.now() + (profile?.time_travel_offset_ms ?? 0));

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const tick = () => setNow(Date.now() + (profile?.time_travel_offset_ms ?? 0));
    tick();
    const interval = setInterval(tick, 1000);
    const onTimeTravel = () => tick();
    window.addEventListener(TIME_TRAVEL_OFFSET_CHANGED_EVENT, onTimeTravel);
    return () => {
      clearInterval(interval);
      window.removeEventListener(TIME_TRAVEL_OFFSET_CHANGED_EVENT, onTimeTravel);
    };
  }, [profile?.time_travel_offset_ms]);

  const trialStartMs = useMemo(
    () =>
      resolveFreeTrialStartMs({
        freeTrialActivatedAt: profile?.free_trial_activated_at,
        freeTrialActivated: profile?.free_trial_activated,
        createdAt: profile?.created_at,
      }),
    [profile?.free_trial_activated_at, profile?.free_trial_activated, profile?.created_at]
  );

  const trialEndMs = useMemo(() => {
    if (trialStartMs == null) return now;
    const durationMs = profile?.trial_second_round_activated
      ? FREE_TRIAL_DURATION_MS * 2
      : FREE_TRIAL_DURATION_MS;
    return trialStartMs + durationMs;
  }, [trialStartMs, now, profile?.trial_second_round_activated]);

  const bonusDeadlineMs = trialEndMs + BONUS_WINDOW_MS;
  const remainingMs = Math.max(0, bonusDeadlineMs - now);
  const isBonusWindowActive = open && remainingMs > 0;

  const countdownText = useMemo(() => {
    if (remainingMs <= 0) return "00:00:00";
    const totalSecs = Math.floor(remainingMs / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [remainingMs]);

  const cardBrand = useMemo(() => detectCardBrand(cardDetails.cardNumber), [cardDetails.cardNumber]);

  const isVisible = open || successData != null;

  useEffect(() => {
    if (!isVisible) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [isVisible]);

  if (!open && !successData) return null;
  if (!portalReady) return null;

  // Formatting utility for card number formatting
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 19);
    const formatted = val.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardDetails((prev) => ({ ...prev, cardNumber: formatted }));
    setFormErrors((prev) => ({ ...prev, cardNumber: undefined }));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (val.length >= 2) {
      val = val.slice(0, 2) + "/" + val.slice(2);
    }
    setCardDetails((prev) => ({ ...prev, expiryDate: val }));
    setFormErrors((prev) => ({ ...prev, expiryDate: undefined }));
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardDetails((prev) => ({ ...prev, cvv: val }));
    setFormErrors((prev) => ({ ...prev, cvv: undefined }));
  };

  const validateForm = (): boolean => {
    const errors: Partial<CardDetails> = {};
    const digits = cardDetails.cardNumber.replace(/\s/g, "");
    if (digits.length < 15 || digits.length > 16) {
      errors.cardNumber = "Enter a valid 15–16 digit card number";
    }
    if (!cardDetails.cardholderName.trim()) {
      errors.cardholderName = "Cardholder name is required";
    }
    if (!/^\d{2}\/\d{2}$/.test(cardDetails.expiryDate.trim())) {
      errors.expiryDate = "Use MM/YY format (e.g. 12/28)";
    }
    const cvvLen = cardDetails.cvv.replace(/\D/g, "").length;
    if (cvvLen < 3 || cvvLen > 4) {
      errors.cvv = "Enter 3 or 4 digit CVV";
    }
    setFormErrors(errors);
    setSubmitError(null);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setSubmitError(null);
    try {
      const res = await fetchWithClientAuth("/api/user/subscription/claim-bonus", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          cardDetails: {
            ...cardDetails,
            cardNumber: cardDetails.cardNumber.replace(/\s/g, ""),
            cvv: cardDetails.cvv.replace(/\D/g, ""),
          },
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        scenario?: number;
        alreadyClaimed?: boolean;
      };

      if (res.status === 409 && body.error?.includes("already claimed")) {
        onCompletionHold?.();
        setSuccessData({ scenario: isScenario1 ? 1 : 2, plan: selectedPlan });
        await onSuccess();
        toast({
          title: "Already saved",
          description: "Your card details are on file. Continue to the app.",
        });
        return;
      }

      if (!res.ok) {
        const msg = body.error || `Failed to process upgrade (${res.status}).`;
        setSubmitError(msg);
        throw new Error(msg);
      }

      import("canvas-confetti").then((confetti) => {
        confetti.default({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
        });
      });

      onCompletionHold?.();
      setSuccessData({
        scenario: body.scenario === 1 ? 1 : 2,
        plan: selectedPlan,
      });

      await onSuccess();

      toast({
        title: "Success! 🎉",
        description: body.scenario === 1 
          ? "Activated 2-week FREE trial & 1-month bonus!"
          : `Upgraded to ${selectedPlan === "pro" ? "Pro" : "Starter"} Plan & 1-month bonus applied!`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      if (!submitError) setSubmitError(message);
      toast({
        title: "Upgrade Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToFreePlan = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const res = await fetchWithClientAuth("/api/user/subscription/exit-trial-to-free", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `Could not switch to Free plan (${res.status}).`);
      }

      toast({
        title: "You're on the Free plan",
        description:
          "You can study with Free limits. Upgrade anytime from Profile → Subscription.",
      });

      onCompletionHold?.();
      await onSuccess();
      onFinished?.();
      setShowDowngradeWarning(false);
    } catch (err) {
      toast({
        title: "Could not continue on Free",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expiration-title"
      className="trial-expiration-root fixed inset-0 z-[2147483000] h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#07070e]/98 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 pointer-events-auto overscroll-none"
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      <AnimatePresence mode="wait">
        {!successData ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="trial-expiration-card relative mx-auto w-full max-w-[min(52rem,calc(100vw-1rem))] h-auto max-h-[calc(100dvh-1rem)] min-h-0 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#121324]/95 shadow-2xl text-slate-100 flex flex-col lg:grid lg:grid-cols-[1.05fr_0.92fr] lg:items-start lg:gap-4 gap-2.5 p-3 sm:p-4 lg:p-5 overflow-hidden"
          >
            {/* Left: plan info */}
            <div className="flex flex-col gap-2 sm:gap-2.5 min-h-0 overflow-hidden">
              <div className="flex flex-col gap-2 sm:gap-2.5 min-h-0 overflow-hidden">
                <div className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-[10px] sm:text-xs font-bold text-violet-400">
                  <Sparkles size={12} className="animate-pulse shrink-0" />
                  <span>Action required — trial ended</span>
                </div>

                <h1
                  id="trial-expiration-title"
                  className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent leading-tight"
                >
                  {isScenario1
                    ? "Add card details — unlock 2 more weeks FREE"
                    : "Add card details to keep learning"}
                </h1>

                <div className="flex items-center gap-2 sm:gap-3 bg-white/5 border border-white/5 p-2 sm:p-3 rounded-xl sm:rounded-2xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500/10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                    <Flame size={18} className="text-amber-500 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Trial track (Days 1–10 in 14 days)</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 leading-snug">
                      {trialTrackerDaysCompleted} of 10 days completed
                      {isScenario1 ? " (Track complete — +2 weeks FREE! 🎯)" : " (Track incomplete 💔)"}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] sm:text-xs lg:text-sm text-slate-300 leading-snug whitespace-pre-line">
                  {isScenario1
                    ? `Thank you for undergoing our trial. Based on your activity streak and number of RDM earned, we are offering you one more round of 2-week FREE trial.

To avail this, go to Upgrade Plan and provide your payments details. If you enter your payment details within next 24 hours, we have a special surprise Bonus for you!

Note: No charge will be initiated till the additional 2-week FREE trial is over.`
                    : `Thank you for undergoing our FREE trial. To continue, go to the Upgrade Plan option and provide your payments details.

If you enter your payment details within next 24 hours, we have a special surprise Bonus for you!`}
                </p>
              </div>

              {/* Ticking 24h Countdown Bonus Box */}
              {isBonusWindowActive && (
                <div className="shrink-0 rounded-xl sm:rounded-2xl border border-amber-500/30 bg-amber-500/5 p-2.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-amber-400">
                      <Clock size={11} className="animate-spin-slow shrink-0" />
                      <span>Limited Bonus Window</span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-300 leading-snug">
                      Claim payment details within 24h for a <strong className="text-white font-bold">1-Month FREE Bonus</strong>!
                    </p>
                  </div>
                  <div className="bg-[#1b1510] border border-amber-500/30 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-center shrink-0 self-start sm:self-center">
                    <div className="text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest">Time Left</div>
                    <div className="text-base sm:text-lg font-mono font-bold text-amber-400 tracking-tight">{countdownText}</div>
                  </div>
                </div>
              )}

              <div className="shrink-0 space-y-2 sm:space-y-3">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-widest">Select Your Plan</p>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("starter")}
                    className={`flex flex-col p-2 sm:p-3 rounded-xl sm:rounded-2xl text-left border transition-all duration-300 ${
                      selectedPlan === "starter"
                        ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold text-slate-100">Starter Plan</span>
                    <span className="text-base sm:text-lg font-black text-emerald-400 mt-0.5 sm:mt-1 leading-none">₹499<span className="text-[10px] sm:text-xs font-normal text-slate-400">/mo after free month</span></span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 sm:mt-1 leading-tight">Ideal for core learning resources</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPlan("pro")}
                    className={`flex flex-col p-2 sm:p-3 rounded-xl sm:rounded-2xl text-left border transition-all duration-300 ${
                      selectedPlan === "pro"
                        ? "border-violet-500 bg-violet-500/5 ring-1 ring-violet-500/20"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1">
                      Pro Plan <Award size={11} className="text-violet-400 shrink-0" />
                    </span>
                    <span className="text-base sm:text-lg font-black text-violet-400 mt-0.5 sm:mt-1 leading-none">₹899<span className="text-[10px] sm:text-xs font-normal text-slate-400">/mo after free month</span></span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 sm:mt-1 leading-tight">Unlimited access + double RDM rate</span>
                  </button>
                </div>

                {/* Secondary exit: low salience (ethical nudge — still visible & tappable) */}
                <div className="mt-1 pt-2 sm:pt-2.5 border-t border-white/[0.06]">
                  <p className="text-[8px] sm:text-[9px] text-center text-slate-600/90 leading-snug">
                    Standard Free: lessons &amp; Daily Dose only — no past papers or full-length mocks.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDowngradeWarning(true)}
                    className="mt-1.5 mx-auto block max-w-[16rem] text-center text-[9px] sm:text-[10px] font-normal text-slate-600/75 hover:text-slate-500 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:rounded px-1 py-0.5 transition-colors"
                    aria-label="Continue on standard Free plan without adding a card"
                  >
                    Continue without card — use Free plan
                  </button>
                </div>
              </div>
            </div>

            {/* Right: payment — content-height (no vertical stretch) */}
            <div className="flex flex-col w-full border border-white/5 bg-[#0a0f1d] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl shrink-0">
              <div className="bg-[#122543] px-3 py-2 sm:px-3.5 sm:py-2.5 text-left flex items-center justify-between gap-2 border-b border-white/5 shrink-0">
                <div className="flex flex-col">
                  <div className="text-[10px] sm:text-xs font-extrabold tracking-widest text-[#2b7ae4] uppercase">Secure Checkout</div>
                  <div className="text-xs sm:text-sm font-bold text-white mt-0.5">Testbee Autopay Activation</div>
                </div>
                <div className="flex flex-col text-right shrink-0">
                  <div className="text-[9px] sm:text-[10px] text-[#2b7ae4] font-bold uppercase tracking-wider">AMOUNT TO PAY</div>
                  <div className="text-sm sm:text-base font-black text-emerald-400 flex flex-col items-end">
                    <span>{selectedPlan === "pro" ? "₹899" : "₹499"}</span>
                    <span className="text-[8px] text-slate-400 font-normal uppercase tracking-tight -mt-0.5">Autopay Setup</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-3 sm:p-3.5 flex flex-col gap-2.5 sm:gap-3">
                {submitError ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-2.5 py-2 text-[10px] sm:text-xs text-rose-200 leading-snug"
                  >
                    {submitError}
                  </div>
                ) : null}
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">
                    <span>Card Details</span>
                    <div className="flex items-center gap-1 text-[#2b7ae4]">
                      <Lock size={11} />
                      <span className="scale-95">100% SECURE CHECKOUT</span>
                    </div>
                  </div>

                  {/* Nested Card Input Box Layout (Razorpay Style) */}
                  <div className="border border-white/10 rounded-2xl bg-[#03060f] overflow-hidden focus-within:border-[#2b7ae4] transition-all duration-300">
                    
                    {/* Card Number Container */}
                    <div className="relative border-b border-white/10">
                      <input
                        type="text"
                        required
                        placeholder="Card Number"
                        value={cardDetails.cardNumber}
                        onChange={handleCardNumberChange}
                        className="w-full bg-transparent border-0 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-0"
                      />
                      
                      {/* Dynamic Card Network Logo */}
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center h-full">
                        {cardBrand === "visa" && (
                          <span className="text-xs font-black italic tracking-wide text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/20">Visa</span>
                        )}
                        {cardBrand === "mastercard" && (
                          <span className="text-xs font-black italic tracking-wide text-orange-400 bg-orange-950/20 px-2 py-0.5 rounded border border-orange-500/20">Mastercard</span>
                        )}
                        {cardBrand === "rupay" && (
                          <span className="text-xs font-extrabold tracking-tight text-blue-200 bg-white/5 px-2 py-0.5 rounded border border-white/10">RuPay</span>
                        )}
                        {cardBrand === "amex" && (
                          <span className="text-xs font-extrabold tracking-wide text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-500/20">Amex</span>
                        )}
                        {cardBrand === "generic" && (
                          <CreditCard className="text-slate-500" size={16} />
                        )}
                      </div>
                    </div>

                    {/* Expiry and CVV Grid Container */}
                    <div className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10">
                      <input
                        type="text"
                        required
                        placeholder="Expiry (MM/YY)"
                        value={cardDetails.expiryDate}
                        onChange={handleExpiryChange}
                        className="w-full bg-transparent border-0 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-0 text-center"
                      />
                      <input
                        type="password"
                        required
                        placeholder="CVV"
                        value={cardDetails.cvv}
                        onChange={handleCvvChange}
                        className="w-full bg-transparent border-0 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-0 text-center"
                      />
                    </div>

                    {/* Cardholder Name */}
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Cardholder Name"
                        value={cardDetails.cardholderName}
                        onChange={(e) => {
                          setCardDetails((prev) => ({ ...prev, cardholderName: e.target.value }));
                          setFormErrors((prev) => ({ ...prev, cardholderName: undefined }));
                        }}
                        className="w-full bg-transparent border-0 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-0"
                      />
                    </div>
                  </div>

                  {/* Form validation alert lines */}
                  {Object.values(formErrors).filter(Boolean).length > 0 && (
                    <div className="text-[10px] text-rose-500 flex flex-col space-y-0.5 bg-rose-950/10 border border-rose-500/20 rounded-xl p-2">
                      {Object.entries(formErrors).map(([key, value]) => value && (
                        <span key={key}>• {value}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 shrink-0">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-9 sm:h-10 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-extrabold text-slate-950 rounded-lg text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{isScenario1 ? "Activate Autopay & Claim Bonus" : "Activate Autopay & Claim Free Month"}</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>

                  <div className="flex justify-center items-center gap-1.5 text-[9px] sm:text-[10px] text-slate-400 font-semibold tracking-wider uppercase bg-white/5 py-1.5 px-2.5 rounded-full border border-white/5 w-fit mx-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>PCI-DSS Secured Gateway</span>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        ) : (
          /* SUCCESS MODAL */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="w-full max-w-lg max-h-[calc(100dvh-1rem)] rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-[#0c1e19]/95 p-5 sm:p-8 text-center text-slate-100 shadow-2xl relative overflow-hidden flex flex-col justify-center"
          >
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="mx-auto w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2 size={36} />
            </div>

            <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
              {successData.scenario === 1 ? "2-Week Free Trial Extended!" : "Upgrade Active!"}
            </h1>

            <h2 className="text-base font-bold text-emerald-400 mt-2 flex items-center justify-center gap-1.5">
              <Sparkles size={16} />
              <span>Special 1-Month Free Bonus Activated!</span>
            </h2>

            <p className="text-sm text-slate-300 mt-4 leading-relaxed">
              {successData.scenario === 1
                ? `You have successfully unlocked your second round of 2-week FREE trial. All onboarding checklists are now bypassed so you can study freely.

Your payment credentials have been successfully registered, and your 1-month free bonus month has been activated automatically! No charge will be made until after the extended trial completes.`
                : `You have successfully upgraded your account to the ${successData.plan === "pro" ? "Pro" : "Starter"} Plan! 

Because you submitted details within the bonus window, your first month has been completely credited as a FREE bonus month. Billing will start after the bonus period ends.`}
            </p>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void onSuccess()
                  .then(() => {
                    setSuccessData(null);
                    onFinished?.();
                  })
                  .finally(() => setLoading(false));
              }}
              className="mt-8 w-full h-11 bg-emerald-400 hover:bg-emerald-300 font-extrabold text-slate-950 rounded-xl text-sm transition-all duration-300 active:scale-[0.99] flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                "Let's Go Study!"
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DANGEROUS DOWNGRADE HIGH-FRICTION CONFIRMATION GATE */}
      <AnimatePresence>
        {showDowngradeWarning && (
          <div className="fixed inset-0 z-[2147483001] h-[100dvh] overflow-hidden flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-[#16120e] p-6 sm:p-8 text-center text-slate-100 shadow-2xl relative overflow-hidden"
            >
              <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle size={24} className="animate-pulse" />
              </div>

              <h2 className="text-xl font-extrabold text-amber-400">Wait! Are you absolutely sure?</h2>
              <p className="text-xs text-slate-400 mt-1">You are about to downgrade your account</p>

              {/* Loss Aversion Bullet List */}
              <div className="mt-5 space-y-2.5 text-left bg-black/40 border border-white/5 rounded-2xl p-4">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Features you will lose immediately:</p>
                <ul className="space-y-2 text-xs text-slate-300 font-medium">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold shrink-0">❌</span>
                    <span>No access to <strong className="text-white">Past Exam Papers</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold shrink-0">❌</span>
                    <span>No access to <strong className="text-white">Full-length Timed Mock Tests</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold shrink-0">❌</span>
                    <span>No <strong className="text-white">Active RDM Multiplier</strong> (locked to standard 0.25x)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold shrink-0">❌</span>
                    <span>Lose your <strong className="text-amber-400 font-bold">1-Month FREE subscription bonus</strong></span>
                  </li>
                </ul>
              </div>

              {/* CTAs incorporating behavioral nudging */}
              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDowngradeWarning(false)}
                  className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-black text-slate-950 rounded-xl text-sm transition-all duration-300 flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/10 active:scale-[0.99]"
                >
                  <span>No, Keep Premium & Secure Bonus</span>
                  <ChevronRight size={14} />
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleContinueToFreePlan}
                  className="w-full py-2 bg-transparent font-normal text-slate-500/80 hover:text-slate-400 text-[10px] sm:text-[11px] underline-offset-2 hover:underline transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "I understand — switch to Free plan anyway"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
