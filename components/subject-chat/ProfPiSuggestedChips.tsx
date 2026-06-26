"use client";

import React, { useMemo, useState } from "react";
import type { Subject } from "@/types";
import {
  getPresetChipIcon,
  SUBJECT_CHIP_ICON_COLOR,
} from "@/components/subject-chat/profPiChatTheme";

interface ProfPiSuggestedChipsProps {
  presets: string[];
  subject: Subject;
  isLoading: boolean;
  resetKey?: number;
  onSelect: (question: string) => void;
}

function randomRgb(): { r: number; g: number; b: number } {
  return {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
  };
}

function outlineStyle(
  rgb: { r: number; g: number; b: number },
  active: boolean
): React.CSSProperties {
  if (!active) {
    return { borderColor: "#334060", boxShadow: "none" };
  }
  const { r, g, b } = rgb;
  return {
    borderColor: `rgb(${r}, ${g}, ${b})`,
    boxShadow: `0 0 0 2px rgba(${r}, ${g}, ${b}, 0.35)`,
  };
}

export default function ProfPiSuggestedChips({
  presets,
  subject,
  isLoading,
  resetKey = 0,
  onSelect,
}: ProfPiSuggestedChipsProps) {
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [activeOutlineKey, setActiveOutlineKey] = useState<string | null>(null);

  const outlineColors = useMemo(
    () => presets.map(() => randomRgb()),
    [presets, resetKey]
  );

  // Reset disabled chips when chat is cleared
  React.useEffect(() => {
    setUsed(new Set());
  }, [resetKey]);
  const iconColor = SUBJECT_CHIP_ICON_COLOR[subject];

  const handleClick = (q: string) => {
    if (used.has(q) || isLoading) return;
    setUsed((prev) => new Set(prev).add(q));
    onSelect(q);
  };

  return (
    <div className="shrink-0 px-3.5 pb-2.5 pt-1">
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#5C6480]">
        Suggested questions
      </div>
      <div className="flex flex-col gap-1.5">
        {presets.map((q, index) => {
          const Icon = getPresetChipIcon(index);
          const isUsed = used.has(q);
          const rgb = outlineColors[index] ?? randomRgb();
          const outlineActive = activeOutlineKey === q;
          return (
            <button
              key={q}
              type="button"
              onClick={() => handleClick(q)}
              disabled={isLoading || isUsed}
              onMouseEnter={() => setActiveOutlineKey(q)}
              onMouseLeave={() =>
                setActiveOutlineKey((prev) => (prev === q ? null : prev))
              }
              onFocus={() => setActiveOutlineKey(q)}
              onBlur={() =>
                setActiveOutlineKey((prev) => (prev === q ? null : prev))
              }
              style={outlineStyle(rgb, outlineActive)}
              className="flex w-full items-center gap-1.5 rounded-[20px] border bg-[#1C2333] px-3 py-1.5 text-left text-[12px] leading-snug text-[#9BA3B8] outline-none transition-[border-color,box-shadow,background-color,color] hover:bg-[#171425] hover:text-[#E8EAF0] disabled:pointer-events-none disabled:opacity-40"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: iconColor }} aria-hidden />
              <span>{q}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
