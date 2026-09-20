"use client";

import { useEffect } from "react";
import { NtaCoachSheet, coachSheetKind } from "@/components/prep-mock/nta/NtaCoachSheet";
import { NtaRichTextBlock } from "@/components/prep-mock/nta/ntaExamParts";
import {
  NtaWorkedSolutionSheet,
  parseSolutionForSheet,
} from "@/components/prep-mock/nta/NtaWorkedSolutionSheet";

interface NtaSolutionModalProps {
  open: boolean;
  onClose: () => void;
  text: string;
  title?: string;
  emptyLabel?: string;
  /** Worked step cards. Off for Tips / Formula's. */
  useWorkedSheet?: boolean;
  panel?: "solution" | "tips" | "formulas";
}

export function NtaSolutionModal({
  open,
  onClose,
  text,
  title = "Solution",
  emptyLabel = "No solution",
  useWorkedSheet = true,
  panel = "solution",
}: NtaSolutionModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const body = text.trim();
  const coachKind = coachSheetKind(panel, body);
  const worked = useWorkedSheet && panel === "solution" ? parseSolutionForSheet(body) : null;

  return (
    <div
      className="fixed inset-0 z-[230] flex flex-col items-stretch justify-end p-0 sm:items-center sm:justify-center sm:p-6 md:p-8"
      style={{ background: "rgba(2, 6, 23, 0.72)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nta-solution-title"
    >
      {worked ? (
        <NtaWorkedSolutionSheet solution={worked} onClose={onClose} />
      ) : coachKind ? (
        <NtaCoachSheet kind={coachKind} text={body} title={title} onClose={onClose} />
      ) : (
        <div
          className="flex h-auto max-h-[78dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:max-h-[min(70vh,38rem)] sm:rounded-2xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <h2 id="nta-solution-title" className="text-xl font-bold text-white">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs text-slate-300"
            >
              Close
            </button>
          </div>
          {body ? (
            <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain">
              <NtaRichTextBlock text={body} variant="solution" />
            </div>
          ) : (
            <p className="text-sm text-slate-400">{emptyLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
