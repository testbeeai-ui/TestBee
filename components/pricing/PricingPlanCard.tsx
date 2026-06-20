"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PlanKeyFeatureRow } from "@/lib/subscription/planCardKeyFeatures";
import type { PricingCardTheme } from "@/lib/subscription/pricingCardTheme";
import type { SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";

type PlanCategory = {
  title: string;
  items: {
    name: string;
    checked: boolean;
    badge?: string;
  }[];
};

type PricingPlanCardProps = {
  planId: SubscriptionPlanKey;
  planName: string;
  badge?: string;
  description: string;
  priceLine: ReactNode;
  priceSubline?: ReactNode;
  keyFeatures: PlanKeyFeatureRow[];
  categories: PlanCategory[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  cardTheme: PricingCardTheme;
  footer: ReactNode;
};

export function PricingPlanCard({
  planId,
  planName,
  badge,
  description,
  priceLine,
  priceSubline,
  keyFeatures,
  categories,
  isExpanded,
  onToggleExpand,
  cardTheme,
  footer,
}: PricingPlanCardProps) {
  return (
    <motion.article
      whileHover={{ y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-b p-5 transition-all duration-300",
        cardTheme.bg,
        cardTheme.border,
        cardTheme.glow
      )}
    >
      <div
        className={cn(
          "absolute -top-16 -right-16 h-32 w-32 rounded-full opacity-15 blur-[40px] transition-opacity duration-300 group-hover:opacity-25",
          planId === "free_trial" && "bg-emerald-400",
          planId === "free" && "bg-cyan-400",
          planId === "starter" && "bg-blue-400",
          planId === "pro" && "bg-purple-400"
        )}
      />

      {planId === "pro" ? (
        <div className="absolute inset-x-0 top-0 h-[2px] animate-[pulse_3s_infinite] bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />
      ) : null}

      <div className="relative flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Tier Level
          </span>
          <p className="mt-0.5 truncate text-xl font-extrabold text-white">{planName}</p>
        </div>
        {badge ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase",
              cardTheme.badge
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div className="relative mt-3 flex h-14 shrink-0 flex-col justify-center">
        <div className="text-3xl font-extrabold tracking-tight text-white">{priceLine}</div>
        <div className="mt-0.5 min-h-[16px] text-xs font-semibold text-slate-500">
          {priceSubline ?? "\u00a0"}
        </div>
      </div>

      <p className="relative mt-2 line-clamp-2 h-9 shrink-0 text-[11px] leading-snug text-slate-300">
        {description}
      </p>

      <div className="relative mt-3 shrink-0 rounded-xl border border-white/[0.06] bg-black/30 p-3 shadow-inner">
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          Key Features
        </p>
        <ul className="space-y-1.5">
          {keyFeatures.map((feature) => (
            <li
              key={`${planId}-${feature.id}`}
              className="flex items-start justify-between gap-2 text-[11px]"
            >
              <span className="flex min-w-0 items-start gap-1.5 text-slate-200">
                <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span className="font-medium leading-snug">{feature.label}</span>
              </span>
              <span className="shrink-0 text-right text-[10px] leading-snug font-semibold text-emerald-300/90">
                {feature.value}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 transition-colors hover:text-blue-300"
        >
          {isExpanded ? (
            <>
              View less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              View all features <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="relative mt-3 shrink-0 space-y-3 overflow-hidden border-t border-white/5 pt-3"
          >
            {categories.map((category) => (
              <section key={`${planId}-${category.title}`} className="space-y-1.5">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  {category.title}
                </h4>
                <ul className="space-y-1.5">
                  {category.items.map((item) => (
                    <li
                      key={`${category.title}-${item.name}`}
                      className={cn(
                        "flex items-start gap-2 text-[11px] transition-colors duration-200",
                        item.checked ? "text-slate-200" : "text-slate-500/90"
                      )}
                    >
                      {item.checked ? (
                        <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      ) : (
                        <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-600">
                          <Lock className="h-2 w-2" />
                        </span>
                      )}
                      <span
                        className={cn(
                          "min-w-0 flex-1 font-medium leading-snug",
                          !item.checked && "line-through decoration-slate-700/50"
                        )}
                      >
                        {item.name}
                      </span>
                      {item.badge ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold",
                            item.checked
                              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
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
        ) : null}
      </AnimatePresence>

      <div className="relative mt-4 shrink-0">{footer}</div>
    </motion.article>
  );
}
