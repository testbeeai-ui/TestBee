"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PricingPlanCard } from "@/components/pricing/PricingPlanCard";
import { buildPlanKeyFeatureRows } from "@/lib/subscription/planCardKeyFeatures";
import { getPricingCardTheme } from "@/lib/subscription/pricingCardTheme";
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
  normalizePlanTier,
  type SubscriptionConfig,
  type SubscriptionPlanKey,
} from "@/lib/subscription/subscriptionConfig";
import { patchPlanItemBadge } from "@/lib/subscription/patchPlanItemBadge";
import { planHasSubjectChatMultilingual } from "@/lib/subscription/subjectChatLimits";

interface Props {
  profile: Profile;
  onNavigate: (view: SubViewId) => void;
}

function humanPrice(priceMonthly: number): string {
  if (priceMonthly <= 0) return "Rs 0";
  return `Rs ${priceMonthly}`;
}

export default function SubscriptionPlans({ profile, onNavigate }: Props) {
  const { toast } = useToast();
  const { refreshProfile } = useAuth();
  const [switchingPlan, setSwitchingPlan] = useState<SubscriptionPlanKey | null>(null);
  const [billingMode, setBillingMode] = useState<"monthly" | "annual">("monthly");
  const [allFeaturesExpanded, setAllFeaturesExpanded] = useState(false);
  const [config, setConfig] = useState<SubscriptionConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configRefreshing, setConfigRefreshing] = useState(false);

  const currentPlan = useMemo(
    () => normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile),
    [profile],
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
      const multilingual = planHasSubjectChatMultilingual(liveConfig, basePlan.id);
      return {
        ...basePlan,
        keyFeatures: buildPlanKeyFeatureRows(limits, multilingual),
        categories: basePlan.categories.map((category) => ({
          ...category,
          items: category.items.map((item) => ({
            ...item,
            badge: patchPlanItemBadge(item.name, item.badge, limits, basePlan.id, liveConfig),
          })),
        })),
      };
    });
  }, [config]);

  const activate = async (plan: SubscriptionPlanKey) => {
    if (plan === "starter" || plan === "pro") {
      localStorage.setItem("testbee_checkout_plan", plan);
      localStorage.setItem("testbee_checkout_billing_mode", billingMode);
      onNavigate("checkout");
      return;
    }

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

      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2 2xl:grid-cols-4">
        {displayPlans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isLoading = switchingPlan === plan.id;
          const isExpanded = allFeaturesExpanded;
          const cardTheme = getPricingCardTheme(plan.id, isCurrent);
          const buttonText = isCurrent
            ? "Active plan"
            : plan.id === "free_trial"
              ? "Activate Free Trial"
              : plan.id === "free"
                ? "Activate Free"
                : plan.id === "starter"
                  ? "Activate Starter"
                  : "Activate Pro";

          return (
            <PricingPlanCard
              key={`${plan.id}-card`}
              planId={plan.id}
              planName={plan.name}
              badge={plan.badge}
              description={plan.description}
              priceLine={
                <span className="flex items-baseline">
                  {billingMode === "annual" ? "Coming soon" : humanPrice(plan.priceMonthly)}
                  {billingMode === "monthly" && plan.priceMonthly > 0 ? (
                    <span className="ml-1 text-sm font-medium text-slate-400">/month</span>
                  ) : null}
                </span>
              }
              priceSubline={
                plan.priceYearly > 0 ? `or Rs ${plan.priceYearly}/year` : undefined
              }
              keyFeatures={plan.keyFeatures}
              categories={plan.categories}
              isExpanded={isExpanded}
              onToggleExpand={() => setAllFeaturesExpanded((prev) => !prev)}
              cardTheme={cardTheme}
              footer={
                <button
                  type="button"
                  disabled={isCurrent || isLoading || billingMode === "annual" || configLoading}
                  onClick={() => activate(plan.id)}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-xs font-bold tracking-wider uppercase transition-all duration-300 active:scale-[0.98]",
                    isCurrent
                      ? cn(
                          "shadow-inner disabled:opacity-100",
                          plan.id === "free_trial" &&
                            "border border-emerald-500/30 bg-emerald-600/15 text-emerald-300",
                          plan.id === "free" &&
                            "border border-cyan-500/30 bg-cyan-600/15 text-cyan-300",
                          plan.id === "starter" &&
                            "border border-blue-500/30 bg-blue-600/15 text-blue-300",
                          plan.id === "pro" &&
                            "border border-purple-500/30 bg-purple-600/15 text-purple-300"
                        )
                      : "hover:scale-[1.01] hover:brightness-110 disabled:opacity-60 disabled:hover:scale-100 disabled:hover:brightness-100",
                    !isCurrent && !configLoading && cardTheme.button,
                    configLoading && "border border-white/5 bg-slate-800 text-slate-400"
                  )}
                >
                  {isLoading || configLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    buttonText
                  )}
                </button>
              }
            />
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
