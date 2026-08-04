"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import MathText from "@/components/MathText";
import {
  INSTACUE_TYPE_CONFIG,
  type InstaCueCardType,
} from "@/lib/instacue/instaCueTypeConfig";
import type { InstaCueCard } from "@/data/instaCueCards";
import styles from "../styles";

type ConceptsPanelProps = {
  cards: InstaCueCard[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDone: () => void;
};

export default function ConceptsPanel({
  cards,
  page,
  pageSize,
  onPageChange,
  onDone,
}: ConceptsPanelProps) {
  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
  const pageCards = cards.slice(page * pageSize, page * pageSize + pageSize);

  if (cards.length === 0) {
    return (
      <div className={styles.emptyState}>
        <strong>No concepts yet</strong>
        Concept cards will appear once InstaCue content exists for this sub-topic.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/50 p-2.5 sm:px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
            <i className="ti ti-bulb text-xs" aria-hidden="true" />
            Concepts
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            Page <strong className="text-foreground">{page + 1}</strong> of {totalPages}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-primary/40 hover:bg-muted/40 disabled:opacity-40 disabled:pointer-events-none"
            disabled={page === 0}
            onClick={() => onPageChange(Math.max(0, page - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-primary/40 hover:bg-muted/40 disabled:opacity-40 disabled:pointer-events-none"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex max-h-[58vh] flex-col gap-3.5 overflow-y-auto pr-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
        {pageCards.map((card, idx) => {
          const globalIndex = page * pageSize + idx + 1;
          const isConcept = card.type === "concept";
          const isFormula = card.type === "formula";
          const isMistake = card.type === "common_mistake";

          const borderAccent = isConcept
            ? "border-l-amber-500 hover:border-l-amber-400"
            : isFormula
              ? "border-l-sky-500 hover:border-l-sky-400"
              : isMistake
                ? "border-l-rose-500 hover:border-l-rose-400"
                : "border-l-purple-500 hover:border-l-purple-400";

          const badgeStyle = isConcept
            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
            : isFormula
              ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
              : isMistake
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-purple-500/10 border-purple-500/30 text-purple-400";

          const typeIcon = isConcept
            ? "ti-bulb"
            : isFormula
              ? "ti-math"
              : isMistake
                ? "ti-alert-triangle"
                : "ti-target";

          const typeLabel =
            INSTACUE_TYPE_CONFIG[card.type as InstaCueCardType]?.label ?? "Concept";

          return (
            <div
              key={card.id}
              className={`group relative flex flex-col rounded-2xl border border-border/80 border-l-4 bg-gradient-to-b from-card/90 via-card/75 to-card/90 p-4 sm:p-4.5 shadow-sm transition-all duration-200 hover:shadow-md ${borderAccent}`}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${badgeStyle}`}
                >
                  <i className={`ti ${typeIcon} text-xs`} aria-hidden="true" />
                  {typeLabel}
                </span>
                <span className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  #{globalIndex}
                </span>
              </div>

              <div className="mb-2.5 text-sm font-bold leading-snug text-foreground">
                <MathText>{card.frontContent}</MathText>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-xs sm:text-sm leading-relaxed text-muted-foreground transition group-hover:border-border/70 group-hover:bg-muted/30">
                <MathText>{card.backContent}</MathText>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-3">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <i className="ti ti-check-circle text-emerald-400 text-sm" aria-hidden="true" />
          Mark reviewed to update progress
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98]"
          onClick={onDone}
        >
          <i className="ti ti-check text-sm" aria-hidden="true" />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
}
