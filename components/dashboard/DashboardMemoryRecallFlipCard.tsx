"use client";

import type { MouseEvent, KeyboardEvent } from "react";
import { Check, CheckCircle2, Clock, Flag, Lightbulb, RotateCw } from "lucide-react";
import MathText from "@/components/MathText";
import { INSTACUE_TYPE_CONFIG } from "@/lib/instacue/instaCueTypeConfig";
import { normalizeCardMath } from "@/lib/saved/revisionCardMath";
import type { RevisionCardType, SavedRevisionCard, Subject } from "@/types";
import { cn } from "@/lib/utils";

export type RecallAction = "unsure" | "tomorrow" | "know_it";

/** Flip card height — 5 rows × 2 cols = 10 cards per page (width stays full column). */
export const MEMORY_RECALL_CARD_HEIGHT_PX = 128;

const SUBJECT_STYLE: Record<
  Subject,
  { border: string; label: string; display: string }
> = {
  physics: {
    border: "border-[#378ADD]",
    label: "text-[#378ADD]",
    display: "Physics",
  },
  chemistry: {
    border: "border-[#1D9E75]",
    label: "text-[#1D9E75]",
    display: "Chemistry",
  },
  math: {
    border: "border-[#7F77DD]",
    label: "text-[#7F77DD]",
    display: "Mathematics",
  },
};

interface DashboardMemoryRecallFlipCardProps {
  card: SavedRevisionCard;
  flipped: boolean;
  onFlipChange: (flipped: boolean) => void;
  /** Unflip this card when pointer moves to a different card. */
  onPeerHover?: () => void;
  selectedAction: RecallAction | null;
  onAction: (action: RecallAction) => void;
}

