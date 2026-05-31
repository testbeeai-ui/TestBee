"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, RefreshCw, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PLAN_TIERS } from "./types";
import type { SubViewId } from "./StudentSubscriptionHub";
import type { Profile } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { setUserSubscriptionPlan } from "@/lib/subscription/subscriptionPlanApi";
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
  type SubscriptionConfig,
  type SubscriptionPlanKey,
  type SubscriptionPlanLimits,
} from "@/lib/subscription/subscriptionConfig";

interface Props {
  profile: Profile;
  onNavigate: (view: SubViewId) => void;
}

function humanPrice(priceMonthly: number): string {
  if (priceMonthly <= 0) return "Rs 0";
  return `Rs ${priceMonthly}`;
}

function fmt(limit: number, unit: string): string {
  return isUnlimited(limit) ? `Unlimited ${unit}` : `${limit} ${unit}`;
}

function fmtMultiplier(multiplierPct: number): string {
  const asX = (multiplierPct / 100).toFixed(multiplierPct % 100 === 0 ? 0 : 1);
  return `${asX}x rate`;
}

function keyFeatures(limits: SubscriptionPlanLimits): string[] {
  return [
    `Magic Wall: up to ${fmt(limits.magicWallMaxActiveTopics, "active")}; ${fmt(limits.magicWallMonthlyAttempts, "new picks per billing month")} (from signup date)`,
    `Gyan++ doubts: ${fmt(limits.gyanDoubtsPerDay, "per day")}`,
    `Testbee mocks: ${fmt(limits.mocksPerMonth, "per month")}`,
    `DailyDose: ${fmt(limits.dailyDoseQuestionsPerDay, "per day")}`,
    `Learning buddies: ${fmt(limits.buddiesLimit, "active connections")}`,
  ];
}

function patchItemBadge(
  itemName: string,
  baseBadge: string | undefined,
  limits: SubscriptionPlanLimits
): string | undefined {
  const name = itemName.toLowerCase();
  if (name.includes("magic wall")) {
    return `${fmt(limits.magicWallMaxActiveTopics, "active")} · ${fmt(limits.magicWallMonthlyAttempts, "new picks/billing month")}`;
  }
  if (name.includes("gyan++")) return fmt(limits.gyanDoubtsPerDay, "per day");
  if (name === "lessons") return fmt(limits.lessonsChapterLimit, "chapters");
  if (name.includes("instacue")) return fmt(limits.instacueCardLimit, "cards");
  if (name.includes("testbee mocks")) return fmt(limits.mocksPerMonth, "per month");
  if (name.includes("dailydose")) return fmt(limits.dailyDoseQuestionsPerDay, "per day");
  if (name.includes("learning buddy")) return fmt(limits.buddiesLimit, "active buddies");
  if (name.includes("rdm accumulation")) return fmtMultiplier(limits.rdmMultiplierPct);
  return baseBadge;
}

