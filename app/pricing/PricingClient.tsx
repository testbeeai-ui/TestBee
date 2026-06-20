"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PricingPlanCard } from "@/components/pricing/PricingPlanCard";
import { buildPlanKeyFeatureRows } from "@/lib/subscription/planCardKeyFeatures";
import { getPricingCardTheme } from "@/lib/subscription/pricingCardTheme";
import { PLAN_TIERS } from "@/components/profile/subscription/types";
import AppLayout from "@/components/AppLayout";
import type { SubscriptionConfig } from "@/lib/subscription/subscriptionConfig";
import {
  getPlanLimits,
  SUBSCRIPTION_CONFIG_DEFAULTS,
  fetchSubscriptionConfig,
  normalizePlanTier,
} from "@/lib/subscription/subscriptionConfig";
import { patchPlanItemBadge } from "@/lib/subscription/patchPlanItemBadge";
import { planHasSubjectChatMultilingual } from "@/lib/subscription/subjectChatLimits";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { INVESTOR_NAV_LINKS } from "@/components/landing/landing-constants";
import { cn } from "@/lib/utils";

function humanPrice(priceMonthly: number): string {
  if (priceMonthly <= 0) return "Rs 0";
  return `Rs ${priceMonthly}`;
}

export default function PricingClient() {
  const { profile, user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [billingMode, setBillingMode] = useState<"monthly" | "annual">("monthly");
  const [allFeaturesExpanded, setAllFeaturesExpanded] = useState(false);
  const [config, setConfig] = useState<SubscriptionConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  const loadConfig = async () => {
    try {
      const cfg = await fetchSubscriptionConfig();
      setConfig(cfg);
    } catch {
      setConfig(SUBSCRIPTION_CONFIG_DEFAULTS);
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const currentPlan = useMemo(
    () => profile ? normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile) : null,
    [profile]
  );

  const displayPlans = useMemo(() => {
    const liveConfig = config ?? (SUBSCRIPTION_CONFIG_DEFAULTS as SubscriptionConfig);
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

  const handleAction = () => {
    if (!authUser) {
      router.push("/auth");
      return;
    }
    // If logged in, redirect them to the profile subscription settings page to switch plan/checkout
    router.push("/profile?section=subscription");
  };

  const isInAppShell = !authLoading && !!authUser && !!profile?.onboarding_complete;

  const content = (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto px-4 md:px-6">
      {/* Premium Glassmorphic Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-6 md:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
        {/* Subtle Ambient Light Glow behind header */}
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-500/10 blur-[80px]" />
        <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-purple-500/10 blur-[80px]" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-3xl md:text-4xl font-extrabold tracking-tight text-transparent font-serif">
              Choose a plan
            </h2>
            <p className="mt-1.5 text-sm font-medium text-slate-400">
              Select the perfect plan to accelerate your learning and unlock premium features.
            </p>
          </div>
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
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-4">
        {displayPlans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
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
              keyFeatures={plan.keyFeatures}
              categories={plan.categories}
              isExpanded={isExpanded}
              onToggleExpand={() => setAllFeaturesExpanded((prev) => !prev)}
              cardTheme={cardTheme}
              footer={
                <button
                  type="button"
                  disabled={isCurrent || configLoading}
                  onClick={() => handleAction()}
                  className={cn(
                    "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3 text-xs font-bold tracking-wider uppercase transition-all duration-300 active:scale-[0.98]",
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
                  {configLoading ? (
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
    </div>
  );

  if (isInAppShell) {
    return <AppLayout>{content}</AppLayout>;
  }

  return (
    <div className="landing-page min-h-screen bg-[#050505] text-zinc-100 flex flex-col justify-between">
      <div>
        <LandingNavbar variant="dark" navLinks={INVESTOR_NAV_LINKS} />
        <div className="py-12 bg-[#050505]">{content}</div>
      </div>
      <LandingFooter variant="dark" />
    </div>
  );
}
