"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const GYAN_FEED_PAGE_SIZE = 10;

type PageItem = { kind: "page"; page: number } | { kind: "ellipsis"; key: string };

/** Pages to show around the current page (each side), before merging with 1 and last. */
const PAGE_NEIGHBOURS = 2;

/**
 * Truncated pagination: always include 1 and last, plus neighbours of current.
 * Insert ellipsis (…) wherever there is a gap of more than 1 between consecutive shown pages.
 * Example (many pages): `1 … 9 10 11 … 50`
 */
function buildPageItems(current: number, total: number): PageItem[] {
  if (total <= 1) return [{ kind: "page", page: 1 }];

  const clampedCurrent = Math.min(Math.max(current, 1), total);
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let p = clampedCurrent - PAGE_NEIGHBOURS; p <= clampedCurrent + PAGE_NEIGHBOURS; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const items: PageItem[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev > 1) {
      items.push({ kind: "ellipsis", key: `gap-${prev}-${p}` });
    }
    items.push({ kind: "page", page: p });
  }

  return items;
}

export interface GyanFeedPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Bottom-of-feed pagination for Gyan++ — dark card styling, blue active state, keyboard-friendly.
 */
export default function GyanFeedPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
}: GyanFeedPaginationProps) {
  if (totalItems === 0) return null;
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const items = buildPageItems(page, totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      className={cn(
        "mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4",
        className
      )}
      aria-label="Feed pagination"
    >
      <p className="text-[11px] sm:text-xs text-muted-foreground tabular-nums order-2 sm:order-1">
        Showing{" "}
        <span className="font-semibold text-foreground">
          {start}–{end}
        </span>{" "}
        of <span className="font-semibold text-foreground">{totalItems}</span>
      </p>

      <div className="order-1 sm:order-2 flex flex-wrap items-center justify-center gap-1 rounded-xl border border-border/60 bg-muted/25 px-2 py-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => canPrev && onPageChange(page - 1)}
          disabled={!canPrev}
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            canPrev
              ? "text-foreground hover:bg-primary/15 hover:text-primary"
              : "cursor-not-allowed text-muted-foreground/50"
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <ul className="flex items-center gap-0.5">
          {items.map((item, idx) =>
            item.kind === "ellipsis" ? (
              <li
                key={`${item.key}-${idx}`}
                className="flex h-9 min-w-[2rem] items-center justify-center px-1 text-muted-foreground"
              >
                <span
                  className="text-lg font-bold leading-none tracking-widest select-none"
                  aria-hidden
                >
                  …
                </span>
                <span className="sr-only">Skipped pages</span>
              </li>
            ) : (
              <li key={item.page}>
                <button
                  type="button"
                  onClick={() => onPageChange(item.page)}
                  aria-current={item.page === page ? "page" : undefined}
                  className={cn(
                    "min-w-[2.25rem] h-9 rounded-lg text-xs font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    item.page === page
                      ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                      : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
                  )}
                >
                  {item.page}
                </button>
              </li>
            )
          )}
        </ul>

        <button
          type="button"
          onClick={() => canNext && onPageChange(page + 1)}
          disabled={!canNext}
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            canNext
              ? "text-foreground hover:bg-primary/15 hover:text-primary"
              : "cursor-not-allowed text-muted-foreground/50"
          )}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
