# Explore-1 Deep Changes

Branch: `explore-1-deep-changes`

## Summary

Major UX and persistence improvements for the **Saved Bits & Formulas** section and related Deep Dive flows, including topic-wise grouping, inline interactive MCQs, formula highlighting, and Supabase-backed persistence.

---

## 1. Saved Bits & Formulas – persistence and auth

### Supabase-backed storage

- **Migration** `supabase/migrations/20250311000000_profiles_saved_bits_formulas.sql`: added `saved_bits` and `saved_formulas` JSONB columns to `profiles`.
- **API** `app/api/user/saved-content/route.ts`:
  - `GET` – returns saved bits and formulas for the current user.
  - `POST` – updates user’s saved bits and formulas.
  - Supports both cookie and Bearer-token auth.

### Client service and auth fallback

- **`lib/savedContentService.ts`**: `fetchSavedContent()` and `syncSavedContent()` send `Authorization: Bearer <token>` so API works with localStorage-based sessions.
- **Revision page**: uses API as main source of truth, falls back to local store when API fails or returns empty.

---

## 2. Saved Bits – inline interactive UI

### Topic-wise grouping

- Bits grouped by `subject · topic` (e.g. `Physics · Thermodynamics`).
- Accordion layout: each topic is expandable with a bit count.

### Sideways (carousel) navigation

- **`components/BitsCarousel.tsx`**:
  - One bit at a time.
  - Previous/Next buttons and `Question X of Y` label.
- Replaces vertical stacking with a quiz-style layout.

### Interactive bits

- **`components/InteractiveBit.tsx`**: full MCQ UI with options, correct/incorrect feedback, explanation, and unsave button.
- **`components/BitsCarousel.tsx`**: wraps `InteractiveBit` with carousel controls.

---

## 3. Formulas MCQ’s – separate section and carousel

### Dedicated “Formulas MCQ’s” section

- Renamed “Saved Formulas” to **Formulas MCQ’s**.
- Grouped by topic (same pattern as bits).
- Shown in its own section, distinct from Saved Bits.

### Sideways navigation

- **`components/FormulaMcqCarousel.tsx`**:
  - One formula MCQ at a time.
  - Previous/Next and `Question X of Y`.
- **`components/InteractiveFormula.tsx`**: formula header (name, LaTeX) plus interactive questions, with unsave button.

---

## 4. Deep Dive – save current question only

### Formula save behavior

- **“Save current question”** replaces “Save Formula”.
- Saves only the question currently shown in formula practice.
- `BitsQuiz` exposes `onIndexChange` so the parent tracks the active question index.
- `formulaCurrentIndex` state drives which question is saved.

### Formula context on bits

- Bits saved from formula practice get optional `formulaName` and `formulaLatex`.
- Allows a visual “Formula” badge on Saved Bits when applicable.

---

## 5. Formula highlighting in Saved Bits

- **`SavedBit`** type extended with optional `formulaName` and `formulaLatex`.
- **`InteractiveBit`**: when `formulaName` or `formulaLatex` is set:
  - Shows a **Formula** badge with the formula name/LaTeX.
  - Uses a primary-colored border/ring to distinguish formula bits.

---

## 6. TypeScript build fixes

- **`app/api/user/saved-content/route.ts`**: cast Supabase `Json` via `unknown` to `SavedBit[]` / `SavedFormula[]`.
- **`hooks/useAuth.tsx`**: cast profile data via `unknown` to `Profile` to satisfy strict typing.

---

## Files added

- `app/api/user/saved-content/route.ts`
- `app/[board]/[subject]/[grade]/[unit]/[topic]/[level]/deep-dive/[section]/page.tsx` (and related route structure)
- `components/BitsCarousel.tsx`
- `components/FormulaMcqCarousel.tsx`
- `components/InteractiveBit.tsx`
- `components/InteractiveFormula.tsx`
- `lib/savedContentService.ts`
- `supabase/migrations/20250311000000_profiles_saved_bits_formulas.sql`

## Files modified

- `app/revision/page.tsx` – grouping, carousels, API usage, fallback
- `types/index.ts` – `SavedBit.formulaName`, `SavedBit.formulaLatex`
- `hooks/useAuth.tsx` – profile type casts
- Deep Dive section page – formula context, save-current-question, `onIndexChange`

---

## Database migration

Run in Supabase Dashboard SQL Editor or via CLI:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saved_bits jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS saved_formulas jsonb NOT NULL DEFAULT '[]'::jsonb;
```
