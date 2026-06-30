"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatRdmCredit,
  formatRdmDeduction,
  liveScheduleFeeLine,
  teacherProOverageExplain,
  type PublishFeeKind,
} from "@/lib/teacherPortal/teacherRdmUxCopy";
import type { TeacherPlanKey } from "@/lib/teacherPortal/teacherPlan";

type Props = {
  open: boolean;
  sectionName: string;
  slotSummary: string;
  scheduleFee: number;
  feeKind: PublishFeeKind;
  tier: TeacherPlanKey;
  cap: number;
  deliveryEarn?: number;
  deliveryBaseRdm?: number;
  deliveryPerStudentRdm?: number;
  deliveryStudentCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export default function TeacherLiveClassChargeConfirm({
  open,
  sectionName,
  slotSummary,
  scheduleFee,
  feeKind,
  tier,
  cap,
  deliveryEarn = 0,
  deliveryBaseRdm = 0,
  deliveryPerStudentRdm = 0,
  deliveryStudentCount = 0,
  onConfirm,
  onCancel,
  busy = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  const isOverage = feeKind === "overage";
  const earn = Math.max(0, Math.round(deliveryEarn));
  const title =
    scheduleFee > 0 && earn > 0
      ? `Schedule lesson · ${formatRdmDeduction(scheduleFee)} · ${formatRdmCredit(earn)}?`
      : scheduleFee > 0
        ? `Book live lesson for ${formatRdmDeduction(scheduleFee)}?`
        : earn > 0
          ? `Schedule and earn ${formatRdmCredit(earn)}?`
          : "Book this live lesson?";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0c0e14] p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-class-charge-title"
      >
        <h2 id="live-class-charge-title" className="text-lg font-bold text-slate-100">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          <span className="font-medium text-slate-200">{sectionName}</span>
          {slotSummary ? ` · ${slotSummary}` : null}
        </p>

        {earn > 0 ? (
          <div className="mt-4 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-slate-200">
            <div className="text-xs font-bold uppercase tracking-wide text-emerald-300/90">
              You earn when you schedule
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Per lesson (base)</span>
              <span className="font-semibold text-emerald-300">
                {formatRdmCredit(deliveryBaseRdm || earn)}
              </span>
            </div>
            {deliveryStudentCount > 0 ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Students in section</span>
                  <span className="font-semibold">{deliveryStudentCount}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Per enrolled student</span>
                  <span className="font-semibold text-emerald-300">
                    +{deliveryPerStudentRdm} RDM each
                  </span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
              <span className="font-semibold text-emerald-100">Added to your wallet</span>
              <span className="font-bold text-emerald-200">{formatRdmCredit(earn)}</span>
            </div>
          </div>
        ) : null}

        {isOverage && tier === "pro" ? (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm leading-snug text-amber-100/95">
            {teacherProOverageExplain("live lesson", cap, scheduleFee)}
          </p>
        ) : scheduleFee > 0 ? (
          <p className="mt-3 text-sm text-slate-300">
            {liveScheduleFeeLine({ kind: feeKind, amount: scheduleFee })} — deducted when you
            confirm.
          </p>
        ) : earn > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            RDM is credited when you schedule. Students receive a calendar invite and Meet link.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-300">
            Students get a calendar invite and Meet link.
          </p>
        )}

        {scheduleFee > 0 ? (
          <div className="mt-3 flex justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
            <span className="font-semibold text-amber-100">Deducted from your wallet</span>
            <span className="font-bold text-amber-200">{formatRdmDeduction(scheduleFee)}</span>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy
              ? "Scheduling…"
              : earn > 0 && scheduleFee <= 0
                ? `Yes, schedule (${formatRdmCredit(earn)})`
                : scheduleFee > 0
                  ? `Yes, book (${formatRdmDeduction(scheduleFee)})`
                  : "Yes, schedule lesson"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
