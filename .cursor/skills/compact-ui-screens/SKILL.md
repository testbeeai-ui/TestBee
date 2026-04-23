---
name: compact-ui-screens
description: Tighten UI density for 11–13 inch laptop screens. Use when the user says UI is too big, wants smaller sizing, better proportions, compact layout, or improved responsiveness on small/medium screens (e.g. 1366×768, 1440×900).
---

# Compact UI for 11–13" screens

## Goal
Make layouts feel **less bulky** on common laptop viewports without hurting readability or tap targets.

## Default targets
- **Primary target**: 1366×768 @ 100% scaling
- **Secondary**: 1440×900 and 1280×720
- Prefer small improvements via responsive classes (Tailwind) over new components.

## Quick checklist (Tailwind-first)
- **Spacing**: replace big gaps with responsive variants:
  - `space-y-6` → `space-y-4 sm:space-y-6`
  - `p-5`/`p-6` → `p-4 sm:p-5` (or `p-3 sm:p-4` for dense panels)
- **Typography**:
  - Large titles: `text-5xl` → `text-3xl sm:text-5xl`
  - Body: `text-base` → `text-sm sm:text-base`
  - Tab labels: `text-xs` → `text-[11px] sm:text-xs`
- **Controls**:
  - Inputs/selects: `h-11` → `h-10` (keep at least ~40px)
  - Buttons: shrink padding on small screens: `px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm`
- **Grids/tabs**:
  - Ensure multi-tab bars wrap/fit: `grid-cols-2 min-[520px]:grid-cols-3 sm:grid-cols-5`
  - Prefer `truncate` on long labels, keep icons small (`h-3.5 w-3.5`)

## Process
1. Identify the “bulky” area (header, cards, tab bar, forms).
2. Apply **responsive density** (smaller on base, restore on `sm+`).
3. Keep tap targets usable (avoid shrinking below ~40px height).
4. Re-run lints/TS checks for edited files only.

## What not to do
- Don’t reduce contrast or line-height to “fit more”.
- Don’t hardcode pixel widths for layout breakpoints; use Tailwind breakpoints.

