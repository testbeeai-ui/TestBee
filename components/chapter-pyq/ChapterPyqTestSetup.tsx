"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  parsePyqTestSetup,
  PYQ_TEST_MARK_RIGHT,
  PYQ_TEST_MARK_WRONG,
  pyqTestTotalMinutes,
} from "@/lib/chapter-pyq/pyqTestSetup";
import { cn } from "@/lib/utils";

type ChapterPyqTestSetupProps = {
  setLabel: string;
  maxQuestions: number;
  onCancel: () => void;
  onBegin: (questionCount: number, minutesPerQuestion: number) => void;
};

const MINUTES_STEP_MAX = 60;

function stepCount(raw: string, delta: number, min: number, max: number): string {
  const current = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : min;
  return String(Math.min(max, Math.max(min, current + delta)));
}

function CountDeck({
  label,
  caption,
  value,
  onChange,
  onDecrease,
  onIncrease,
  decreaseDisabled,
  increaseDisabled,
}: {
  label: string;
  caption: string;
  value: string;
  onChange: (next: string) => void;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseDisabled: boolean;
  increaseDisabled: boolean;
}) {
  return (
    <div className="bg-[#121624] px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748B]">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={decreaseDisabled}
          onClick={onDecrease}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-[#F8FAFC] transition-colors hover:bg-white/5 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-16 bg-transparent text-center text-4xl font-black tabular-nums tracking-tight text-white outline-none"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={increaseDisabled}
          onClick={onIncrease}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-[#F8FAFC] transition-colors hover:bg-white/5 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-center text-xs font-medium text-[#A5B4FC]">{caption}</p>
    </div>
  );
}

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
  const questionCount = /^\d+$/.test(countRaw.trim()) ? Number(countRaw.trim()) : 0;
  const minutes = /^\d+$/.test(minutesRaw.trim()) ? Number(minutesRaw.trim()) : 0;

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#10141e] text-[#F8FAFC] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="relative px-5 pb-4 pt-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#6366F1]/25 to-transparent"
        />
        <p className="relative text-[10px] font-bold uppercase tracking-[0.22em] text-[#A5B4FC]">
          Test setup
        </p>
        <h3 className="relative mt-1 text-3xl font-black tracking-tight">{setLabel}</h3>
        <p className="relative mt-1 text-sm text-[#94A3B8]">A random draw from this set.</p>
      </div>

      <div className="mx-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-2 divide-x divide-white/10">
          <CountDeck
            label="Questions"
            caption={`Maximum ${maxQuestions}`}
            value={countRaw}
            onChange={setCountRaw}
            onDecrease={() => setCountRaw(stepCount(countRaw, -1, 1, maxQuestions))}
            onIncrease={() => setCountRaw(stepCount(countRaw, 1, 1, maxQuestions))}
            decreaseDisabled={questionCount <= 1}
            increaseDisabled={questionCount >= maxQuestions}
          />
          <CountDeck
            label="Minutes"
            caption="Each question"
            value={minutesRaw}
            onChange={setMinutesRaw}
            onDecrease={() => setMinutesRaw(stepCount(minutesRaw, -1, 1, MINUTES_STEP_MAX))}
            onIncrease={() => setMinutesRaw(stepCount(minutesRaw, 1, 1, MINUTES_STEP_MAX))}
            decreaseDisabled={minutes <= 1}
            increaseDisabled={minutes >= MINUTES_STEP_MAX}
          />
        </div>
        <div className="flex items-end justify-between border-t border-white/10 bg-[#0c1020] px-4 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748B]">
              On the clock
            </p>
            {parsed.ok ? (
              <p className="mt-1 text-3xl font-black tabular-nums tracking-tight">
                {pyqTestTotalMinutes(parsed.questionCount, parsed.minutesPerQuestion)}
                <span className="ml-1.5 text-base font-semibold text-[#A5B4FC]">min</span>
              </p>
            ) : (
              <p className="mt-1 text-sm font-medium text-[#FDA4AF]">
                Use 1 to {maxQuestions} questions, and at least 1 minute.
              </p>
            )}
          </div>
          <div
            aria-hidden
            className={cn(
              "mb-1 h-12 w-12 rounded-full border-4",
              parsed.ok ? "border-[#6366F1] border-t-[#C7D2FE]" : "border-[#F43F5E]/40"
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/5 px-4 py-4 ring-1 ring-emerald-300/20">
          <p className="text-3xl font-black tabular-nums text-emerald-300">+{PYQ_TEST_MARK_RIGHT}</p>
          <p className="mt-1 text-xs font-semibold text-emerald-100/80">Right answer</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-rose-400/20 to-rose-500/5 px-4 py-4 ring-1 ring-rose-300/20">
          <p className="text-3xl font-black tabular-nums text-rose-300">{PYQ_TEST_MARK_WRONG}</p>
          <p className="mt-1 text-xs font-semibold text-rose-100/80">Wrong answer</p>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 pb-5">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-3 text-sm font-semibold text-[#94A3B8] transition-colors hover:text-white"
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
          className="flex-1 rounded-2xl bg-[#6366F1] py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(99,102,241,0.35)] transition-colors hover:bg-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Begin test
        </button>
      </div>
    </div>
  );
}
