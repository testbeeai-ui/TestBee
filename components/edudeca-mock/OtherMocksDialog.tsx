"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BookOpen, Calculator, LayoutGrid, Target, Triangle } from "lucide-react";

import {
  OTHER_MOCKS_CONTINUE_LABEL,
  OTHER_MOCKS_CTA_LABEL,
  OTHER_MOCKS_DIALOG_TITLE,
  OTHER_MOCK_EXAMS,
  type OtherMockExamId,
} from "@/lib/edudeca-mock/other-mocks";
import { cn } from "@/lib/utils";

const EXAM_VISUAL: Record<OtherMockExamId, { bg: string; Icon: typeof Calculator }> = {
  "jee-main": { bg: "#378ADD", Icon: Calculator },
  comedk: { bg: "#7F77DD", Icon: BookOpen },
  bitsat: { bg: "#E07A2F", Icon: Target },
  kcet: { bg: "#D4537E", Icon: Triangle },
};

type ExploreOtherMocksButtonProps = {
  onClick: () => void;
  className?: string;
};

export function ExploreOtherMocksButton({ onClick, className }: ExploreOtherMocksButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#5B6CDB] bg-[#12151C] px-2.5 py-1.5 text-[11px] font-bold text-[#EAEFF5] hover:border-[#7B8CFF]",
        className,
      )}
    >
      <span
        className="flex size-4 items-center justify-center rounded-[4px] bg-[#378ADD] text-white"
        aria-hidden
      >
        <LayoutGrid className="size-2.5" strokeWidth={2.6} />
      </span>
      {OTHER_MOCKS_CTA_LABEL}
    </button>
  );
}

type OtherMocksDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function OtherMocksDialog({ open, onClose }: OtherMocksDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="other-mocks-title"
        className="w-full max-w-[440px] rounded-[22px] border border-[#262E3A] bg-[#1B212B] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="relative mt-0.5 size-8 shrink-0" aria-hidden>
            <span className="absolute left-0 top-1 size-4 rounded-[5px] bg-[#1D9E75]" />
            <span className="absolute left-2 top-0 size-4 rounded-[5px] bg-[#378ADD]" />
            <span className="absolute left-3.5 top-2 size-4 rounded-[5px] bg-[#D4537E]" />
          </span>
          <div>
            <h2 id="other-mocks-title" className="text-[17px] font-extrabold leading-snug text-[#EAEFF5]">
              {OTHER_MOCKS_DIALOG_TITLE}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8B96A5]">
              EduBlast has free mock tests for these too — jump in anytime. Your current EduDeca
              progress is saved and you can resume it later.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {OTHER_MOCK_EXAMS.map((exam) => {
            const { bg, Icon } = EXAM_VISUAL[exam.id];
            return (
              <Link
                key={exam.id}
                href={exam.href}
                className={cn(
                  "flex items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-colors",
                  exam.id === "jee-main"
                    ? "border-[#378ADD] bg-[#151A22]"
                    : "border-[#262E3A] bg-[#151A22] hover:border-[#5C6675]",
                )}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-[11px] text-white"
                  style={{ background: bg }}
                >
                  <Icon className="size-[18px]" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-extrabold text-[#EAEFF5]">{exam.title}</span>
                  <span className="mt-0.5 block text-[11.5px] text-[#8B96A5]">{exam.meta}</span>
                </span>
                <span className="text-[16px] text-[#8B96A5]" aria-hidden>
                  →
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-[#EAEFF5] bg-transparent px-4 py-2.5 text-[13px] font-bold text-[#EAEFF5] hover:bg-[#EAEFF5]/10"
          >
            {OTHER_MOCKS_CONTINUE_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
