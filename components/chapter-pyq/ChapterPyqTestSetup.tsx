"use client";

import { useMemo, useState } from "react";
import { parsePyqTestSetup, pyqTestTotalMinutes } from "@/lib/chapter-pyq/pyqTestSetup";

type ChapterPyqTestSetupProps = {
  setLabel: string;
  maxQuestions: number;
  onCancel: () => void;
  onBegin: (questionCount: number, minutesPerQuestion: number) => void;
};

export default function ChapterPyqTestSetup({
  setLabel,
  maxQuestions,
  onCancel,
  onBegin,
}: ChapterPyqTestSetupProps) {
  const [countRaw, setCountRaw] = useState(String(maxQuestions));
  const [minutesRaw, setMinutesRaw] = useState("2");

  const parsed = useMemo(
    () => parsePyqTestSetup(countRaw, minutesRaw, maxQuestions),
    [countRaw, minutesRaw, maxQuestions]
  );

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-[#1F2436] bg-[#0E111A] px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20";

  return (
    <div className="rounded-2xl border border-[#1F2436] bg-[#121624] p-5 sm:p-6 text-[#F8FAFC]">
      <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Test setup</p>
      <h3 className="mt-1 text-lg font-extrabold tracking-tight">{setLabel}</h3>
      <p className="mt-1 text-xs sm:text-sm text-[#94A3B8]">
        Draw a random subset from this set. Maximum {maxQuestions}{" "}
        {maxQuestions === 1 ? "question" : "questions"}.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-[#94A3B8]">
          Questions
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={countRaw}
            onChange={(event) => setCountRaw(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold text-[#94A3B8]">
          Minutes per question
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={minutesRaw}
            onChange={(event) => setMinutesRaw(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      {parsed.ok ? (
        <p className="mt-4 text-sm font-medium text-[#A5B4FC]">
          Total time: {pyqTestTotalMinutes(parsed.questionCount, parsed.minutesPerQuestion)} min
        </p>
      ) : (
        <p className="mt-4 text-sm text-[#FDA4AF]">
          Enter a whole number of questions from 1 to {maxQuestions}, and at least 1 minute per
          question.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[#1F2436] bg-[#161A28] px-4 py-2 text-xs sm:text-sm font-semibold text-[#F8FAFC] transition-colors hover:border-[#2F3752] hover:bg-[#1E2438]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!parsed.ok}
          onClick={() => {
            const next = parsePyqTestSetup(countRaw, minutesRaw, maxQuestions);
            if (!next.ok) return;
            onBegin(next.questionCount, next.minutesPerQuestion);
          }}
          className="rounded-full border border-[#6366F1]/30 bg-[#6366F1] px-4 py-2 text-xs sm:text-sm font-bold text-white transition-colors hover:bg-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Begin Test
        </button>
      </div>
    </div>
  );
}
