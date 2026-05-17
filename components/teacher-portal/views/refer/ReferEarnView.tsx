"use client";

import { Copy } from "lucide-react";
import type { TeacherPortalReferStats } from "@/lib/teacherPortal/types";

interface ReferEarnViewProps {
  referStats: TeacherPortalReferStats;
  onCopyLink: () => void;
}

export default function ReferEarnView({ referStats, onCopyLink }: ReferEarnViewProps) {
  const totalReferred = referStats.teachersReferred + referStats.studentsReferred;
  return (
    <div className="w-full space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl">
          Earn & <span className="text-emerald-400 italic">Learn</span>
        </h1>
        <p className="text-xs text-slate-400 sm:text-sm">
          Earn RDM by referring colleagues and growing your EduBlast impact.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d0d22] to-[#10122a] p-4 sm:p-5">
        <div className="mb-2 inline-flex rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-200">
          Teacher Earn & Learn
        </div>
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-1 font-serif text-3xl text-amber-300 sm:text-4xl lg:text-5xl">
            {referStats.rdmBalance.toLocaleString("en-IN")}
          </div>
          <div className="text-lg text-slate-200 sm:text-xl lg:text-2xl">RDM balance</div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-emerald-300 sm:text-2xl lg:text-3xl">
              {totalReferred}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Total referred
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-amber-300 sm:text-2xl lg:text-3xl">
              +{referStats.teacherRewardRdm}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              RDM per teacher
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-rose-300 sm:text-2xl lg:text-3xl">
              +{referStats.teacherMilestoneBonusRdm}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Bonus at 5 teachers
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-white/15 bg-[#0b0d1d] px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1 truncate font-mono text-sm text-slate-300">
            {referStats.referralLink}
          </div>
          <button
            type="button"
            onClick={onCopyLink}
            className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-400"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy link
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
          <h3 className="mb-2.5 text-sm font-semibold">Teacher referral tiers</h3>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              Refer a Teacher colleague → +{referStats.teacherRewardRdm} RDM
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              Refer a Student → +{referStats.studentRewardRdm} RDM
            </div>
            <div className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2.5">
              Refer 5 teachers milestone → +{referStats.teacherMilestoneBonusRdm} RDM
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
          <h3 className="mb-2.5 text-sm font-semibold">Ways you earn RDM as a teacher</h3>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              Teacher Section comment (upvotes) → +30
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              Live class attendance impact → +30
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              Referral — Teacher → +100
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              Content co-creation usage → +20
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
