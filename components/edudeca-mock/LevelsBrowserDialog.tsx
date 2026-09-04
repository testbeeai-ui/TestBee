"use client";

import { useEffect, useState } from "react";

import { EDUDECA_MOCK_LEVELS, type EduDecaMockLevelId } from "@/lib/edudeca-mock/question-bank";
import {
  EDUDECA_MOCK_SET_COUNT,
  formatSetNumber,
  paperStorageKey,
  type AttemptChipStatus,
} from "@/lib/edudeca-mock/session-store";
import { cn } from "@/lib/utils";

type LevelsBrowserDialogProps = {
  open: boolean;
  onClose: () => void;
  activeLevel: EduDecaMockLevelId;
  activeSet: number;
  statuses?: Record<string, AttemptChipStatus>;
  onSelect: (level: EduDecaMockLevelId, set: number) => void;
};

function chipStatusLabel(status: AttemptChipStatus | undefined): string {
  switch (status) {
    case "completed":
      return ", completed";
    case "inprogress":
      return ", in progress";
    case undefined:
      return "";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function chipStatusClassName(status: AttemptChipStatus | undefined): string {
  switch (status) {
    case "completed":
      return "border-[#1D9E75] bg-[#1B212B] text-[#22D3A6]";
    case "inprogress":
      return "border-[#EF9F27] bg-[#1B212B] text-[#EF9F27]";
    case undefined:
      return "border-[#262E3A] bg-[#1B212B] text-[#EAEFF5] hover:border-[var(--lb-color)] hover:text-[var(--lb-color)]";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function LevelsBrowserDialog({
  open,
  onClose,
  activeLevel,
  activeSet,
  statuses = {},
  onSelect,
}: LevelsBrowserDialogProps) {
  const [tab, setTab] = useState<EduDecaMockLevelId>(activeLevel);

  useEffect(() => {
    if (open) setTab(activeLevel);
  }, [activeLevel, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  const tabMeta = EDUDECA_MOCK_LEVELS.find((level) => level.id === tab) ?? EDUDECA_MOCK_LEVELS[0];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(5,7,10,0.72)] px-5"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="levels-browser-title"
        className="max-h-[88vh] w-full max-w-[520px] overflow-y-auto rounded-[18px] border border-[#262E3A] bg-[#151A22] p-[26px]"
        style={{ ["--lb-color" as string]: tabMeta.color }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 text-2xl" aria-hidden>
          📶
        </div>
        <h2 id="levels-browser-title" className="mb-1.5 text-[17px] font-extrabold text-[#EAEFF5]">
          Choose an EduDeca Level &amp; Set
        </h2>
        <p className="mb-5 text-[12.5px] leading-[1.55] text-[#8B96A5]">
          Switching sets keeps each paper counted. Paused sets stay in progress; finished sets
          keep their score.
        </p>

        <div className="mb-4 flex gap-2">
          {EDUDECA_MOCK_LEVELS.map((level) => {
            const active = level.id === tab;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => setTab(level.id)}
                className={cn(
                  "flex-1 rounded-[10px] border-[1.5px] px-2 py-2.5 text-center text-[12.5px] font-bold",
                  active ? "bg-white/[0.03]" : "border-[#262E3A] bg-[#1B212B] text-[#8B96A5]",
                )}
                style={active ? { borderColor: level.color, color: level.color } : undefined}
              >
                {level.name}
              </button>
            );
          })}
        </div>

        <div className="grid max-h-[280px] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
          {Array.from({ length: EDUDECA_MOCK_SET_COUNT }, (_, index) => index + 1).map((set) => {
            const selected = tab === activeLevel && set === activeSet;
            const status = statuses[paperStorageKey(tab, set)];
            return (
              <button
                key={set}
                type="button"
                onClick={() => onSelect(tab, set)}
                aria-label={`Set ${formatSetNumber(set)}${chipStatusLabel(status)}`}
                className={cn(
                  "rounded-[9px] border px-1 py-2.5 text-center text-xs font-bold",
                  selected ? "bg-white/[0.03]" : chipStatusClassName(status),
                )}
                style={selected ? { borderColor: tabMeta.color, color: tabMeta.color } : undefined}
              >
                Set {formatSetNumber(set)}
              </button>
            );
          })}
        </div>

        <div className="mt-[18px] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border-[1.5px] border-[#262E3A] bg-transparent px-[22px] py-3.5 text-[14.5px] font-bold text-[#EAEFF5] hover:bg-[#EAEFF5]/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
