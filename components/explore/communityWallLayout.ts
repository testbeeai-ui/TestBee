/** Sticky offset below AppLayout top nav — scales slightly on wide screens. */
export const COMMUNITY_WALL_STICKY_TOP = "top-12 xl:top-[3.25rem] 2xl:top-14";

/** Max height for hover-scroll right rail. */
export const COMMUNITY_WALL_RAIL_MAX_H =
  "max-h-[calc(100vh-3.25rem)] xl:max-h-[calc(100vh-3.5rem)] 2xl:max-h-[calc(100vh-3.75rem)]";

/** Page shell — fills AppLayout wide main; side rails grow via % grid columns below. */
export const COMMUNITY_WALL_SHELL = "mx-auto w-full max-w-full";

/**
 * 3-column grid from lg.
 * `gap-x` separates left | center | right; side cols use minmax(rem, %).
 */
export const COMMUNITY_WALL_GRID =
  "grid w-full grid-cols-1 gap-y-2.5 sm:gap-y-3 lg:grid-cols-[minmax(10.5rem,17%)_minmax(0,1fr)_minmax(12.5rem,21%)] lg:gap-x-5 lg:gap-y-3 xl:grid-cols-[minmax(11rem,16%)_minmax(0,1fr)_minmax(13.5rem,20%)] xl:gap-x-6 xl:gap-y-3 2xl:grid-cols-[minmax(12rem,15%)_minmax(0,1fr)_minmax(14.5rem,19%)] 2xl:gap-x-7 2xl:gap-y-3.5";

/** Center feed column — breathing room away from side rails. */
export const COMMUNITY_WALL_MAIN =
  "min-w-0 space-y-2 sm:space-y-2.5 lg:space-y-2.5 xl:space-y-3 lg:px-1 xl:px-1.5 2xl:px-2";

/** Main column hero / feed type scale. */
export const WALL_TEXT_HERO =
  "text-[15px] sm:text-base lg:text-[17px] xl:text-lg 2xl:text-[1.2rem] leading-snug";
export const WALL_TEXT_BODY =
  "text-[11px] sm:text-xs lg:text-[11px] xl:text-xs leading-relaxed";
export const WALL_TEXT_CAPTION =
  "text-[9px] sm:text-[10px] lg:text-[10px] xl:text-[10.5px] leading-snug";
export const WALL_TEXT_CHIP =
  "text-[10px] sm:text-[10.5px] lg:text-[10.5px] xl:text-[11px] px-2 py-0.5 sm:px-2.5 sm:py-1";

/** Container names for sidebar fluid type. */
export const COMMUNITY_WALL_LEFT_CONTAINER = "@container/left-rail";
export const COMMUNITY_WALL_RAIL_CONTAINER = "@container/right-rail";

/** Sidebar typography — scales with rail width (works across 100%–125% zoom). */
export const WALL_SIDEBAR_TEXT_NAV =
  "text-[10px] font-medium leading-tight @[10rem]/left-rail:text-[10.5px] @[12rem]/left-rail:text-[11px] @[14rem]/left-rail:text-xs @[16rem]/left-rail:text-[13px]";
export const WALL_SIDEBAR_TEXT_CAPTION =
  "text-[8.5px] font-bold uppercase tracking-[0.1em] leading-tight @[10rem]/left-rail:text-[9px] @[12rem]/left-rail:text-[9.5px] @[14rem]/left-rail:text-[10px]";
export const WALL_SIDEBAR_TEXT_BODY =
  "text-[10px] leading-snug @[12rem]/right-rail:text-[10.5px] @[14rem]/right-rail:text-[11px] @[16rem]/right-rail:text-xs @[18rem]/right-rail:text-[13px]";
export const WALL_SIDEBAR_TEXT_CAPTION_WIDGET =
  "text-[9px] leading-snug @[12rem]/right-rail:text-[9.5px] @[14rem]/right-rail:text-[10px] @[16rem]/right-rail:text-[10.5px] @[18rem]/right-rail:text-[11px]";
export const WALL_SIDEBAR_TEXT_TITLE =
  "text-[10px] font-semibold leading-snug @[12rem]/right-rail:text-[10.5px] @[14rem]/right-rail:text-[11px] @[16rem]/right-rail:text-xs @[18rem]/right-rail:text-[13px]";
export const WALL_SIDEBAR_PAD =
  "px-2 py-1.5 @[12rem]/right-rail:px-2.5 @[14rem]/right-rail:py-2 @[16rem]/right-rail:px-3 @[18rem]/right-rail:py-2.5";
export const WALL_SIDEBAR_ROW_GAP =
  "gap-1 @[12rem]/right-rail:gap-1.5 @[16rem]/right-rail:gap-2";

/** @deprecated use WALL_SIDEBAR_* */
export const WALL_TEXT_NAV = WALL_SIDEBAR_TEXT_NAV;
export const WALL_TEXT_WIDGET_TITLE = WALL_SIDEBAR_TEXT_TITLE;

/** Right-rail aliases */
export const WALL_RAIL_TEXT_BODY = WALL_SIDEBAR_TEXT_BODY;
export const WALL_RAIL_TEXT_CAPTION = WALL_SIDEBAR_TEXT_CAPTION_WIDGET;
export const WALL_RAIL_TEXT_TITLE = WALL_SIDEBAR_TEXT_TITLE;
export const WALL_RAIL_PAD = WALL_SIDEBAR_PAD;
export const WALL_RAIL_ROW_GAP = WALL_SIDEBAR_ROW_GAP;
