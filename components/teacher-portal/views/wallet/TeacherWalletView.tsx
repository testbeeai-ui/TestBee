"use client";

import { ArrowRight, Coins, Gift, Star, TrendingUp, Users, Zap } from "lucide-react";
import type {
  TeacherPortalReferStats,
  TeacherPortalSection,
  TeacherPortalSummary,
} from "@/lib/teacherPortal/types";
import { DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG } from "@/lib/teacherPortal/liveClassDeliveryRdm";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";

interface TeacherWalletViewProps {
  rdmBalance: number;
  summary: TeacherPortalSummary;
  referStats: TeacherPortalReferStats;
  teacherName: string;
  onNavigateToSection?: (section: TeacherPortalSection) => void;
}

const EARNING_RATES = [
  {
    label: "Gyan++ answer",
    amount: DEFAULT_RDM_CONFIG.gyan_teacher_answer_rdm,
    icon: Star,
    color: "text-amber-300",
  },
  {
    label: "Section schedule class",
    amount: DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG.baseRdm,
    icon: Zap,
    color: "text-emerald-300",
  },
  { label: "Refer a teacher", amount: 100, icon: Users, color: "text-violet-300" },
  { label: "Content co-creation", amount: 20, icon: TrendingUp, color: "text-sky-300" },
] as const;

const TEACHER_PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Rs 199",
    rdm: 500,
    recommended: false,
    features: ["Boost student engagement", "Basic analytics", "Standard support"],
  },
  {
    id: "growth",
    name: "Growth",
    price: "Rs 499",
    rdm: 2000,
    recommended: true,
    features: [
      "Priority Gyan++ placement",
      "Advanced analytics",
      "Priority support",
      "Custom assignments",
    ],
  },
  {
    id: "leader",
    name: "Leader",
    price: "Rs 999",
    rdm: 5000,
    recommended: false,
    features: [
      "Top placement on Gyan++",
      "Full analytics suite",
      "Dedicated support",
      "Unlimited assignments",
      "Early access features",
    ],
  },
] as const;

export default function TeacherWalletView({
  rdmBalance,
  summary,
  referStats,
  onNavigateToSection,
}: TeacherWalletViewProps) {
  return (
    <div className="w-full space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl">
          RDM <span className="text-amber-300 italic">Wallet</span>
        </h1>
        <p className="text-xs text-slate-400 sm:text-sm">
          Track your earnings and see how you can grow your RDM balance.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[#1a1508] to-[#0d0d22] p-4 sm:p-5">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-200">
          <Coins className="h-3 w-3" />
          Teacher Wallet
        </div>
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-1 font-serif text-3xl text-amber-300 sm:text-4xl lg:text-5xl">
            {rdmBalance.toLocaleString("en-IN")}
          </div>
          <div className="text-lg text-slate-200 sm:text-xl lg:text-2xl">RDM balance</div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-emerald-300 sm:text-2xl">
              {summary.teacherSectionsWritten}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Answers written
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-amber-300 sm:text-2xl">
              {summary.avgTeacherUpvotes}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Avg upvotes</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-sky-300 sm:text-2xl">
              +{summary.teacherRdmWeek}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              RDM this week
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-violet-300 sm:text-2xl">
              {summary.rdmDistributedMonth}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Sent to students
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d0d22] p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">
          Ways to earn
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {EARNING_RATES.map(({ label, amount, icon: Icon, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
            >
              <Icon className={"h-4 w-4 shrink-0 " + color} />
              <div className="flex-1 text-sm text-slate-200">{label}</div>
              <div className="font-serif text-sm font-semibold text-amber-300">+{amount}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d0d22] p-4 sm:p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">
          Top Up Plans
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Display plans for reference. Contact admin for top-up requests.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TEACHER_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={
                "relative rounded-xl border p-4 " +
                (plan.recommended
                  ? "border-amber-400/40 bg-amber-400/5"
                  : "border-white/10 bg-black/20")
              }
            >
              {plan.recommended ? (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
                  Recommended
                </div>
              ) : null}
              <div className="mb-2 text-center">
                <div className="text-sm font-semibold text-slate-200">{plan.name}</div>
                <div className="font-serif text-2xl text-amber-300">
                  {plan.rdm.toLocaleString("en-IN")}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">RDM</div>
              </div>
              <div className="mb-3 text-center text-lg font-semibold text-slate-200">
                {plan.price}
                <span className="text-xs text-slate-500">/mo</span>
              </div>
              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-slate-400">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/60" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onNavigateToSection?.("referEarn")}
        className="flex w-full items-center justify-between rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4 text-left transition-colors hover:bg-violet-500/10 sm:p-5"
      >
        <div className="flex items-center gap-3">
          <Gift className="h-5 w-5 text-violet-300" />
          <div>
            <div className="text-sm font-semibold text-slate-200">
              Earn more RDM by referring colleagues
            </div>
            <div className="text-xs text-slate-400">
              +{referStats.teacherRewardRdm} RDM per teacher referral
            </div>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-violet-300" />
      </button>
    </div>
  );
}
