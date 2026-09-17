"use client";

import { PYQ_TIER_CHIPS, type PyqTierFilter } from "@/lib/chapter-pyq/pyqTiers";

import { cn } from "@/lib/utils";

type ChapterPyqTierFilterProps = {
  value: PyqTierFilter;
  counts: Record<PyqTierFilter, number>;
  onChange: (next: PyqTierFilter) => void;
};

export default function ChapterPyqTierFilter({
  value,
  counts,
  onChange,
}: ChapterPyqTierFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Question tier">
      {PYQ_TIER_CHIPS.map((chip) => {
        const active = value === chip.id;
        const count = counts[chip.id] ?? 0;
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={active}
            disabled={count === 0}
            onClick={() => onChange(chip.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer",
              active
                ? "border border-[#6366F1] bg-[#6366F1] text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)]"
                : "border border-[#1F2436] bg-[#161A28] text-[#94A3B8] hover:border-[#2F3752] hover:text-white disabled:opacity-40"
            )}
          >
            {chip.label} · {count}
          </button>
        );
      })}
    </div>
  );
}