function CardActions({
  selectedAction,
  onAction,
  onClickStop,
}: {
  selectedAction: RecallAction | null;
  onAction: (action: RecallAction) => void;
  onClickStop: (e: React.MouseEvent) => void;
}) {
  const actions: {
    id: RecallAction;
    label: string;
    icon: React.ReactNode;
    activeIcon: React.ReactNode;
    className: string;
  }[] = [
    {
      id: "unsure",
      label: "Unsure",
      icon: <Flag className="h-3 w-3 text-[#EF9F27]" aria-hidden />,
      activeIcon: <Flag className="h-3 w-3 fill-[#EF9F27] text-[#EF9F27]" aria-hidden />,
      className: "hover:bg-white/5",
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      icon: <Clock className="h-3 w-3 text-[#378ADD]" aria-hidden />,
      activeIcon: <CheckCircle2 className="h-3 w-3 text-[#378ADD]" aria-hidden />,
      className: "hover:bg-white/5",
    },
    {
      id: "know_it",
      label: "Know It",
      icon: <CheckCircle2 className="h-3 w-3 text-[#1D9E75]" aria-hidden />,
      activeIcon: <Check className="h-3 w-3 text-[#1D9E75]" aria-hidden />,
      className: "hover:bg-white/5",
    },
  ];

  return (
    <div
      className="mt-auto flex shrink-0 items-center justify-between border-t border-white/10 pt-1"
      onClick={onClickStop}
    >
      {actions.map((action) => {
        const isSelected = selectedAction === action.id;
        const isDimmed = selectedAction != null && !isSelected;
        return (
          <button
            key={action.id}
            type="button"
            title={action.label}
            disabled={isDimmed}
            onClick={(e) => {
              e.stopPropagation();
              onAction(action.id);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-px rounded px-0.5 py-px transition-colors",
              action.className,
              isDimmed && "pointer-events-none opacity-35"
            )}
          >
            {isSelected ? action.activeIcon : action.icon}
            <span className="text-[7.5px] leading-none text-[#5C6480] whitespace-nowrap">
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function typeBadgeConfig(type: RevisionCardType | undefined) {
  return INSTACUE_TYPE_CONFIG[type ?? "concept"] ?? INSTACUE_TYPE_CONFIG.concept;
}

function CardFace({
  card,
  side,
  selectedAction,
  onAction,
}: {
  card: SavedRevisionCard;
  side: "front" | "back";
  selectedAction: RecallAction | null;
  onAction: (action: RecallAction) => void;
}) {
  const style = SUBJECT_STYLE[card.subject] ?? SUBJECT_STYLE.physics;
  const typeCfg = typeBadgeConfig(card.type);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-[#111418] p-1.5",
        style.border
      )}
    >
      <div className="mb-1 flex shrink-0 items-center justify-between gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <span className={cn("text-[8px] font-semibold uppercase tracking-wide", style.label)}>
            {style.display}
          </span>
          <span
            className={cn(
              "inline-flex max-w-full truncate rounded-full px-1 py-px text-[7.5px] font-semibold leading-tight",
              typeCfg.badge
            )}
          >
            {typeCfg.label}
          </span>
        </div>
        <span
          className="flex shrink-0 items-center text-[#5C6480]"
          title="Tap to flip"
          aria-hidden
        >
          <RotateCw className="h-2.5 w-2.5" />
        </span>
      </div>

      {side === "front" ? (
        <div className="pointer-events-none min-h-0 flex-1 overflow-hidden text-[10.5px] font-medium leading-snug text-white">
          <MathText weight="semibold" className="line-clamp-2 block overflow-hidden">
            {normalizeCardMath(card.frontContent, true)}
          </MathText>
        </div>
      ) : (
        <>
          <div className="mb-0.5 flex shrink-0 items-center gap-0.5 text-[8px] text-[#5C6480]">
            <Lightbulb className="h-2 w-2 text-[#1D9E75]" aria-hidden />
            Answer
          </div>
          <div className="pointer-events-none min-h-0 flex-1 overflow-hidden text-[10.5px] leading-snug text-[#E8EAF0]">
            <MathText weight="normal" className="line-clamp-2 block overflow-hidden">
              {normalizeCardMath(card.backContent, true) || "No answer saved for this card."}
            </MathText>
          </div>
        </>
      )}

      <CardActions
        selectedAction={selectedAction}
        onAction={onAction}
        onClickStop={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function DashboardMemoryRecallFlipCard({
  card,
  flipped,
  onFlipChange,
  onPeerHover,
  selectedAction,
  onAction,
}: DashboardMemoryRecallFlipCardProps) {
  const toggleFlip = (e: MouseEvent | KeyboardEvent) => {
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    if ("key" in e) e.preventDefault();
    if (
      "target" in e &&
      e.target instanceof HTMLElement &&
      e.target.closest("button")
    ) {
      return;
    }
    onFlipChange(!flipped);
  };

  const handleMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    if (!flipped) return;
    const related = e.relatedTarget;
    if (related instanceof Node && e.currentTarget.contains(related)) return;
    onFlipChange(false);
  };

  return (
    <div className="dashboard-memory-recall [perspective:1000px]">
      <div
        role="group"
        tabIndex={0}
        aria-label={flipped ? "Memory card — tap to show question" : "Memory card — tap to show answer"}
        className="relative block w-full cursor-pointer text-left hover:opacity-[0.98]"
        style={{ height: MEMORY_RECALL_CARD_HEIGHT_PX }}
        onMouseEnter={() => onPeerHover?.()}
        onMouseLeave={handleMouseLeave}
        onClick={toggleFlip}
        onKeyDown={toggleFlip}
      >
        <div
          className={cn(
            "relative h-full w-full transition-transform duration-[450ms] ease-[cubic-bezier(0.4,0,0.2,1)] [transform-style:preserve-3d]",
            flipped && "[transform:rotateY(180deg)]"
          )}
        >
          <div
            className="absolute inset-0 [backface-visibility:hidden]"
            style={{ WebkitBackfaceVisibility: "hidden" }}
          >
            <CardFace card={card} side="front" selectedAction={selectedAction} onAction={onAction} />
          </div>
          <div
            className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]"
            style={{ WebkitBackfaceVisibility: "hidden" }}
          >
            <CardFace card={card} side="back" selectedAction={selectedAction} onAction={onAction} />
          </div>
        </div>
      </div>
    </div>
  );
}

export { SUBJECT_STYLE };
