/**
 * Desktop NTA exam chrome class lists.
 * Compactness is a viewport budget: the header must not grow at xl/2xl,
 * and Back/Next stay pinned outside the question scroll.
 */

/** True when a class list never uses p/py/pt/pb of 3 or taller at any breakpoint. */
export function ntaChromeAvoidsTallPadding(className: string): boolean {
  return !/(?:^|\s)(?:sm:|md:|lg:|xl:|2xl:)?(?:p|py|pt|pb)-(?:[3-9]|[1-9]\d)\b/.test(className);
}

/** True when a class list never uses h/w of 14+ or arbitrary rem heights. */
export function ntaChromeAvoidsTallBox(className: string): boolean {
  return !/(?:^|\s)(?:sm:|md:|lg:|xl:|2xl:)?(?:h|w)-(?:1[4-9]|[2-9]\d|\[\d)/.test(className);
}

export const NTA_EXAM_HEADER_CLASS =
  "relative shrink-0 border-b px-2.5 py-1.5 sm:px-4 sm:py-2 lg:px-5";

export const NTA_EXAM_AVATAR_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border bg-white sm:h-10 sm:w-10";

export const NTA_EXAM_ACTION_BAR_CLASS =
  "nta-exam-action-bar flex min-w-0 shrink-0 flex-wrap gap-1.5 sm:gap-2";

export const NTA_EXAM_NAV_FOOTER_CLASS =
  "nta-exam-nav-bar flex min-w-0 shrink-0 flex-wrap items-center gap-1.5 sm:gap-2";

export const NTA_EXAM_TIMER_CLASS =
  "rounded-md px-3 py-1 font-mono text-xl font-black tabular-nums tracking-wide sm:px-3.5 sm:text-2xl";

/** Fixed desktop width — do not grow at xl/2xl or the palette eats the question. */
export const NTA_EXAM_PALETTE_ASIDE_CLASS =
  "flex min-h-0 w-full min-w-0 max-w-full shrink-0 flex-col overflow-x-hidden border-t lg:w-64 lg:min-w-64 lg:max-w-64 lg:border-l lg:border-t-0";

export const NTA_EXAM_FOOTER_DOCK_CLASS =
  "flex shrink-0 flex-col gap-2 border-t px-3 pt-2.5 pb-3 sm:px-4 lg:px-5";
