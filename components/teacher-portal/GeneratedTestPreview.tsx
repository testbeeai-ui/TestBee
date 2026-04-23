"use client";

import { Code2, Edit3, FileDown, School } from "lucide-react";
import PlayQuestionMarkdown from "@/components/PlayQuestionMarkdown";
import type { GeneratedTeacherTest } from "@/lib/teacherPortal/generatedTest";

type Props = {
  test: GeneratedTeacherTest;
  onEditSettings: () => void;
  onCreatePdf: () => void;
  onAssignClassroom: () => void;
  createPdfLoading?: boolean;
};

function chipClass() {
  return "inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-300";
}

function difficultyLabel(level: string): string {
  const t = level.trim().toLowerCase();
  if (t === "basics") return "Simple";
  if (t === "intermediate") return "Medium";
  if (t === "advanced") return "Difficult";
  return "Mixed";
}

function difficultyClass(level: string): string {
  const t = level.trim().toLowerCase();
  if (t === "basics") return "bg-emerald-500/18 text-emerald-200 border-emerald-400/30";
  if (t === "intermediate") return "bg-sky-500/18 text-sky-200 border-sky-400/30";
  if (t === "advanced") return "bg-violet-500/18 text-violet-200 border-violet-400/30";
  return "bg-white/[0.06] text-slate-300 border-white/10";
}

export default function GeneratedTestPreview({
  test,
  onEditSettings,
  onCreatePdf,
  onAssignClassroom,
  createPdfLoading = false,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-2xl tracking-tight text-slate-50 sm:text-[2rem]">
            {test.name}
          </h3>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Generated question-bank MCQ papers for CBSE Board, KCET, and JEE Main in minutes.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={onEditSettings}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/10 bg-[#0b1020] px-3.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.04] sm:text-sm"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit settings
          </button>
          <div className="ml-0 flex flex-wrap items-center gap-2 sm:ml-2">
            <button
              type="button"
              onClick={onAssignClassroom}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 text-xs font-bold text-black hover:bg-emerald-400 sm:text-sm"
            >
              <School className="h-3.5 w-3.5" />
              Assign to classroom
            </button>
            <button
              type="button"
              onClick={onCreatePdf}
              disabled={createPdfLoading}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-500/20 px-3.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            >
              <FileDown className="h-3.5 w-3.5" />
              {createPdfLoading ? "Opening print..." : "Create PDF"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.09] bg-[#0e1325] p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <span className={chipClass()}>
            <span className="mr-1.5 text-emerald-300">●</span>
            {test.pickedCount} Questions
          </span>
          <span className={chipClass()}>
            <span className="mr-1.5 text-amber-300">●</span>
            {test.durationMinutes} minutes
          </span>
          <span className={chipClass()}>{test.board}</span>
          <span className={chipClass()}>{test.sourceLabel}</span>
        </div>
      </div>

      <div className="space-y-3">
        {test.questions.map((q, idx) => (
          <section
            key={`${q.id}__${idx}`}
            className="rounded-xl border border-white/10 bg-[#0b1020] p-3 sm:p-4"
            aria-label={`Question ${idx + 1}`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                Question {idx + 1} of {test.pickedCount}
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${difficultyClass(q.level)}`}
              >
                {difficultyLabel(q.level)}
              </span>
            </div>

            <PlayQuestionMarkdown
              source={q.question}
              variant="stem"
              className="mb-3 text-[15px] font-semibold leading-snug text-slate-100"
            />

            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, optionIndex) => (
                <div
                  key={`${q.id}-opt-${optionIndex}`}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <div className="flex items-start gap-2">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-slate-400">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <PlayQuestionMarkdown
                      source={opt}
                      variant="option"
                      className="min-w-0 text-sm leading-snug text-slate-200"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="relative mt-1 flex min-h-[44px] flex-col gap-3 border-t border-white/[0.06] pt-5 sm:block">
        <p className="order-first text-center text-xs text-slate-500 sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
          Step 5 of 5 — Review and generate
        </p>
        <div className="flex justify-center">
          <button
            type="button"
            className="inline-flex h-11 min-w-[min(100%,20rem)] items-center justify-center gap-2 rounded-full bg-emerald-500 px-7 text-sm font-bold text-black shadow-[0_0_24px_-4px_rgba(52,211,153,0.45)] transition hover:bg-emerald-400 sm:h-12 sm:px-10 sm:text-lg"
          >
            <Code2 className="h-4 w-4 shrink-0 opacity-90 sm:h-5 sm:w-5" strokeWidth={2.25} />
            Generate Test Now
          </button>
        </div>
      </div>
    </div>
  );
}