export default function SubscriptionPlans({ profile }: Props) {
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const [switchingPlan, setSwitchingPlan] = useState<SubscriptionPlanKey | null>(null);
  const [billingMode, setBillingMode] = useState<"monthly" | "annual">("monthly");
  const [expanded, setExpanded] = useState<Record<SubscriptionPlanKey, boolean>>({
    free_trial: false,
    free: false,
    starter: false,
    pro: false,
  });
  const [config, setConfig] = useState<SubscriptionConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configRefreshing, setConfigRefreshing] = useState(false);

  const currentPlan = useMemo(
    () => normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated),
    [profile?.plan_tier, profile?.free_trial_activated]
  );

  const loadConfig = async (refresh = false) => {
    if (refresh) setConfigRefreshing(true);
    else setConfigLoading(true);
    try {
      const cfg = await fetchSubscriptionConfig();
      setConfig(cfg);
    } finally {
      setConfigLoading(false);
      setConfigRefreshing(false);
    }
  };

  useEffect(() => {
    void loadConfig(false);
    const onFocus = () => void loadConfig(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const displayPlans = useMemo(() => {
    const liveConfig = config ?? ({} as SubscriptionConfig);
    return PLAN_TIERS.map((basePlan) => {
      const limits = getPlanLimits(liveConfig, basePlan.id);
      return {
        ...basePlan,
        keyFive: keyFeatures(limits),
        categories: basePlan.categories.map((category) => ({
          ...category,
          items: category.items.map((item) => ({
            ...item,
            badge: patchItemBadge(item.name, item.badge, limits),
          })),
        })),
      };
    });
  }, [config]);

  const activate = async (plan: SubscriptionPlanKey) => {
    if (switchingPlan) return;
    setSwitchingPlan(plan);
    try {
      await setUserSubscriptionPlan(plan);
      await refreshProfile();
      await loadConfig(true);
      toast({
        title: "Plan updated",
        description: `Active plan is now ${plan.replace("_", " ")}.`,
      });
    } catch (e) {
      toast({
        title: "Could not switch plan",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSwitchingPlan(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Premium Glassmorphic Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
        {/* Subtle Ambient Light Glow behind header */}
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-500/10 blur-[80px]" />
        <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-purple-500/10 blur-[80px]" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              Choose a plan
            </h2>
            <p className="mt-1.5 text-sm font-medium text-slate-400">
              Testing mode is active. Activate Free Trial, Free, Starter, or Pro anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadConfig(true)}
            disabled={configRefreshing}
            className="inline-flex h-10 items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-slate-200 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98] disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5 text-slate-400", configRefreshing && "animate-spin")}
            />
            Refresh limits
          </button>
        </div>

        {/* Dynamic Sliding Toggle Slider */}
        <div className="relative mt-6 inline-flex rounded-full border border-white/10 bg-[#060a14] p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
          <div className="relative flex">
            {/* Sliding background capsule */}
            <div
              className={cn(
                "absolute top-0 bottom-0 rounded-full bg-blue-600 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(37,99,235,0.45)]",
                billingMode === "monthly" ? "left-0 w-[100px]" : "left-[100px] w-[120px]"
              )}
            />
            <button
              type="button"
              onClick={() => setBillingMode("monthly")}
              className={cn(
                "relative z-10 rounded-full px-5 py-2 text-sm font-bold tracking-wide transition-colors duration-200",
                billingMode === "monthly" ? "text-white" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingMode("annual")}
              className={cn(
                "relative z-10 rounded-full px-5 py-2 text-sm font-bold tracking-wide transition-colors duration-200 flex items-center gap-1",
                billingMode === "annual" ? "text-white" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Annual
              <span className="rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
                -20%
              </span>
            </button>
          </div>
        </div>

        {billingMode === "annual" && (
          <p className="mt-3 text-xs font-semibold text-amber-400/90 flex items-center gap-1 animate-pulse">
            ★ Annual plans are coming soon!
          </p>
        )}
      </div>

      {/* Grid of Luxurious Pricing Cards */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-4">
        {displayPlans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isLoading = switchingPlan === plan.id;
          const isExpanded = expanded[plan.id] === true;
          const buttonText = isCurrent
            ? "Active plan"
            : plan.id === "free_trial"
              ? "Activate Free Trial"
              : plan.id === "free"
                ? "Activate Free"
                : plan.id === "starter"
                  ? "Activate Starter"
                  : "Activate Pro";

          // Premium visual properties
          const cardTheme = {
            free_trial: {
              border: isCurrent
                ? "border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.15),inset_0_1px_1px_rgba(255,255,255,0.05)]"
                : "border-white/[0.08] hover:border-emerald-500/30",
              bg: "from-[#0d1424] via-[#090f1c] to-[#070a13]",
              badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
              accent: "emerald-500",
              button:
                "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-[0_4px_12px_rgba(16,185,129,0.2)]",
              glow: "group-hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]",
            },
            free: {
              border: isCurrent
                ? "border-cyan-500/80 shadow-[0_0_25px_rgba(6,182,212,0.15),inset_0_1px_1px_rgba(255,255,255,0.05)]"
                : "border-white/[0.08] hover:border-cyan-500/30",
              bg: "from-[#0d1424] via-[#090f1c] to-[#070a13]",
              badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
              accent: "cyan-500",
              button:
                "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold shadow-[0_4px_12px_rgba(6,182,212,0.2)]",
              glow: "group-hover:shadow-[0_0_30px_rgba(6,182,212,0.08)]",
            },
            starter: {
              border: isCurrent
                ? "border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.2),inset_0_1px_1px_rgba(255,255,255,0.08)]"
                : "border-white/[0.08] hover:border-blue-500/40",
              bg: "from-[#0d172e] via-[#091022] to-[#070a14]",
              badge:
                "border-blue-400/40 bg-blue-500/20 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.15)]",
              accent: "blue-500",
              button:
                "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-[0_4px_15px_rgba(37,99,235,0.25)]",
              glow: "group-hover:shadow-[0_0_35px_rgba(37,99,235,0.12)]",
            },
            pro: {
              border: isCurrent
                ? "border-purple-500 shadow-[0_0_35px_rgba(139,92,246,0.28),inset_0_1px_1px_rgba(255,255,255,0.1)]"
                : "border-purple-500/35 hover:border-purple-400/60 shadow-[0_0_20px_-3px_rgba(139,92,246,0.15)]",
              bg: "from-[#140e34] via-[#0a0b1b] to-[#050610]",
              badge:
                "border-purple-400/40 bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)]",
              accent: "purple-500",
              button:
                "bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:via-violet-500 hover:to-indigo-500 text-white font-bold shadow-[0_4px_20px_rgba(139,92,246,0.35)]",
              glow: "group-hover:shadow-[0_0_40px_rgba(139,92,246,0.22)]",
            },
          }[plan.id];

          return (
            <motion.article
              key={`${plan.id}-card`}
              whileHover={{ y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
              className={cn(
                "group flex min-h-[580px] flex-col rounded-2xl border bg-gradient-to-b p-6 transition-all duration-300 relative overflow-hidden",
                cardTheme.bg,
                cardTheme.border,
                cardTheme.glow
              )}
            >
              {/* Premium Card Corner Halo */}
              <div
                className={cn(
                  "absolute -top-16 -right-16 h-32 w-32 rounded-full blur-[40px] opacity-15 transition-opacity duration-300 group-hover:opacity-25",
                  plan.id === "free_trial" && "bg-emerald-400",
                  plan.id === "free" && "bg-cyan-400",
                  plan.id === "starter" && "bg-blue-400",
                  plan.id === "pro" && "bg-purple-400"
                )}
              />

              {/* Shimmer Border Overlay on the VIP Pro Card */}
              {plan.id === "pro" && (
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400/50 to-transparent animate-[pulse_3s_infinite]" />
              )}

              {/* Card Header */}
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                    Tier Level
                  </span>
                  <p className="text-2xl font-extrabold text-white mt-0.5">{plan.name}</p>
                </div>
                {plan.badge ? (
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                      cardTheme.badge
                    )}
                  >
                    {plan.badge}
                  </span>
                ) : null}
              </div>

              {/* Pricing section */}
              <div className="mb-4">
                <p className="text-4xl font-extrabold tracking-tight text-white flex items-baseline">
                  {billingMode === "annual" ? "Coming soon" : humanPrice(plan.priceMonthly)}
                  {billingMode === "monthly" && plan.priceMonthly > 0 ? (
                    <span className="ml-1 text-sm font-medium text-slate-400">/month</span>
                  ) : null}
                </p>
                {plan.priceYearly > 0 ? (
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    or Rs {plan.priceYearly}/year
                  </p>
                ) : (
                  <p className="mt-1 h-4" /> // spacing helper
                )}
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed text-slate-300 min-h-[36px]">
                {plan.description}
              </p>

              {/* Key Features Block */}
              <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/30 p-4 shadow-inner">
                <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Key Features
                </p>
                <ul className="space-y-2">
                  {plan.keyFive.map((feature) => (
                    <li
                      key={`${plan.id}-${feature}`}
                      className="flex items-start gap-2.5 text-xs text-slate-200"
                    >
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [plan.id]: !prev[plan.id],
                    }))
                  }
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      View less <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      View all features <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Expandable Features Matrix with smooth height transition */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="mt-4 flex-1 space-y-4 overflow-hidden border-t border-white/5 pt-4"
                  >
                    {plan.categories.map((category) => (
                      <section key={`${plan.id}-${category.title}`} className="space-y-2">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          {category.title}
                        </h4>
                        <ul className="space-y-2">
                          {category.items.map((item) => (
                            <li
                              key={`${category.title}-${item.name}`}
                              className={cn(
                                "flex items-start gap-2.5 text-xs transition-colors duration-200",
                                item.checked ? "text-slate-200" : "text-slate-500/90"
                              )}
                            >
                              {item.checked ? (
                                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                  <Check className="h-3 w-3" />
                                </div>
                              ) : (
                                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-600">
                                  <Lock className="h-2.5 w-2.5" />
                                </div>
                              )}
                              <span
                                className={cn(
                                  "leading-5 font-medium",
                                  !item.checked && "line-through decoration-slate-700/50"
                                )}
                              >
                                {item.name}
                              </span>
                              {item.badge ? (
                                <span
                                  className={cn(
                                    "ml-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide",
                                    item.checked
                                      ? "border border-emerald-500/20 bg-emerald-500/5 text-emerald-300/90"
                                      : "border border-white/5 bg-white/5 text-slate-600"
                                  )}
                                >
                                  {item.badge}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Button — Free / Starter / Pro CTAs hidden for now; logic unchanged */}
              {plan.id === "free_trial" ? (
                <div className="mt-auto pt-6">
                  <button
                    type="button"
                    disabled={isCurrent || isLoading || billingMode === "annual" || configLoading}
                    onClick={() => activate(plan.id)}
                    className={cn(
                      "inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-xs font-bold tracking-wider uppercase transition-all duration-300 active:scale-[0.98]",
                      isCurrent
                        ? "bg-emerald-600/15 border border-emerald-500/30 text-emerald-300 shadow-inner"
                        : "hover:scale-[1.01] hover:brightness-110 disabled:opacity-60 disabled:hover:scale-100 disabled:hover:brightness-100",
                      !isCurrent && !configLoading && cardTheme.button,
                      configLoading && "bg-slate-800 text-slate-400 border border-white/5"
                    )}
                  >
                    {isLoading || configLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      buttonText
                    )}
                  </button>
                </div>
              ) : (
                <div className="mt-auto pt-6" aria-hidden />
              )}
            </motion.article>
          );
        })}
      </div>

      <p className="px-2 text-center text-xs font-medium text-slate-500">
        Admin changes on subscription limits are loaded from live config and reflected in these
        cards.
      </p>
    </div>
  );
}
