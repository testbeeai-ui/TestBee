"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Clock, CheckCircle2, ArrowRight, Flame, Award, AlertTriangle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import type { Profile } from "@/hooks/auth-context";
import { TIME_TRAVEL_OFFSET_CHANGED_EVENT } from "@/lib/dev/timeTravel";
import {
  resolveFreeTrialStartMs,
  resolveTrialDurationMsForProfile,
} from "@/lib/subscription/freeTrialTimer";
import {
  isSecondRoundStillClaimable,
  isWithinTrialEndBonusWindow,
} from "@/lib/subscription/trialLifecycle";
import {
  qualifiesForTrialExtensionBonus,
  parseDailyStreakServerState,
} from "@/lib/onboarding/dailyStreakProgress";

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
    return trialStartMs + resolveTrialDurationMsForProfile(
      {
        free_trial_activated_at: profile?.free_trial_activated_at,
        free_trial_activated: profile?.free_trial_activated,
        created_at: profile?.created_at,
        trial_second_round_activated: profile?.trial_second_round_activated,
      },
      null
    );
  }, [
    trialStartMs,
    profile?.free_trial_activated_at,
    profile?.free_trial_activated,
    profile?.created_at,
    profile?.trial_second_round_activated,
  ]);

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

  const canClaimSecondRound = useMemo(
    () =>
      isScenario1 &&
      isSecondRoundStillClaimable(
        {
          free_trial_activated_at: profile?.free_trial_activated_at,
          free_trial_activated: profile?.free_trial_activated,
          created_at: profile?.created_at,
          trial_second_round_activated: profile?.trial_second_round_activated,
        },
        now
      ),
    [
      isScenario1,
      now,
      profile?.free_trial_activated_at,
      profile?.free_trial_activated,
      profile?.created_at,
      profile?.trial_second_round_activated,
    ]
  );

  const canClaimPaidBonus = useMemo(
    () =>
      isWithinTrialEndBonusWindow(
        {
          free_trial_activated_at: profile?.free_trial_activated_at,
          free_trial_activated: profile?.free_trial_activated,
          created_at: profile?.created_at,
          trial_second_round_activated: profile?.trial_second_round_activated,
        },
        now
      ),
    [
      now,
      profile?.free_trial_activated_at,
      profile?.free_trial_activated,
      profile?.created_at,
      profile?.trial_second_round_activated,
    ]
  );

  const canSubmitUpgrade = canClaimSecondRound || canClaimPaidBonus;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitUpgrade) {
      setSubmitError(
        "The 24-hour bonus window has closed. Continue on Free, or upgrade later from Profile → Subscription."
      );
      return;
    }

    setLoading(true);
    setSubmitError(null);
    try {
      const res = await fetchWithClientAuth("/api/user/subscription/claim-bonus", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        scenario?: number;
        alreadyClaimed?: boolean;
      };

      if (body.alreadyClaimed) {
        onCompletionHold?.();
        setSuccessData({ scenario: isScenario1 ? 1 : 2, plan: selectedPlan });
        await onSuccess();
        toast({
          title: "Already saved",
          description: "Your plan choice is already on file. Continue to the app.",
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
        description:
          body.scenario === 1
            ? "Unlocked 2 more weeks of free trial."
            : `Upgraded to ${selectedPlan === "pro" ? "Pro" : "Starter"} with a 1-month free bonus.`,
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
            className="trial-expiration-card relative mx-auto w-full max-w-[min(52rem,calc(100vw-1rem))] h-auto max-h-[calc(100dvh-1rem)] min-h-0 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#121324]/95 shadow-2xl text-slate-100 flex flex-col lg:grid lg:grid-cols-[1.05fr_0.92fr] lg:items-stretch lg:gap-4 gap-2.5 p-3 sm:p-4 lg:p-5 overflow-hidden"
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
                    ? "Unlock 2 more weeks FREE"
                    : "Choose how you want to keep learning"}
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
                    ? `Thank you for completing the trial track. You can unlock one more 2-week free trial now.

Razorpay card checkout comes later — we will not charge you today, and we do not store card numbers.`
                    : `Thank you for undergoing our FREE trial. Pick Starter or Pro to start a 1-month free bonus (no charge today). After that month, you will move to Free until Razorpay checkout is live.

If you wait more than 24 hours, the 1-month bonus closes and you can continue on Free.`}
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

                <div className="mt-1 pt-3 border-t border-white/[0.06] space-y-2">
                  <p className="text-[11px] sm:text-xs text-slate-400 leading-snug text-center">
                    Trial complete — lessons and Daily Dose stay on Free.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDowngradeWarning(true)}
                    className="w-full h-11 rounded-xl border border-white/15 bg-white/[0.04] text-sm sm:text-base font-semibold tracking-tight text-slate-100 hover:bg-white/[0.08] hover:border-white/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    aria-label="Continue with Free Plan"
                  >
                    Continue with Free Plan
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col w-full h-full min-h-0 border border-white/5 bg-[#0a0f1d] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
                  <div className="bg-[#122543] px-4 py-3 sm:px-5 sm:py-3.5 text-left flex items-center justify-between gap-2 border-b border-white/5 shrink-0">
                <div className="flex flex-col">
                  <div className="text-[10px] sm:text-xs font-extrabold tracking-widest text-[#2b7ae4] uppercase">No charge today</div>
                  <div className="text-xs sm:text-sm font-bold text-white mt-0.5">
                    {canClaimSecondRound
                      ? "Unlock extra 2 weeks"
                      : canClaimPaidBonus
                        ? "Start 1-month free bonus"
                        : "Bonus window closed"}
                  </div>
                </div>
                <div className="flex flex-col text-right shrink-0">
                  <div className="text-[9px] sm:text-[10px] text-[#2b7ae4] font-bold uppercase tracking-wider">After bonus</div>
                  <div className="text-sm sm:text-base font-black text-emerald-400 flex flex-col items-end">
                    <span>{selectedPlan === "pro" ? "₹899" : "₹499"}</span>
                    <span className="text-[8px] text-slate-400 font-normal uppercase tracking-tight -mt-0.5">/mo later via Razorpay</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-4 sm:p-5 flex flex-col gap-4 flex-1 min-h-0">
                {submitError ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-2.5 py-2 text-[10px] sm:text-xs text-rose-200 leading-snug"
                  >
                    {submitError}
                  </div>
                ) : null}
                <p className="text-[11px] sm:text-xs text-slate-300 leading-snug">
                  {canSubmitUpgrade
                    ? canClaimSecondRound
                      ? "Confirm your plan to unlock 2 more weeks of trial. You will be asked again when those 2 weeks end."
                      : "Confirm your plan to start a 30-day free bonus month. After that you move to the Free plan until paid checkout is ready."
                    : "The 24-hour 1-month bonus has closed. Continue on Free below. Paid checkout with Razorpay will be added later."}
                </p>

                <div className="mt-auto space-y-3 shrink-0 pt-2">
                  <button
                    type="submit"
                    disabled={loading || !canSubmitUpgrade}
                    className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-extrabold text-slate-950 rounded-xl text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>
                          {canClaimSecondRound
                            ? "Unlock 2 more weeks"
                            : canClaimPaidBonus
                              ? "Start 1-month free bonus"
                              : "Bonus unavailable"}
                        </span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>

                  <div className="flex justify-center items-center gap-1.5 text-[9px] sm:text-[10px] text-slate-400 font-semibold tracking-wider uppercase bg-white/5 py-1.5 px-2.5 rounded-full border border-white/5 w-fit mx-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>No card stored · Razorpay later</span>
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
              <span>
                {successData.scenario === 1
                  ? "Extra 2 weeks unlocked"
                  : "1-month free bonus started"}
              </span>
            </h2>

            <p className="text-sm text-slate-300 mt-4 leading-relaxed">
              {successData.scenario === 1
                ? "You unlocked a second 2-week free trial. When those 2 weeks end, you will choose again: continue on Free, or start a 1-month bonus. No card was stored."
                : `You are on the ${successData.plan === "pro" ? "Pro" : "Starter"} plan for a 30-day free bonus month. After that you move to Free until Razorpay checkout is live. No card was stored.`}
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
