"use client";

import { useState } from "react";
import { Copy, GraduationCap, Users } from "lucide-react";
import { DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG } from "@/lib/teacherPortal/liveClassDeliveryRdm";
import { DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG } from "@/lib/teacherPortal/liveClassQualityRdm";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import type { TeacherPortalReferStats } from "@/lib/teacherPortal/types";
import ClassroomBulkInviteModal, {
  type BulkInviteClassroom,
} from "@/components/teacher-portal/classroom/ClassroomBulkInviteModal";

interface ReferEarnViewProps {
  referStats: TeacherPortalReferStats;
  onCopyLink: () => void;
  classrooms?: BulkInviteClassroom[];
}

export default function ReferEarnView({
  referStats,
  onCopyLink,
  classrooms = [],
}: ReferEarnViewProps) {
  const liveBase = DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG.baseRdm;
  const livePerStudent = DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG.perStudentRdm;
  const liveCap = DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG.studentCap;
  const liveExampleStudents = 30;
  const liveExampleTotal = liveBase + liveExampleStudents * livePerStudent;
  const bulkMin = DEFAULT_RDM_CONFIG.classroom_bulk_invite_min_students;
  const bulkFlat = DEFAULT_RDM_CONFIG.classroom_bulk_invite_flat_rdm;
  const bulkPaid = DEFAULT_RDM_CONFIG.classroom_batch_paid_bonus_rdm;
  const bulkWindow = DEFAULT_RDM_CONFIG.classroom_batch_paid_window_days;
  const gyanTeacherRdm = DEFAULT_RDM_CONFIG.gyan_teacher_answer_rdm;
  const qualityBonusRdm = DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG.bonusRdm;
  const qualityMinStars = (DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG.minAvgX10 / 10).toFixed(1);
  const teacherReferralMax =
    referStats.teacherSignupRewardRdm + referStats.teacherPaidBonusRdm;
  const studentReferralMax =
    referStats.teacherStudentSignupRewardRdm + referStats.teacherPaidBonusRdm;
  const [inviteOpen, setInviteOpen] = useState(false);
  const hasClassroom = classrooms.length > 0;

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl">
          Earn & <span className="text-emerald-400 italic">Learn</span>
        </h1>
        <p className="text-xs text-slate-400 sm:text-sm">
          Refer fellow teachers and students — same link, separate reward tracks.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d0d22] to-[#10122a] p-4 sm:p-5">
        <div className="mb-2 inline-flex rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-200">
          Teacher referral
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Share your link with another teacher. When they join EduBlast as a teacher and complete
          onboarding, you earn RDM.
        </p>
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-1 font-serif text-3xl text-amber-300 sm:text-4xl lg:text-5xl">
            {referStats.rdmBalance.toLocaleString("en-IN")}
          </div>
          <div className="text-lg text-slate-200 sm:text-xl lg:text-2xl">RDM balance</div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-emerald-300 sm:text-2xl lg:text-3xl">
              {referStats.teachersReferred}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Teachers referred
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-sky-300 sm:text-2xl lg:text-3xl">
              +{referStats.teacherReferralRdmEarned.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              RDM from teacher referrals
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-amber-300 sm:text-2xl lg:text-3xl">
              +{referStats.teacherSignupRewardRdm}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              RDM per teacher signup
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-rose-300 sm:text-2xl lg:text-3xl">
              +{referStats.teacherPaidBonusRdm}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              RDM if they subscribe
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
            Copy teacher link
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Up to +{teacherReferralMax} RDM per referred teacher (+{referStats.teacherSignupRewardRdm}{" "}
          signup + {referStats.teacherPaidBonusRdm} if they go paid within{" "}
          {referStats.teacherPaidWindowDays} days).
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-[#10122a] p-4 sm:p-5">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-200">
          Student referral
        </div>
        <p className="mb-3 text-xs text-slate-400">
          The same link also works for students. When a student joins and completes onboarding, you
          earn on the student referral track.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-emerald-300 sm:text-2xl lg:text-3xl">
              {referStats.studentsReferred}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              Students referred
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-sky-300 sm:text-2xl lg:text-3xl">
              +{referStats.studentReferralRdmEarned.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              RDM from student referrals
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-amber-300 sm:text-2xl lg:text-3xl">
              +{referStats.teacherStudentSignupRewardRdm}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              RDM per student signup
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-center">
            <div className="font-serif text-xl text-rose-300 sm:text-2xl lg:text-3xl">
              +{referStats.teacherPaidBonusRdm}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
              RDM if they subscribe
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Up to +{studentReferralMax} RDM per referred student (+{referStats.teacherStudentSignupRewardRdm}{" "}
          signup + {referStats.teacherPaidBonusRdm} if they go paid within{" "}
          {referStats.teacherPaidWindowDays} days).
        </p>
      </div>

      <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-serif text-xl sm:text-2xl">
              <Users className="h-5 w-5 text-violet-300" /> Invite your whole class
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Teaching a class of {bulkMin}+ students? Add your roster and share the join link.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 font-semibold text-violet-100">
                +{bulkFlat.toLocaleString("en-IN")} RDM once your class reaches {bulkMin}
              </span>
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-200">
                +{bulkPaid} RDM per student who subscribes within {bulkWindow} days
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-400"
          >
            <Users className="h-4 w-4" />
            {hasClassroom ? "Invite your class" : "Create a class to invite"}
          </button>
        </div>
        {!hasClassroom ? (
          <p className="mt-2 text-xs text-slate-400">
            You don&apos;t have a classroom yet. Create one in My Classroom, then invite your students
            here.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="h-4 w-4 text-violet-300" />
            How teacher referral earns
          </h3>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2.5">
              A fellow teacher signs up via your link → +{referStats.teacherSignupRewardRdm} RDM
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              That teacher subscribes within {referStats.teacherPaidWindowDays} days → +
              {referStats.teacherPaidBonusRdm} RDM more
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-emerald-300" />
            How student referral earns
          </h3>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5">
              A student signs up via your link → +{referStats.teacherStudentSignupRewardRdm} RDM
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              That student subscribes within {referStats.teacherPaidWindowDays} days → +
              {referStats.teacherPaidBonusRdm} RDM more
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#15162b] p-3.5 sm:p-4">
        <h3 className="mb-2.5 text-sm font-semibold">Other ways you earn RDM as a teacher</h3>
        <p className="mb-3 text-xs text-slate-500">
          All live reward tracks — amounts follow Admin RDM settings.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 text-sm text-slate-300">
          <div className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2.5">
            Refer a fellow teacher → +{referStats.teacherSignupRewardRdm} RDM on signup; +
            {referStats.teacherPaidBonusRdm} more if they subscribe within{" "}
            {referStats.teacherPaidWindowDays} days
          </div>
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5">
            Refer a student → +{referStats.teacherStudentSignupRewardRdm} RDM on signup; +
            {referStats.teacherPaidBonusRdm} more if they subscribe within{" "}
            {referStats.teacherPaidWindowDays} days
          </div>
          <div className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2.5">
            Bulk-invite {bulkMin}+ students in one classroom → +{bulkFlat.toLocaleString("en-IN")}{" "}
            RDM (once per class); +{bulkPaid} per student who subscribes within {bulkWindow} days
          </div>
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5">
            Live lesson delivered (section schedule or booked slot) → +{liveBase} base + (
            {livePerStudent} × enrolled students, cap {liveCap}); e.g. {liveExampleStudents} students
            = +{liveExampleTotal} RDM
          </div>
          <div className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2.5">
            Live lesson quality bonus → +{qualityBonusRdm} RDM when students rate the lesson ≥
            {qualityMinStars}★ (enough raters; credit only — no penalty for low ratings)
          </div>
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2.5">
            Gyan++ Teacher Section post → +{gyanTeacherRdm} RDM (once per IST day when you answer on
            the wall)
          </div>
        </div>
      </div>

      {inviteOpen ? (
        <ClassroomBulkInviteModal
          classrooms={classrooms}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      ) : null}
    </div>
  );
}
