# Chapter PYQ Physics — App Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/chapter-pyq/physics/<chapter>` from a *Questions coming soon* stub into a working timed NTA-style player for JEE Main Physics previous-year questions — tier-filtered, balanced into sets, with genuine numeric input and Supabase Storage figures — proven on Laws of Motion.

**Architecture:** Everything decidable lives in pure modules under `lib/chapter-pyq/` (row types, PDF→catalog mapping, set splitting, row→`Question` mapping, scoring, figure resolution), because that is the only place this repo can run tests. Two cached API routes read the PYQ tables with the service-role client and return already-mapped questions. A new thin client component `ChapterPyqExamSession` owns timer/answer/flag/visited state and mirrors — never imports — the useful parts of `MockPageContent`. The shared `NtaExamShell` / `NtaExamShellMobile` gain three **optional** props (numeric drafts, numeric change callback, per-question badges) so the live mock flow is bit-for-bit unchanged.

**Tech Stack:** Next.js App Router, TypeScript, Vitest (node environment), Supabase JS v2 (`createAdminClient`), existing NTA shell + KaTeX pipeline, Tailwind.

**Sibling plan:** `2026-09-11-chapter-pyq-physics-ingestion.md` owns the schema migration (`pyq_questions.body` nullable, `skeleton_only` review status, `pyq_chapters.catalog_slug`) and the Phase 2–9 extraction work. **Do not do any of that here.** This plan is deliberately not blocked on it: Task 3 hand-seeds a representative fixture so Tasks 4–10 are built and tested with zero live pipeline data.

**Table names.** The ingestion plan lands every question-bank table under a `pyq_` prefix — `pyq_subjects`, `pyq_units`, `pyq_chapters`, `pyq_topics`, `pyq_questions`, `pyq_question_options`, `pyq_figures`, `pyq_figure_links`, `pyq_ingestion_runs`, plus the view `v_pyq_ingestion_check`. That is a clarity decision, not a collision fix: the bare names were free, but `public` already holds `mock_questions`, `past_paper_questions`, `play_questions`, `learning_outcomes_questions` and `saved_questions`, so a bare `public.questions` holding only JEE Physics previous-year rows would mislead every future reader. Queries in this plan use the prefixed names and **alias each embed back to the unprefixed key** (`chapters:pyq_chapters(...)`), so the returned JSON shape — and therefore every TypeScript identifier below, `row.chapters?.catalog_slug` included — is unchanged.

## Global Constraints

- Web only. Do not touch EduDeca or EduBite.
- JEE Main Physics only. Pilot chapter is **Laws of Motion** — 132 questions: 113 MCQ, 19 numerical, 52 with figures; tiers 79 Must Do / 29 Concept Builder / 24 Advanced.
- Students see only questions with `review_status in ('auto_ok','human_ok')`. Counts obey the same filter. The full set of allowed values is `unreviewed`, `skeleton_only`, `auto_ok`, `flagged`, `human_ok`, enforced by a `CHECK` constraint in the ingestion migration.
- The ingestion plan enables row-level security on all nine `pyq_` tables and gates `pyq_questions` reads at `auto_ok` / `human_ok` in the database. Both API routes read with `createAdminClient()` (service role), which bypasses RLS, so RLS is not an obstacle on the app path — and `filterPublishableRows` stays anyway, because the app must not depend on which client it happens to be holding.
- `NtaExamShell` and `NtaExamShellMobile` are shared with the live mock product. Changes must be **additive** (new props optional, defaulted) and must not regress the mock flow.
- Do **not** import or refactor `MockPageContent` (1,926 lines). Mirror the parts you need.
- Never fabricate MCQ options for a numerical question. `buildNumericMcq` (`Web/scripts/import-mock-paper-json.ts:565`) does this for the mock importer; Chapter PYQ must not.
- A PDF chapter mapped to a topic gets no chapter page and no route. Its questions render under the parent catalog chapter.
- `PHYSICS_NAMES` is syllabus-ordered, not alphabetical. Do not alphabetise it.
- **Test environment ceiling.** `Web/vitest.config.ts` sets `environment: "node"` and `include: ["lib/**/*.test.ts", "app/**/*.test.ts"]`. There is no jsdom and no React Testing Library. **No component can be tested by rendering.** Every decision worth a test must live in a pure module under `lib/chapter-pyq/`; components are verified by `npx tsc --noEmit` plus the stated manual check.
- Follow existing Vitest `describe`/`it` style under `lib/`.
- Shell is **PowerShell**. `&&` is not a valid separator — chain with `;` or run commands separately.
- Commit only when the user explicitly asks (repo rule). Skip commit steps until then.

## File map

| File | Responsibility |
|------|----------------|
| `lib/chapter-pyq/catalog.ts` | **Modify** — physics 28 → 29 (`Communication System`); drop `CHAPTER_PYQ_QUESTION_COUNT` |
| `lib/chapter-pyq/catalog.test.ts` | **Modify** — count assertions; drop the `CHAPTER_PYQ_QUESTION_COUNT` assertion |
| `lib/chapter-pyq/pdfChapterMap.ts` | The 32 PDF-chapter → catalog-slug rows, lookups both directions |
| `lib/chapter-pyq/pdfChapterMap.test.ts` | Coverage 1–32, slug existence, no orphan routes |
| `lib/chapter-pyq/pyqQuestionRow.ts` | DB row types, publishable statuses, PostgREST select string, pure row helpers |
| `lib/chapter-pyq/pyqQuestionRow.test.ts` | `filterPublishableRows`, `sortPyqRows`, `tallyPublishableCounts` |
| `lib/chapter-pyq/fixtures/lawsOfMotionSample.ts` | 12 hand-seeded rows + 4 figure rows — the only data Tasks 4–10 need |
| `lib/chapter-pyq/fixtures/lawsOfMotionSample.test.ts` | Locks the fixture's shape so later tasks can trust it |
| `lib/chapter-pyq/fetchPyqQuestionsServer.ts` | Service-role reads: rows for a catalog slug, publishable counts |
| `lib/chapter-pyq/fetchPyqQuestions.ts` | Client fetch wrappers over the two API routes |
| `lib/chapter-pyq/pyqQuestionMap.ts` | `PyqQuestionRow` → `ChapterPyqQuestion` (wraps `Question`) |
| `lib/chapter-pyq/pyqQuestionMap.test.ts` | MCQ, numerical, figures, labels, exam label |
| `lib/chapter-pyq/pyqFigures.ts` | `[[fig:KEY]]` → `<img>`, Storage public URL |
| `lib/chapter-pyq/pyqFigures.test.ts` | Placeholder substitution, unknown keys, unreferenced figures, URL build |
| `lib/chapter-pyq/pyqScoring.ts` | `isPyqAnswerCorrect` for both answer formats |
| `lib/chapter-pyq/pyqScoring.test.ts` | MCQ index match, numeric tolerance, unanswered |
| `lib/chapter-pyq/pyqSets.ts` | Balanced set splitting, per-set seconds |
| `lib/chapter-pyq/pyqSets.test.ts` | The spec's four worked examples + edges |
| `lib/chapter-pyq/pyqTiers.ts` | Tier order, labels, filter |
| `lib/chapter-pyq/pyqTiers.test.ts` | Labels and filtering |
| `lib/mock/mockRichTextKatex.ts` | **Modify** — recognise Supabase public Storage images in `patchMockHtmlImages` |
| `lib/mock/mockRichTextKatex.test.ts` | **Create** — locks testbee proxying *and* Storage pass-through |
| `types/index.ts` | **Modify** — two optional fields on `Question`: `answerFormat`, `numericAnswer` |
| `components/prep-mock/nta/ntaExamParts.tsx` | **Modify** — add `NtaNumericAnswerInput` |
| `components/prep-mock/nta/NtaExamShell.tsx` | **Modify** — 3 optional props; numeric block replaces options when numerical |
| `components/prep-mock/nta/NtaExamShellMobile.tsx` | **Modify** — same three props, mobile keypad |
| `components/chapter-pyq/ChapterPyqExamSession.tsx` | Orchestrator: sets, timer, answers, flags, visited, shell wiring, results |
| `components/chapter-pyq/ChapterPyqTierFilter.tsx` | Tier chips (pre-start) |
| `components/chapter-pyq/ChapterPyqPracticeView.tsx` | **Modify** — load, empty state, hand off to the session |
| `components/chapter-pyq/ChapterPyqListView.tsx` | **Modify** — live per-chapter counts |
| `app/api/chapter-pyq/questions/route.ts` | Cached mapped-question bundle for one catalog slug |
| `app/api/chapter-pyq/counts/route.ts` | Cached publishable counts per catalog slug |

### Names this plan uses (single source of truth)

Tasks may be implemented out of order. These identifiers are fixed:

| Identifier | Defined in | Shape |
|---|---|---|
| `PyqTier` | `pyqQuestionRow.ts` | `"concept_builder" \| "must_do" \| "advanced"` |
| `PyqQuestionRow` | `pyqQuestionRow.ts` | Task 3 |
| `PYQ_QUESTION_SELECT` | `pyqQuestionRow.ts` | PostgREST select string |
| `ChapterPyqQuestion` | `pyqQuestionMap.ts` | `{ question: Question; tier; pdfChapterName; topicName; qNo; sourcePage; examLabel }` |
| `ChapterPyqQuestionBundle` | `pyqQuestionMap.ts` | `{ catalogSlug; chapterName; questions: ChapterPyqQuestion[] }` |
| `Question.answerFormat` | `types/index.ts` | `"mcq" \| "numerical" \| undefined` (absent ⇒ MCQ) |
| `Question.numericAnswer` | `types/index.ts` | `string \| null \| undefined` |
| answers map | both shells | stays `Record<string, number>` — index for MCQ, **value** for numerical |

### The numerical decision (read before Task 5 or Task 6)

`Question.options: string[]` and `Question.correctAnswer: number` assume MCQ, and both shells store `answers: Record<string, number>`. Resolution, binding on Tasks 5, 6 and 7:

1. **Discriminator lives on the question, not the answer.** `Question` gains `answerFormat?: "mcq" | "numerical"`. Absent means MCQ, so every existing producer (`mapCatalogQuestionRowToQuestion`, `data/questions.ts`, the mock importer) is untouched and still type-checks.
2. **A numerical question has `options: []` and `correctAnswer: -1`.** No padding, no fabricated distractors. `-1` is chosen because it is an **out-of-range option index**: there is no zero-based index `-1` in a four-option question, so an MCQ-shaped comparison against a numerical scores it *wrong* in the common case. It is **not** an unreachable value and must not be relied on as one — `-1` is a perfectly plausible physics answer, and the `"-0.25"` example below shows negative answers really do occur, so a student can enter a value that equals the sentinel. The guarantee comes from `isPyqAnswerCorrect` branching on `answerFormat` **before** it ever reads `correctAnswer`; `-1` only narrows the blast radius if that branch is ever bypassed. Its expected value goes in `numericAnswer` as the **verbatim string** from `pyq_questions.numerical_answer` (e.g. `"12"`, `"-0.25"`).
3. **The answers map stays `Record<string, number>`.** For an MCQ the number is an option index; for `answerFormat === "numerical"` it is the entered numeric value. Nothing widens, so `answers[q.id] !== undefined` — the "answered" test used by `computeNtaLegendCounts` and both palettes — behaves identically. The shells' `selected === i` comparison only runs inside `q.options.map(...)`, which is empty for a numerical, so no phantom selection can render.
4. **Raw keystrokes never enter the answers map.** The shells receive `numericDrafts?: Record<string, string>` and `onNumericDraftChange?: (questionId, raw) => void`. The orchestrator keeps the draft text (so `"3."` or `"-"` mid-typing survives) and commits to `answers` only when the draft parses to a finite number, deleting the entry otherwise.
5. **Scoring branches on `answerFormat` first** in `isPyqAnswerCorrect` (Task 5's module, consumed by Task 7): exact index match for MCQ, `Math.abs(entered - expected) <= 0.01` for numerical. That branch, not the `-1` sentinel, is what keeps the two comparison paths apart.

---

### Task 1: Catalog — physics 28 → 29

**Files:**
- Modify: `lib/chapter-pyq/catalog.ts` (`PHYSICS_NAMES`, ends line 82)
- Modify: `lib/chapter-pyq/catalog.test.ts:81-85`

**Interfaces:**
- Consumes: `slugify` from `lib/slugs.ts` (already imported)
- Produces: `chaptersForSubject("physics")` has 29 entries, last is `{ name: "Communication System", slug: "communication-system" }`; `CHAPTER_PYQ_CHAPTERS` has `31 + 29 + 20 = 80` entries. Task 2's test asserts every mapped slug resolves through `findChapter("physics", slug)`.

- [ ] **Step 1: Update the failing assertions**

In `lib/chapter-pyq/catalog.test.ts`, replace the last `it` block (lines 81–85) with:

```ts
  it("has 29 physics and 20 chemistry chapters", () => {
    expect(chaptersForSubject("physics")).toHaveLength(29);
    expect(chaptersForSubject("chemistry")).toHaveLength(20);
    expect(CHAPTER_PYQ_CHAPTERS).toHaveLength(31 + 29 + 20);
  });

  it("keeps physics in syllabus order and ends with Communication System", () => {
    const physics = chaptersForSubject("physics");
    expect(physics[0]?.name).toBe("Units and Measurements");
    expect(physics[27]?.name).toBe("Semiconductor Electronics");
    expect(physics[28]).toEqual({
      subject: "physics",
      name: "Communication System",
      slug: "communication-system",
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/chapter-pyq/catalog.test.ts`

Expected: FAIL — `expected length 28 to be 29` and `expected undefined to equal { subject: 'physics', … }`.

- [ ] **Step 3: Append the chapter**

In `lib/chapter-pyq/catalog.ts`, `PHYSICS_NAMES`, after `"Semiconductor Electronics",` and before the closing `] as const;`:

```ts
  "Communication System",
```

Nothing else changes. Do **not** reorder the array — it is NCERT syllabus order and also the PDF's own chapter order. The slug is derived by `slugify`, so there is no manual slug entry.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/chapter-pyq/catalog.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/catalog.ts lib/chapter-pyq/catalog.test.ts
git commit -m "Add Communication System to the Chapter PYQ physics catalog."
```

---

### Task 2: PDF-chapter → catalog-chapter mapping

**Files:**
- Create: `lib/chapter-pyq/pdfChapterMap.ts`
- Test: `lib/chapter-pyq/pdfChapterMap.test.ts`

**Interfaces:**
- Consumes: `findChapter`, `chaptersForSubject` from Task 1's `lib/chapter-pyq/catalog.ts`
- Produces:
  - `export type PdfChapterMapping = { pdfChapterNo: number; pdfChapterTitle: string; catalogSlug: string | null; note: string }`
  - `export const PYQ_PHYSICS_PDF_CHAPTERS: readonly PdfChapterMapping[]` — exactly 32 rows, ordered by `pdfChapterNo`
  - `export function catalogSlugForPdfChapter(pdfChapterNo: number): string | null`
  - `export function pdfChaptersForCatalogSlug(catalogSlug: string): PdfChapterMapping[]`
  - `export const PYQ_DEFERRED_PDF_CHAPTERS: readonly number[]` — `[17]`
  - `export function isPyqSourcedCatalogSlug(catalogSlug: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `lib/chapter-pyq/pdfChapterMap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chaptersForSubject, findChapter } from "./catalog";
import {
  PYQ_DEFERRED_PDF_CHAPTERS,
  PYQ_PHYSICS_PDF_CHAPTERS,
  catalogSlugForPdfChapter,
  isPyqSourcedCatalogSlug,
  pdfChaptersForCatalogSlug,
} from "./pdfChapterMap";

describe("physics PDF chapter map", () => {
  it("accounts for every PDF chapter 1 through 32 exactly once", () => {
    const numbers = PYQ_PHYSICS_PDF_CHAPTERS.map((row) => row.pdfChapterNo);
    expect(numbers).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(new Set(numbers).size).toBe(32);
  });

  it("points every mapped slug at a real physics catalog chapter", () => {
    for (const row of PYQ_PHYSICS_PDF_CHAPTERS) {
      if (row.catalogSlug === null) continue;
      expect(findChapter("physics", row.catalogSlug), `chapter ${row.pdfChapterNo}`).not.toBeNull();
    }
  });

  it("defers only PDF chapter 17 (Electrostatics)", () => {
    const unmapped = PYQ_PHYSICS_PDF_CHAPTERS.filter((row) => row.catalogSlug === null);
    expect(unmapped.map((row) => row.pdfChapterNo)).toEqual([17]);
    expect(unmapped[0]?.pdfChapterTitle).toBe("Electrostatics");
    expect(PYQ_DEFERRED_PDF_CHAPTERS).toEqual([17]);
    expect(catalogSlugForPdfChapter(17)).toBeNull();
  });

  it("merges chapters 1, 2 and 32 into units-and-measurements", () => {
    expect(catalogSlugForPdfChapter(1)).toBe("units-and-measurements");
    expect(catalogSlugForPdfChapter(2)).toBe("units-and-measurements");
    expect(catalogSlugForPdfChapter(32)).toBe("units-and-measurements");
    expect(pdfChaptersForCatalogSlug("units-and-measurements").map((r) => r.pdfChapterNo)).toEqual([
      1, 2, 32,
    ]);
  });

  it("merges chapters 7 and 8 into system-of-particles-and-rotational-motion", () => {
    expect(
      pdfChaptersForCatalogSlug("system-of-particles-and-rotational-motion").map(
        (r) => r.pdfChapterNo
      )
    ).toEqual([7, 8]);
  });

  it("routes chapter 18 (Capacitance) to electrostatic-potential-and-capacitance", () => {
    expect(catalogSlugForPdfChapter(18)).toBe("electrostatic-potential-and-capacitance");
    expect(
      pdfChaptersForCatalogSlug("electrostatic-potential-and-capacitance").map(
        (r) => r.pdfChapterNo
      )
    ).toEqual([18]);
  });

  it("maps the pilot chapter 1:1", () => {
    expect(catalogSlugForPdfChapter(5)).toBe("laws-of-motion");
    expect(pdfChaptersForCatalogSlug("laws-of-motion").map((r) => r.pdfChapterNo)).toEqual([5]);
  });

  it("adds no route for a PDF chapter that became a topic", () => {
    const mergedAway = [
      "mathematics-in-physics",
      "units-and-dimensions",
      "center-of-mass-momentum-and-collision",
      "rotational-motion",
      "capacitance",
      "experimental-physics",
      "electrostatics",
    ];
    for (const slug of mergedAway) {
      expect(findChapter("physics", slug), slug).toBeNull();
      expect(pdfChaptersForCatalogSlug(slug), slug).toEqual([]);
    }
  });

  it("leaves electric-charges-and-fields with no PYQ source", () => {
    expect(pdfChaptersForCatalogSlug("electric-charges-and-fields")).toEqual([]);
    expect(isPyqSourcedCatalogSlug("electric-charges-and-fields")).toBe(false);
    expect(isPyqSourcedCatalogSlug("laws-of-motion")).toBe(true);
  });

  it("covers 28 of the 29 physics catalog chapters", () => {
    const sourced = chaptersForSubject("physics").filter((c) => isPyqSourcedCatalogSlug(c.slug));
    expect(sourced).toHaveLength(28);
    expect(new Set(PYQ_PHYSICS_PDF_CHAPTERS.map((r) => r.catalogSlug)).size).toBe(29);
  });

  it("returns null for an out-of-range PDF chapter number", () => {
    expect(catalogSlugForPdfChapter(0)).toBeNull();
    expect(catalogSlugForPdfChapter(33)).toBeNull();
  });
});
```

The last assertion is deliberately arithmetic: 32 PDF chapters collapse onto 28 distinct slugs plus `null`, so the `Set` over `catalogSlug` has 29 members (28 slugs + `null`), and 28 of the catalog's 29 physics chapters have a source — the missing one is `electric-charges-and-fields`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/chapter-pyq/pdfChapterMap.test.ts`

Expected: FAIL — `Cannot find module './pdfChapterMap'`.

- [ ] **Step 3: Write the mapping module**

Create `lib/chapter-pyq/pdfChapterMap.ts`. All 32 rows verbatim from the spec table:

```ts
/**
 * MathonGo JEE Main Physics PYQ book (32 chapters) → app catalog chapters.
 *
 * `catalogSlug` is deliberately many-to-one: several PDF chapters collapse onto
 * one catalog chapter and render on its single page. `null` means deferred —
 * no route, no page, no questions (PDF chapter 17 straddles two catalog chapters).
 */
export type PdfChapterMapping = {
  pdfChapterNo: number;
  pdfChapterTitle: string;
  catalogSlug: string | null;
  note: string;
};

export const PYQ_PHYSICS_PDF_CHAPTERS: readonly PdfChapterMapping[] = [
  { pdfChapterNo: 1, pdfChapterTitle: "Mathematics in Physics", catalogSlug: "units-and-measurements", note: "Becomes a topic" },
  { pdfChapterNo: 2, pdfChapterTitle: "Units and Dimensions", catalogSlug: "units-and-measurements", note: "Rename" },
  { pdfChapterNo: 3, pdfChapterTitle: "Motion In One Dimension", catalogSlug: "motion-in-a-straight-line", note: "Rename" },
  { pdfChapterNo: 4, pdfChapterTitle: "Motion In Two Dimensions", catalogSlug: "motion-in-a-plane", note: "Rename" },
  { pdfChapterNo: 5, pdfChapterTitle: "Laws of Motion", catalogSlug: "laws-of-motion", note: "1:1 — pilot chapter" },
  { pdfChapterNo: 6, pdfChapterTitle: "Work Power Energy", catalogSlug: "work-energy-and-power", note: "Rename" },
  { pdfChapterNo: 7, pdfChapterTitle: "Center of Mass Momentum and Collision", catalogSlug: "system-of-particles-and-rotational-motion", note: "Becomes a topic" },
  { pdfChapterNo: 8, pdfChapterTitle: "Rotational Motion", catalogSlug: "system-of-particles-and-rotational-motion", note: "Becomes a topic" },
  { pdfChapterNo: 9, pdfChapterTitle: "Gravitation", catalogSlug: "gravitation", note: "1:1" },
  { pdfChapterNo: 10, pdfChapterTitle: "Mechanical Properties of Solids", catalogSlug: "mechanical-properties-of-solids", note: "1:1" },
  { pdfChapterNo: 11, pdfChapterTitle: "Mechanical Properties of Fluids", catalogSlug: "mechanical-properties-of-fluids", note: "1:1" },
  { pdfChapterNo: 12, pdfChapterTitle: "Oscillations", catalogSlug: "oscillations", note: "1:1" },
  { pdfChapterNo: 13, pdfChapterTitle: "Waves and Sound", catalogSlug: "waves", note: "Rename" },
  { pdfChapterNo: 14, pdfChapterTitle: "Thermal Properties of Matter", catalogSlug: "thermal-properties-of-matter", note: "1:1" },
  { pdfChapterNo: 15, pdfChapterTitle: "Thermodynamics", catalogSlug: "thermodynamics", note: "1:1" },
  { pdfChapterNo: 16, pdfChapterTitle: "Kinetic Theory of Gases", catalogSlug: "kinetic-theory-of-gases", note: "1:1" },
  { pdfChapterNo: 17, pdfChapterTitle: "Electrostatics", catalogSlug: null, note: "Deferred — straddles Electric Charges and Fields + Electrostatic Potential and Capacitance" },
  { pdfChapterNo: 18, pdfChapterTitle: "Capacitance", catalogSlug: "electrostatic-potential-and-capacitance", note: "Becomes a topic" },
  { pdfChapterNo: 19, pdfChapterTitle: "Current Electricity", catalogSlug: "current-electricity", note: "1:1" },
  { pdfChapterNo: 20, pdfChapterTitle: "Magnetic Properties of Matter", catalogSlug: "magnetism-and-matter", note: "Rename" },
  { pdfChapterNo: 21, pdfChapterTitle: "Magnetic Effects of Current", catalogSlug: "moving-charges-and-magnetism", note: "Rename" },
  { pdfChapterNo: 22, pdfChapterTitle: "Electromagnetic Induction", catalogSlug: "electromagnetic-induction", note: "1:1" },
  { pdfChapterNo: 23, pdfChapterTitle: "Alternating Current", catalogSlug: "alternating-current", note: "1:1" },
  { pdfChapterNo: 24, pdfChapterTitle: "Ray Optics", catalogSlug: "ray-optics", note: "1:1" },
  { pdfChapterNo: 25, pdfChapterTitle: "Wave Optics", catalogSlug: "wave-optics", note: "1:1" },
  { pdfChapterNo: 26, pdfChapterTitle: "Dual Nature of Matter", catalogSlug: "dual-nature-of-radiation-and-matter", note: "Rename" },
  { pdfChapterNo: 27, pdfChapterTitle: "Atomic Physics", catalogSlug: "atoms", note: "Rename" },
  { pdfChapterNo: 28, pdfChapterTitle: "Nuclear Physics", catalogSlug: "nuclei", note: "Rename" },
  { pdfChapterNo: 29, pdfChapterTitle: "Electromagnetic Waves", catalogSlug: "electromagnetic-waves", note: "1:1" },
  { pdfChapterNo: 30, pdfChapterTitle: "Semiconductors", catalogSlug: "semiconductor-electronics", note: "Rename" },
  { pdfChapterNo: 31, pdfChapterTitle: "Communication System", catalogSlug: "communication-system", note: "New catalog chapter" },
  { pdfChapterNo: 32, pdfChapterTitle: "Experimental Physics", catalogSlug: "units-and-measurements", note: "Becomes a topic" },
];

export const PYQ_DEFERRED_PDF_CHAPTERS: readonly number[] = PYQ_PHYSICS_PDF_CHAPTERS.filter(
  (row) => row.catalogSlug === null
).map((row) => row.pdfChapterNo);

export function catalogSlugForPdfChapter(pdfChapterNo: number): string | null {
  return (
    PYQ_PHYSICS_PDF_CHAPTERS.find((row) => row.pdfChapterNo === pdfChapterNo)?.catalogSlug ?? null
  );
}

/** Every PDF chapter whose questions render on this catalog chapter's page, in PDF order. */
export function pdfChaptersForCatalogSlug(catalogSlug: string): PdfChapterMapping[] {
  return PYQ_PHYSICS_PDF_CHAPTERS.filter((row) => row.catalogSlug === catalogSlug);
}

export function isPyqSourcedCatalogSlug(catalogSlug: string): boolean {
  return pdfChaptersForCatalogSlug(catalogSlug).length > 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/chapter-pyq/pdfChapterMap.test.ts`

Expected: PASS — 11 tests.

- [ ] **Step 5: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/pdfChapterMap.ts lib/chapter-pyq/pdfChapterMap.test.ts
git commit -m "Map the 32 physics PYQ PDF chapters onto catalog chapters."
```

---

### Task 3: Row types and the hand-seeded fixture

This task is what unblocks the rest of the plan from the ingestion pipeline. Everything Tasks 4–10 need is defined here.

**Files:**
- Create: `lib/chapter-pyq/pyqQuestionRow.ts`
- Create: `lib/chapter-pyq/fixtures/lawsOfMotionSample.ts`
- Test: `lib/chapter-pyq/pyqQuestionRow.test.ts`
- Test: `lib/chapter-pyq/fixtures/lawsOfMotionSample.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module)
- Produces:
  - `export type PyqTier = "concept_builder" | "must_do" | "advanced"`
  - `export type PyqFormat = "mcq" | "numerical" | "match_list" | "assertion_reason" | "statement"`
  - `export const PYQ_PUBLISHABLE_STATUSES: readonly ["auto_ok", "human_ok"]`
  - `export type PyqFigureRow`, `PyqFigureLinkRow`, `PyqOptionRow`, `PyqChapterRow`, `PyqQuestionRow`
  - `export const PYQ_QUESTION_SELECT: string`
  - `export function filterPublishableRows(rows: PyqQuestionRow[]): PyqQuestionRow[]`
  - `export function sortPyqRows(rows: PyqQuestionRow[]): PyqQuestionRow[]`
  - `export function tallyPublishableCounts(rows: PyqCountRow[]): Record<string, number>` where `PyqCountRow = { review_status: string; chapters: { catalog_slug: string | null } | null }`
  - Fixture: `LAWS_OF_MOTION_SAMPLE_ROWS: PyqQuestionRow[]` (12 rows), `PYQ_SAMPLE_FIGURES: PyqFigureRow[]` (4 rows)

The fixture is deliberately representative: MCQ **and** numerical, with **and** without figures, all three tiers, two hidden review statuses, and **two catalog chapters** — one 1:1 (`laws-of-motion`, PDF chapter 5) and one merged (`units-and-measurements`, PDF chapters 2 and 32) so the merge rule is genuinely exercised rather than assumed.

- [ ] **Step 1: Write the row types and pure helpers**

Create `lib/chapter-pyq/pyqQuestionRow.ts`:

```ts
/**
 * Row shapes for the JEE PYQ question bank — the `pyq_`-prefixed tables the
 * sibling ingestion plan's migration creates. Table names appear exactly once,
 * in `PYQ_QUESTION_SELECT`, where each embed is aliased back to its unprefixed
 * key so these row types describe the returned JSON as-is.
 */
export type PyqTier = "concept_builder" | "must_do" | "advanced";

export type PyqFormat = "mcq" | "numerical" | "match_list" | "assertion_reason" | "statement";

export type PyqExamShift = "morning" | "evening";

export type PyqFigureRole = "question_body" | "option" | "match_list_item";

/** Students only ever see these. Counts use the same list. */
export const PYQ_PUBLISHABLE_STATUSES = ["auto_ok", "human_ok"] as const;

export type PyqFigureRow = {
  figure_key: string;
  /** e.g. `pyq/physics/figures/p047_x101.png` — includes the bucket as its first segment. */
  storage_path: string;
  public_url: string | null;
  alt_text: string | null;
};

export type PyqFigureLinkRow = {
  role: PyqFigureRole;
  sort_order: number | null;
  figures: PyqFigureRow | null;
};

export type PyqOptionRow = { option_index: number; body: string | null };

export type PyqChapterRow = { chapter_no: number; name: string; catalog_slug: string | null };

export type PyqQuestionRow = {
  id: string;
  q_no: number;
  tier: PyqTier;
  format: PyqFormat;
  body: string | null;
  correct_option: number | null;
  numerical_answer: string | null;
  exam_date: string | null;
  exam_shift: PyqExamShift | null;
  source_page: number;
  review_status: string;
  out_of_syllabus: boolean;
  good_to_solve: boolean;
  chapters: PyqChapterRow | null;
  topics: { name: string } | null;
  question_options: PyqOptionRow[];
  figure_links: PyqFigureLinkRow[];
};

export const PYQ_QUESTION_SELECT = [
  "id",
  "q_no",
  "tier",
  "format",
  "body",
  "correct_option",
  "numerical_answer",
  "exam_date",
  "exam_shift",
  "source_page",
  "review_status",
  "out_of_syllabus",
  "good_to_solve",
  // Each embed is aliased to its unprefixed name, so the JSON keys stay
  // `chapters` / `topics` / `question_options` / `figure_links` / `figures`.
  // Embedded filters use the alias too, hence `.eq("chapters.catalog_slug", …)`.
  "chapters:pyq_chapters!inner(chapter_no, name, catalog_slug)",
  "topics:pyq_topics(name)",
  "question_options:pyq_question_options(option_index, body)",
  "figure_links:pyq_figure_links(role, sort_order, figures:pyq_figures(figure_key, storage_path, public_url, alt_text))",
].join(", ");

/** Defence in depth: the DB query already filters, this guarantees it. */
export function filterPublishableRows(rows: PyqQuestionRow[]): PyqQuestionRow[] {
  const allowed = new Set<string>(PYQ_PUBLISHABLE_STATUSES);
  return rows.filter((row) => allowed.has(row.review_status));
}

/** Merged pages group by PDF chapter first, then by the book's own question number. */
export function sortPyqRows(rows: PyqQuestionRow[]): PyqQuestionRow[] {
  return [...rows].sort((a, b) => {
    const ca = a.chapters?.chapter_no ?? Number.MAX_SAFE_INTEGER;
    const cb = b.chapters?.chapter_no ?? Number.MAX_SAFE_INTEGER;
    if (ca !== cb) return ca - cb;
    return a.q_no - b.q_no;
  });
}

export type PyqCountRow = {
  review_status: string;
  chapters: { catalog_slug: string | null } | null;
};

/** Publishable questions per catalog slug. Rows with no slug (deferred) are dropped. */
export function tallyPublishableCounts(rows: PyqCountRow[]): Record<string, number> {
  const allowed = new Set<string>(PYQ_PUBLISHABLE_STATUSES);
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (!allowed.has(row.review_status)) continue;
    const slug = row.chapters?.catalog_slug;
    if (!slug) continue;
    out[slug] = (out[slug] ?? 0) + 1;
  }
  return out;
}
```

- [ ] **Step 2: Write the fixture**

Create `lib/chapter-pyq/fixtures/lawsOfMotionSample.ts`:

```ts
import type { PyqFigureRow, PyqQuestionRow } from "@/lib/chapter-pyq/pyqQuestionRow";

/**
 * Hand-seeded sample standing in for the ingestion pipeline's output, so the app
 * can be built and tested before Phases 4–9 run. Representative by design:
 * MCQ + numerical, with + without figures, all three tiers, two hidden review
 * statuses, and two PDF chapters (2, 32) merged onto one catalog chapter.
 */
export const PYQ_SAMPLE_FIGURES: PyqFigureRow[] = [
  {
    figure_key: "p047_x101",
    storage_path: "pyq/physics/figures/p047_x101.png",
    public_url: null,
    alt_text: "Block on a rough inclined plane with the normal and friction arrows drawn",
  },
  {
    figure_key: "p052_x318",
    storage_path: "pyq/physics/figures/p052_x318.png",
    public_url: null,
    alt_text: "Two blocks connected over a frictionless pulley",
  },
  {
    figure_key: "p058_x902",
    storage_path: "pyq/physics/figures/p058_x902.png",
    public_url:
      "https://kmnqvqoyjjbovtaqozfc.supabase.co/storage/v1/object/public/pyq/physics/figures/p058_x902.png",
    alt_text: "Free body diagram of a lift accelerating upward",
  },
  {
    figure_key: "p440_x77",
    storage_path: "pyq/physics/figures/p440_x77.png",
    public_url: null,
    alt_text: "Vernier callipers scale reading",
  },
];

const LAWS_OF_MOTION = { chapter_no: 5, name: "Laws of Motion", catalog_slug: "laws-of-motion" };
const UNITS_AND_DIMENSIONS = {
  chapter_no: 2,
  name: "Units and Dimensions",
  catalog_slug: "units-and-measurements",
};
const EXPERIMENTAL_PHYSICS = {
  chapter_no: 32,
  name: "Experimental Physics",
  catalog_slug: "units-and-measurements",
};

function figureLink(figure_key: string): PyqQuestionRow["figure_links"] {
  const figure = PYQ_SAMPLE_FIGURES.find((f) => f.figure_key === figure_key) ?? null;
  return [{ role: "question_body", sort_order: 0, figures: figure }];
}

function mcqOptions(bodies: [string, string, string, string]): PyqQuestionRow["question_options"] {
  return bodies.map((body, i) => ({ option_index: i + 1, body }));
}

export const LAWS_OF_MOTION_SAMPLE_ROWS: PyqQuestionRow[] = [
  {
    id: "11111111-1111-4111-8111-000000000001",
    q_no: 1,
    tier: "must_do",
    format: "mcq",
    body: "A force of $10\\,\\text{N}$ acts on a body of mass $2\\,\\text{kg}$. Its acceleration is",
    correct_option: 2,
    numerical_answer: null,
    exam_date: "2024-01-30",
    exam_shift: "evening",
    source_page: 47,
    review_status: "auto_ok",
    out_of_syllabus: false,
    good_to_solve: true,
    chapters: LAWS_OF_MOTION,
    topics: { name: "Newton's Laws of Motion" },
    question_options: mcqOptions([
      "$2.5\\,\\text{m/s}^2$",
      "$5\\,\\text{m/s}^2$",
      "$10\\,\\text{m/s}^2$",
      "$20\\,\\text{m/s}^2$",
    ]),
    figure_links: [],
  },
  {
    id: "11111111-1111-4111-8111-000000000002",
    q_no: 2,
    tier: "must_do",
    format: "mcq",
    body: "For the block shown, the friction force is [[fig:p047_x101]]",
    correct_option: 4,
    numerical_answer: null,
    exam_date: "2023-04-06",
    exam_shift: "morning",
    source_page: 47,
    review_status: "human_ok",
    out_of_syllabus: false,
    good_to_solve: false,
    chapters: LAWS_OF_MOTION,
    topics: { name: "Friction" },
    question_options: mcqOptions([
      "$mg\\sin\\theta$",
      "$\\mu mg$",
      "zero",
      "$\\mu mg\\cos\\theta$",
    ]),
    figure_links: figureLink("p047_x101"),
  },
  {
    id: "11111111-1111-4111-8111-000000000003",
    q_no: 3,
    tier: "must_do",
    format: "numerical",
    body: "A $3\\,\\text{kg}$ block is pushed with $36\\,\\text{N}$. Find its acceleration in $\\text{m/s}^2$.",
    correct_option: null,
    numerical_answer: "12",
    exam_date: "2022-06-24",
    exam_shift: "evening",
    source_page: 49,
    review_status: "auto_ok",
    out_of_syllabus: false,
    good_to_solve: false,
    chapters: LAWS_OF_MOTION,
    topics: { name: "Newton's Laws of Motion" },
    question_options: [],
    figure_links: [],
  },
  {
    id: "11111111-1111-4111-8111-000000000004",
    q_no: 4,
    tier: "advanced",
    format: "numerical",
    body: "For the pulley system shown, find the coefficient of friction. [[fig:p052_x318]]",
    correct_option: null,
    numerical_answer: "-0.25",
    exam_date: null,
    exam_shift: null,
    source_page: 52,
    review_status: "human_ok",
    out_of_syllabus: false,
    good_to_solve: true,
    chapters: LAWS_OF_MOTION,
    topics: { name: "Friction" },
    question_options: [],
    figure_links: figureLink("p052_x318"),
  },
  {
    id: "11111111-1111-4111-8111-000000000005",
    q_no: 5,
    tier: "concept_builder",
    format: "mcq",
    body: "Newton's third law implies that action and reaction",
    correct_option: 1,
    numerical_answer: null,
    exam_date: "2021-08-27",
    exam_shift: "morning",
    source_page: 50,
    review_status: "auto_ok",
    out_of_syllabus: false,
    good_to_solve: false,
    chapters: LAWS_OF_MOTION,
    topics: null,
    question_options: mcqOptions([
      "act on different bodies",
      "act on the same body",
      "cancel out",
      "are unequal",
    ]),
    figure_links: [],
  },
  {
    id: "11111111-1111-4111-8111-000000000006",
    q_no: 6,
    tier: "advanced",
    format: "mcq",
    body: "A lift accelerates upward at $2\\,\\text{m/s}^2$. The apparent weight is [[fig:p058_x902]]",
    correct_option: 3,
    numerical_answer: null,
    exam_date: "2025-01-22",
    exam_shift: "evening",
    source_page: 58,
    review_status: "auto_ok",
    out_of_syllabus: false,
    good_to_solve: false,
    chapters: LAWS_OF_MOTION,
    topics: { name: "Pseudo Forces" },
    question_options: mcqOptions(["$mg$", "$0.8mg$", "$1.2mg$", "$2mg$"]),
    figure_links: figureLink("p058_x902"),
  },
  {
    id: "11111111-1111-4111-8111-000000000007",
    q_no: 7,
    tier: "concept_builder",
    format: "mcq",
    body: "Inertia of a body depends on",
    correct_option: 2,
    numerical_answer: null,
    exam_date: "2020-09-03",
    exam_shift: "morning",
    source_page: 51,
    review_status: "unreviewed",
    out_of_syllabus: false,
    good_to_solve: false,
    chapters: LAWS_OF_MOTION,
    topics: null,
    question_options: mcqOptions(["velocity", "mass", "force", "acceleration"]),
    figure_links: [],
  },
  {
    id: "11111111-1111-4111-8111-000000000008",
    q_no: 8,
    tier: "must_do",
    format: "mcq",
    body: null,
    correct_option: null,
    numerical_answer: null,
    exam_date: null,
    exam_shift: null,
    source_page: 53,
    review_status: "skeleton_only",
    out_of_syllabus: false,
    good_to_solve: false,
    chapters: LAWS_OF_MOTION,
    topics: null,
    question_options: [],
    figure_links: [],
  },
  {
    id: "22222222-2222-4222-8222-000000000009",
    q_no: 1,
    tier: "must_do",
    format: "mcq",
    body: "The dimensional formula of pressure is",
    correct_option: 1,
    numerical_answer: null,
    exam_date: "2024-04-04",
    exam_shift: "morning",
    source_page: 12,
    review_status: "auto_ok",
    out_of_syllabus: false,
    good_to_solve: false,
    chapters: UNITS_AND_DIMENSIONS,
    topics: { name: "Dimensional Analysis" },
    question_options: mcqOptions([
      "$[ML^{-1}T^{-2}]$",
      "$[MLT^{-2}]$",
      "$[ML^{2}T^{-2}]$",
      "$[ML^{-2}T^{-1}]$",
    ]),
    figure_links: [],
  },
  {
    id: "22222222-2222-4222-8222-000000000010",
    q_no: 2,
    tier: "concept_builder",
    format: "numerical",
    body: "How many significant figures are in $0.00340$?",
    correct_option: null,
    numerical_answer: "3",
    exam_date: "2023-01-25",
    exam_shift: "evening",
    source_page: 13,
    review_status: "human_ok",
    out_of_syllabus: false,
    good_to_solve: false,
    chapters: UNITS_AND_DIMENSIONS,
    topics: { name: "Significant Figures" },
    question_options: [],
    figure_links: [],
  },
  {
    id: "33333333-3333-4333-8333-000000000011",
    q_no: 1,
    tier: "advanced",
    format: "mcq",
    body: "Read the vernier callipers shown. [[fig:p440_x77]]",
    correct_option: 4,
    numerical_answer: null,
    exam_date: "2022-07-28",
    exam_shift: "morning",
    source_page: 440,
    review_status: "auto_ok",
    out_of_syllabus: false,
    good_to_solve: false,
    chapters: EXPERIMENTAL_PHYSICS,
    topics: { name: "Vernier Callipers" },
    question_options: mcqOptions([
      "$1.02\\,\\text{cm}$",
      "$1.12\\,\\text{cm}$",
      "$1.20\\,\\text{cm}$",
      "$1.24\\,\\text{cm}$",
    ]),
    figure_links: figureLink("p440_x77"),
  },
  {
    id: "33333333-3333-4333-8333-000000000012",
    q_no: 2,
    tier: "must_do",
    format: "mcq",
    body: "The least count of a screw gauge is",
    correct_option: 2,
    numerical_answer: null,
    exam_date: "2021-02-25",
    exam_shift: "evening",
    source_page: 441,
    review_status: "flagged",
    out_of_syllabus: false,
    good_to_solve: false,
    chapters: EXPERIMENTAL_PHYSICS,
    topics: { name: "Screw Gauge" },
    question_options: mcqOptions([
      "pitch × divisions",
      "pitch ÷ divisions",
      "divisions ÷ pitch",
      "pitch + divisions",
    ]),
    figure_links: [],
  },
];
```

- [ ] **Step 3: Write the tests**

Create `lib/chapter-pyq/pyqQuestionRow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PYQ_PUBLISHABLE_STATUSES,
  PYQ_QUESTION_SELECT,
  filterPublishableRows,
  sortPyqRows,
  tallyPublishableCounts,
} from "./pyqQuestionRow";
import { LAWS_OF_MOTION_SAMPLE_ROWS } from "./fixtures/lawsOfMotionSample";

describe("pyq question rows", () => {
  it("publishes only auto_ok and human_ok", () => {
    expect([...PYQ_PUBLISHABLE_STATUSES]).toEqual(["auto_ok", "human_ok"]);
    const kept = filterPublishableRows(LAWS_OF_MOTION_SAMPLE_ROWS);
    expect(kept).toHaveLength(9);
    for (const row of kept) {
      expect(["auto_ok", "human_ok"]).toContain(row.review_status);
    }
  });

  it("drops unreviewed, skeleton_only and flagged rows", () => {
    const keptIds = new Set(filterPublishableRows(LAWS_OF_MOTION_SAMPLE_ROWS).map((r) => r.id));
    const hidden = LAWS_OF_MOTION_SAMPLE_ROWS.filter((r) => !keptIds.has(r.id)).map(
      (r) => r.review_status
    );
    expect(hidden.sort()).toEqual(["flagged", "skeleton_only", "unreviewed"]);
  });

  it("sorts by PDF chapter number then question number", () => {
    const merged = filterPublishableRows(LAWS_OF_MOTION_SAMPLE_ROWS).filter(
      (row) => row.chapters?.catalog_slug === "units-and-measurements"
    );
    const sorted = sortPyqRows([...merged].reverse());
    expect(sorted.map((row) => [row.chapters?.chapter_no, row.q_no])).toEqual([
      [2, 1],
      [2, 2],
      [32, 1],
    ]);
  });

  it("tallies publishable counts per catalog slug", () => {
    expect(tallyPublishableCounts(LAWS_OF_MOTION_SAMPLE_ROWS)).toEqual({
      "laws-of-motion": 6,
      "units-and-measurements": 3,
    });
  });

  it("ignores rows with no catalog slug when tallying", () => {
    expect(
      tallyPublishableCounts([
        { review_status: "auto_ok", chapters: { catalog_slug: null } },
        { review_status: "auto_ok", chapters: null },
        { review_status: "auto_ok", chapters: { catalog_slug: "gravitation" } },
      ])
    ).toEqual({ gravitation: 1 });
  });

  it("selects the columns and embeds the mapper needs, from the pyq_ tables", () => {
    for (const fragment of [
      "numerical_answer",
      "correct_option",
      "review_status",
      "chapters:pyq_chapters!inner(chapter_no, name, catalog_slug)",
      "topics:pyq_topics(name)",
      "question_options:pyq_question_options(option_index, body)",
      "figure_links:pyq_figure_links(role, sort_order, figures:pyq_figures(figure_key, storage_path, public_url, alt_text))",
    ]) {
      expect(PYQ_QUESTION_SELECT).toContain(fragment);
    }
  });

  it("aliases every embed so the JSON keys stay unprefixed", () => {
    // The row types and every reader below use `row.chapters`, not
    // `row.pyq_chapters`. Drop an alias and all of them break silently.
    for (const key of ["chapters:", "topics:", "question_options:", "figure_links:", "figures:"]) {
      expect(PYQ_QUESTION_SELECT).toContain(key);
    }
  });
});
```

Create `lib/chapter-pyq/fixtures/lawsOfMotionSample.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterPublishableRows } from "../pyqQuestionRow";
import { LAWS_OF_MOTION_SAMPLE_ROWS, PYQ_SAMPLE_FIGURES } from "./lawsOfMotionSample";

const publishable = filterPublishableRows(LAWS_OF_MOTION_SAMPLE_ROWS);
const lom = publishable.filter((r) => r.chapters?.catalog_slug === "laws-of-motion");
const uam = publishable.filter((r) => r.chapters?.catalog_slug === "units-and-measurements");

describe("laws of motion sample fixture", () => {
  it("has 12 rows whose ids are unique by their last 12 characters", () => {
    expect(LAWS_OF_MOTION_SAMPLE_ROWS).toHaveLength(12);
    const ids = LAWS_OF_MOTION_SAMPLE_ROWS.map((r) => r.id);
    expect(new Set(ids).size).toBe(12);
    // `pyqQuestionMap.test.ts` looks rows up by id suffix, so suffixes must not collide.
    expect(new Set(ids.map((id) => id.slice(-12))).size).toBe(12);
  });

  it("covers both formats in the pilot chapter", () => {
    expect(lom.filter((r) => r.format === "mcq")).toHaveLength(4);
    expect(lom.filter((r) => r.format === "numerical")).toHaveLength(2);
  });

  it("gives every numerical an answer and no options", () => {
    for (const row of publishable.filter((r) => r.format === "numerical")) {
      expect(row.numerical_answer, row.id).toBeTruthy();
      expect(row.correct_option, row.id).toBeNull();
      expect(row.question_options, row.id).toEqual([]);
    }
  });

  it("gives every publishable MCQ four options and a 1-based correct option", () => {
    for (const row of publishable.filter((r) => r.format === "mcq")) {
      expect(row.question_options, row.id).toHaveLength(4);
      expect(row.correct_option, row.id).toBeGreaterThanOrEqual(1);
      expect(row.correct_option, row.id).toBeLessThanOrEqual(4);
      expect(row.numerical_answer, row.id).toBeNull();
    }
  });

  it("covers all three tiers in the pilot chapter", () => {
    expect(lom.filter((r) => r.tier === "must_do")).toHaveLength(3);
    expect(lom.filter((r) => r.tier === "concept_builder")).toHaveLength(1);
    expect(lom.filter((r) => r.tier === "advanced")).toHaveLength(2);
  });

  it("covers questions with and without figures", () => {
    expect(lom.filter((r) => r.figure_links.length > 0)).toHaveLength(3);
    expect(lom.filter((r) => r.figure_links.length === 0)).toHaveLength(3);
  });

  it("exercises the merge rule with two PDF chapters on one catalog chapter", () => {
    expect(new Set(uam.map((r) => r.chapters?.chapter_no))).toEqual(new Set([2, 32]));
    expect(new Set(uam.map((r) => r.chapters?.name))).toEqual(
      new Set(["Units and Dimensions", "Experimental Physics"])
    );
  });

  it("includes a row with no topic and a row with no exam date", () => {
    expect(publishable.some((r) => r.topics === null)).toBe(true);
    expect(publishable.some((r) => r.exam_date === null)).toBe(true);
  });

  it("resolves every figure placeholder to a known figure", () => {
    const keys = new Set(PYQ_SAMPLE_FIGURES.map((f) => f.figure_key));
    for (const row of LAWS_OF_MOTION_SAMPLE_ROWS) {
      for (const [, key] of (row.body ?? "").matchAll(/\[\[fig:([a-zA-Z0-9_]+)\]\]/g)) {
        expect(keys.has(key), key).toBe(true);
      }
    }
  });

  it("covers both a derived and a stored figure public_url", () => {
    expect(PYQ_SAMPLE_FIGURES.some((f) => f.public_url === null)).toBe(true);
    expect(PYQ_SAMPLE_FIGURES.some((f) => f.public_url !== null)).toBe(true);
  });
});
```

- [ ] **Step 4: Run both test files**

Run: `npx vitest run lib/chapter-pyq/pyqQuestionRow.test.ts lib/chapter-pyq/fixtures/lawsOfMotionSample.test.ts`

Expected: PASS — 7 + 10 tests. If `filterPublishableRows` returns 9 but the tally is `{ "laws-of-motion": 6, "units-and-measurements": 3 }`, the fixture is internally consistent (6 + 3 = 9).

- [ ] **Step 5: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/pyqQuestionRow.ts lib/chapter-pyq/pyqQuestionRow.test.ts lib/chapter-pyq/fixtures
git commit -m "Add PYQ row types and a hand-seeded Laws of Motion fixture."
```

---

### Task 4: Data access — questions for a catalog chapter, and publishable counts

**Files:**
- Create: `lib/chapter-pyq/fetchPyqQuestionsServer.ts`
- Create: `lib/chapter-pyq/fetchPyqQuestions.ts`
- Create: `app/api/chapter-pyq/questions/route.ts`
- Create: `app/api/chapter-pyq/counts/route.ts`
- Modify: `lib/chapter-pyq/catalog.ts` — delete `export const CHAPTER_PYQ_QUESTION_COUNT = 0` (line 11)
- Modify: `lib/chapter-pyq/catalog.test.ts` — drop the `CHAPTER_PYQ_QUESTION_COUNT` import and assertion
- Modify: `components/chapter-pyq/ChapterPyqListView.tsx` — live counts

**Interfaces:**
- Consumes: `PYQ_QUESTION_SELECT`, `PYQ_PUBLISHABLE_STATUSES`, `PyqQuestionRow`, `filterPublishableRows`, `sortPyqRows`, `tallyPublishableCounts` (Task 3); `pdfChaptersForCatalogSlug`, `isPyqSourcedCatalogSlug` (Task 2); `mapPyqRowsToChapterPyqQuestions` (Task 5); `createAdminClient` from `@/integrations/supabase/server`; `getSupabaseAndUser` from `@/lib/auth/apiAuth`; `fetchWithClientAuth` from `@/lib/auth/clientApiAuth`
- Produces:
  - `export async function fetchPyqRowsForCatalogChapter(supabase: SupabaseClient, catalogSlug: string): Promise<PyqQuestionRow[]>`
  - `export async function fetchPyqPublishableCounts(supabase: SupabaseClient): Promise<Record<string, number>>`
  - `export async function fetchChapterPyqQuestions(catalogSlug: string): Promise<ChapterPyqQuestionBundle | null>` (client)
  - `export async function fetchChapterPyqCounts(): Promise<Record<string, number>>` (client)
  - `GET /api/chapter-pyq/questions?chapter=<catalogSlug>` → `ChapterPyqQuestionBundle` | 404
  - `GET /api/chapter-pyq/counts` → `{ counts: Record<string, number> }`

Type note: `SupabaseClient` is imported **without** the `Database` generic — exactly as `lib/mock/fetchCbseChapterMcqsServer.ts:1` does — because the PYQ tables are not in the generated types yet.

- [ ] **Step 1: Write the server fetch module**

Create `lib/chapter-pyq/fetchPyqQuestionsServer.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PYQ_PUBLISHABLE_STATUSES,
  PYQ_QUESTION_SELECT,
  filterPublishableRows,
  sortPyqRows,
  tallyPublishableCounts,
  type PyqCountRow,
  type PyqQuestionRow,
} from "@/lib/chapter-pyq/pyqQuestionRow";
import { pdfChaptersForCatalogSlug } from "@/lib/chapter-pyq/pdfChapterMap";

/** PostgREST caps a single response (default 1,000 rows), so paginate explicitly. */
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

/**
 * Publishable rows for one catalog chapter, spanning every PDF chapter that maps
 * to it. The aliased `chapters:pyq_chapters!inner` embed plus a `catalog_slug` eq
 * is the whole merge rule: the column is not unique, so one slug pulls rows from
 * several `pyq_chapters` rows at once.
 */
export async function fetchPyqRowsForCatalogChapter(
  supabase: SupabaseClient,
  catalogSlug: string
): Promise<PyqQuestionRow[]> {
  if (pdfChaptersForCatalogSlug(catalogSlug).length === 0) return [];

  const rows: PyqQuestionRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("pyq_questions")
      .select(PYQ_QUESTION_SELECT)
      .eq("chapters.catalog_slug", catalogSlug)
      .in("review_status", [...PYQ_PUBLISHABLE_STATUSES])
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = (data ?? []) as unknown as PyqQuestionRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return sortPyqRows(filterPublishableRows(rows));
}

/**
 * Publishable count per catalog slug for the chapter cards.
 *
 * PostgREST cannot group, so this pulls one narrow row per publishable question
 * and tallies in JS. That is fine while the pilot has ~132 publishable rows; if
 * the publishable set ever passes ~10k, replace this with a SQL view
 * (`v_chapter_pyq_counts`) owned by the ingestion plan's migrations.
 */
export async function fetchPyqPublishableCounts(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const rows: PyqCountRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("pyq_questions")
      .select("review_status, chapters:pyq_chapters!inner(catalog_slug)")
      .in("review_status", [...PYQ_PUBLISHABLE_STATUSES])
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = (data ?? []) as unknown as PyqCountRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return tallyPublishableCounts(rows);
}
```

- [ ] **Step 2: Write the two API routes**

Create `app/api/chapter-pyq/questions/route.ts`, following the shape of `app/api/mock/cbse-chapter-mcqs/route.ts`:

```ts
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { fetchPyqRowsForCatalogChapter } from "@/lib/chapter-pyq/fetchPyqQuestionsServer";
import { mapPyqRowsToChapterPyqQuestions } from "@/lib/chapter-pyq/pyqQuestionMap";
import { isPyqSourcedCatalogSlug } from "@/lib/chapter-pyq/pdfChapterMap";
import { findChapter } from "@/lib/chapter-pyq/catalog";

const CACHE_REVALIDATE_SEC = 3600;

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const chapter = new URL(request.url).searchParams.get("chapter")?.trim() ?? "";
    const entry = findChapter("physics", chapter);
    if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!isPyqSourcedCatalogSlug(chapter)) {
      return NextResponse.json({ catalogSlug: chapter, chapterName: entry.name, questions: [] });
    }

    const loadCached = unstable_cache(
      async () => {
        const supabase = createAdminClient();
        if (!supabase) throw new Error("Database configuration error");
        const rows = await fetchPyqRowsForCatalogChapter(supabase, chapter);
        return mapPyqRowsToChapterPyqQuestions(rows, entry.name);
      },
      ["chapter-pyq-questions", chapter],
      { revalidate: CACHE_REVALIDATE_SEC, tags: [`chapter-pyq-${chapter}`] }
    );

    return NextResponse.json(await loadCached(), {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

Create `app/api/chapter-pyq/counts/route.ts`:

```ts
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { fetchPyqPublishableCounts } from "@/lib/chapter-pyq/fetchPyqQuestionsServer";

const CACHE_REVALIDATE_SEC = 3600;

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const loadCached = unstable_cache(
      async () => {
        const supabase = createAdminClient();
        if (!supabase) throw new Error("Database configuration error");
        return fetchPyqPublishableCounts(supabase);
      },
      ["chapter-pyq-counts"],
      { revalidate: CACHE_REVALIDATE_SEC, tags: ["chapter-pyq-counts"] }
    );

    return NextResponse.json(
      { counts: await loadCached() },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write the client wrappers**

Create `lib/chapter-pyq/fetchPyqQuestions.ts`, mirroring `lib/mock/fetchCbseChapterMcqs.ts`:

```ts
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import type { ChapterPyqQuestionBundle } from "@/lib/chapter-pyq/pyqQuestionMap";

export async function fetchChapterPyqQuestions(
  catalogSlug: string
): Promise<ChapterPyqQuestionBundle | null> {
  const params = new URLSearchParams({ chapter: catalogSlug });
  const res = await fetchWithClientAuth(`/api/chapter-pyq/questions?${params.toString()}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to load chapter questions (${res.status})`);
  }
  return (await res.json()) as ChapterPyqQuestionBundle;
}

export async function fetchChapterPyqCounts(): Promise<Record<string, number>> {
  const res = await fetchWithClientAuth("/api/chapter-pyq/counts");
  if (!res.ok) return {};
  const body = (await res.json().catch(() => null)) as { counts?: Record<string, number> } | null;
  return body?.counts ?? {};
}
```

- [ ] **Step 4: Remove the hardcoded count and wire the list view**

In `lib/chapter-pyq/catalog.ts`, delete line 11 (`export const CHAPTER_PYQ_QUESTION_COUNT = 0;`).

In `lib/chapter-pyq/catalog.test.ts`, remove `CHAPTER_PYQ_QUESTION_COUNT` from the import list and replace the `expect(CHAPTER_PYQ_QUESTION_COUNT).toBe(0);` line inside the "filters by chapter name…" test with nothing, renaming that test to `"filters by chapter name"`.

In `components/chapter-pyq/ChapterPyqListView.tsx`: drop the `CHAPTER_PYQ_QUESTION_COUNT` import, add

```tsx
const [counts, setCounts] = useState<Record<string, number> | null>(null);

useEffect(() => {
  let cancelled = false;
  void fetchChapterPyqCounts()
    .then((next) => {
      if (!cancelled) setCounts(next);
    })
    .catch(() => {
      if (!cancelled) setCounts({});
    });
  return () => {
    cancelled = true;
  };
}, []);
```

and replace the card's count paragraph body with:

```tsx
{counts === null ? "…" : `${counts[entry.slug] ?? 0} questions`}
```

Import `fetchChapterPyqCounts` from `@/lib/chapter-pyq/fetchPyqQuestions` and `useEffect` from `react` at the top of the file.

- [ ] **Step 5: Run the catalog and row tests**

Run: `npx vitest run lib/chapter-pyq`

Expected: PASS. The catalog suite no longer references `CHAPTER_PYQ_QUESTION_COUNT`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "chapter-pyq"`

Expected: no output. (If `mapPyqRowsToChapterPyqQuestions` is not yet written, Task 5 supplies it — run this step again after Task 5.)

- [ ] **Step 7: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq app/api/chapter-pyq components/chapter-pyq/ChapterPyqListView.tsx
git commit -m "Read publishable Chapter PYQ questions and counts from Supabase."
```

---

### Task 5: Row → `Question` mapper and scoring

**Files:**
- Create: `lib/chapter-pyq/pyqQuestionMap.ts`
- Create: `lib/chapter-pyq/pyqScoring.ts`
- Modify: `types/index.ts:77-99` — two optional fields on `Question`
- Test: `lib/chapter-pyq/pyqQuestionMap.test.ts`
- Test: `lib/chapter-pyq/pyqScoring.test.ts`

**Interfaces:**
- Consumes: `PyqQuestionRow`, `PyqTier` (Task 3); `resolvePyqFigureHtml` (Task 9 — write a minimal version here if Task 9 has not landed, then Task 9 replaces the body of `pyqFigures.ts`, not its signature); `stripHtmlToPlain` from `@/lib/mock/catalogQuestionMap`
- Produces:
  - `export type ChapterPyqQuestion = { question: Question; tier: PyqTier; pdfChapterName: string; topicName: string | null; qNo: number; sourcePage: number; examLabel: string | null }`
  - `export type ChapterPyqQuestionBundle = { catalogSlug: string; chapterName: string; questions: ChapterPyqQuestion[] }`
  - `export function mapPyqRowToChapterPyqQuestion(row: PyqQuestionRow, chapterFallback: string): ChapterPyqQuestion | null`
  - `export function mapPyqRowsToChapterPyqQuestions(rows: PyqQuestionRow[], chapterName: string): ChapterPyqQuestionBundle`
  - `export function formatPyqExamLabel(examDate: string | null, shift: "morning" | "evening" | null): string | null`
  - `export function isPyqAnswerCorrect(q: Question, answer: number | undefined): boolean`
  - `export const PYQ_NUMERIC_TOLERANCE = 0.01`

The mapper deliberately **wraps** `Question` rather than extending it: `tier`, `pdfChapterName` and `topicName` are Chapter-PYQ-only and must not leak into the shared `Question` shape used by the mock product. Only the two answer-format fields go on `Question`, because the shells genuinely need them.

- [ ] **Step 1: Extend `Question` additively**

In `types/index.ts`, inside `export interface Question`, after the `correctAnswer: number; // index` line:

```ts
  /**
   * `"numerical"` marks a JEE Main numeric-entry question: `options` is empty,
   * `correctAnswer` is `-1` and unused, and the expected value lives in
   * `numericAnswer`. Absent or `"mcq"` means a normal 4-option question, so
   * every existing producer keeps working unchanged.
   */
  answerFormat?: "mcq" | "numerical";
  /** Verbatim expected value for `answerFormat === "numerical"` (e.g. `"12"`, `"-0.25"`). */
  numericAnswer?: string | null;
```

- [ ] **Step 2: Write the failing tests**

Create `lib/chapter-pyq/pyqQuestionMap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatPyqExamLabel,
  mapPyqRowToChapterPyqQuestion,
  mapPyqRowsToChapterPyqQuestions,
} from "./pyqQuestionMap";
import { LAWS_OF_MOTION_SAMPLE_ROWS } from "./fixtures/lawsOfMotionSample";

const byId = (id: string) => LAWS_OF_MOTION_SAMPLE_ROWS.find((r) => r.id.endsWith(id))!;

describe("pyq question mapper", () => {
  it("maps an MCQ to four options and a zero-based correct index", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000001"), "Laws of Motion")!;
    expect(mapped.question.options).toHaveLength(4);
    expect(mapped.question.correctAnswer).toBe(1);
    expect(mapped.question.answerFormat).toBe("mcq");
    expect(mapped.question.numericAnswer).toBeNull();
    expect(mapped.question.subject).toBe("physics");
    expect(mapped.question.examType).toEqual(["JEE_Mains"]);
  });

  it("never fabricates options for a numerical question", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000003"), "Laws of Motion")!;
    expect(mapped.question.answerFormat).toBe("numerical");
    expect(mapped.question.options).toEqual([]);
    expect(mapped.question.correctAnswer).toBe(-1);
    expect(mapped.question.numericAnswer).toBe("12");
  });

  it("keeps a negative numerical answer verbatim", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000004"), "Laws of Motion")!;
    expect(mapped.question.numericAnswer).toBe("-0.25");
    expect(mapped.question.options).toEqual([]);
  });

  it("carries the coarse PDF chapter label and the fine topic label", () => {
    const merged = mapPyqRowToChapterPyqQuestion(byId("000000000011"), "Units and Measurements")!;
    expect(merged.pdfChapterName).toBe("Experimental Physics");
    expect(merged.topicName).toBe("Vernier Callipers");
    expect(merged.question.topic).toBe("Vernier Callipers");
  });

  it("falls back to the PDF chapter name when a row has no topic", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000005"), "Laws of Motion")!;
    expect(mapped.topicName).toBeNull();
    expect(mapped.question.topic).toBe("Laws of Motion");
  });

  it("renders a figure placeholder as an img and leaves no placeholder behind", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000002"), "Laws of Motion")!;
    expect(mapped.question.questionHtml).toContain("<img");
    expect(mapped.question.questionHtml).toContain("p047_x101.png");
    expect(mapped.question.questionHtml).not.toContain("[[fig:");
  });

  it("drops rows with no body and rows with no chapter", () => {
    expect(mapPyqRowToChapterPyqQuestion(byId("000000000008"), "Laws of Motion")).toBeNull();
    const orphan = { ...byId("000000000001"), chapters: null };
    expect(mapPyqRowToChapterPyqQuestion(orphan, "Laws of Motion")).toBeNull();
  });

  it("carries tier, q_no and source page for the badge and provenance", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000006"), "Laws of Motion")!;
    expect(mapped.tier).toBe("advanced");
    expect(mapped.qNo).toBe(6);
    expect(mapped.sourcePage).toBe(58);
  });

  it("formats the provenance label the way the book tags it", () => {
    expect(formatPyqExamLabel("2024-01-30", "evening")).toBe("30 Jan 2024 (E)");
    expect(formatPyqExamLabel("2023-04-06", "morning")).toBe("6 Apr 2023 (M)");
    expect(formatPyqExamLabel("2023-04-06", null)).toBe("6 Apr 2023");
    expect(formatPyqExamLabel(null, "morning")).toBeNull();
  });

  it("builds a bundle that drops unmappable rows and keeps order", () => {
    const bundle = mapPyqRowsToChapterPyqQuestions(
      LAWS_OF_MOTION_SAMPLE_ROWS,
      "Laws of Motion"
    );
    expect(bundle.chapterName).toBe("Laws of Motion");
    expect(bundle.questions).toHaveLength(11);
    expect(bundle.questions.map((q) => q.question.id)).toEqual(
      LAWS_OF_MOTION_SAMPLE_ROWS.filter((r) => r.body !== null).map((r) => r.id)
    );
  });
});
```

Create `lib/chapter-pyq/pyqScoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Question } from "@/types";
import { PYQ_NUMERIC_TOLERANCE, isPyqAnswerCorrect } from "./pyqScoring";

const base: Question = {
  id: "q1",
  subject: "physics",
  topic: "Friction",
  classLevel: 12,
  examType: ["JEE_Mains"],
  question: "stem",
  options: [],
  correctAnswer: -1,
  hint: "",
  solution: "",
  reference: { theory: "", relatedTopics: [], applicationExample: "" },
};

const mcq: Question = { ...base, options: ["a", "b", "c", "d"], correctAnswer: 2, answerFormat: "mcq" };
const numeric: Question = { ...base, answerFormat: "numerical", numericAnswer: "12" };

describe("pyq scoring", () => {
  it("scores an MCQ on the option index", () => {
    expect(isPyqAnswerCorrect(mcq, 2)).toBe(true);
    expect(isPyqAnswerCorrect(mcq, 0)).toBe(false);
  });

  it("treats a question with no answerFormat as an MCQ", () => {
    const legacy: Question = { ...mcq, answerFormat: undefined };
    expect(isPyqAnswerCorrect(legacy, 2)).toBe(true);
  });

  it("scores a numerical on the entered value within tolerance", () => {
    expect(isPyqAnswerCorrect(numeric, 12)).toBe(true);
    expect(isPyqAnswerCorrect(numeric, 12 + PYQ_NUMERIC_TOLERANCE)).toBe(true);
    expect(isPyqAnswerCorrect(numeric, 12.5)).toBe(false);
    expect(isPyqAnswerCorrect(numeric, -12)).toBe(false);
  });

  it("handles negative and decimal expected values", () => {
    const neg: Question = { ...base, answerFormat: "numerical", numericAnswer: "-0.25" };
    expect(isPyqAnswerCorrect(neg, -0.25)).toBe(true);
    expect(isPyqAnswerCorrect(neg, 0.25)).toBe(false);
  });

  it("never scores an unanswered or unparseable question correct", () => {
    expect(isPyqAnswerCorrect(numeric, undefined)).toBe(false);
    expect(isPyqAnswerCorrect(mcq, undefined)).toBe(false);
    const broken: Question = { ...base, answerFormat: "numerical", numericAnswer: "see solution" };
    expect(isPyqAnswerCorrect(broken, 0)).toBe(false);
  });

  it("keeps numericals off the MCQ path by branching on answerFormat, not on -1", () => {
    // Correctly tagged, the branch does all the work: the entered value is
    // compared against numericAnswer and correctAnswer is never read, so -1 is
    // just a wrong answer to a question whose answer is 12.
    expect(isPyqAnswerCorrect(numeric, -1)).toBe(false);
    expect(isPyqAnswerCorrect(numeric, 12)).toBe(true);
  });

  it("shows the known limit of the -1 sentinel when a numerical is mis-tagged mcq", () => {
    // -1 is an out-of-range option index, so the MCQ path scores a mis-tagged
    // numerical wrong for every real entered value — 12 included.
    expect(isPyqAnswerCorrect({ ...numeric, answerFormat: "mcq" }, 12)).toBe(false);
    // But -1 is reachable: a student answering -1 matches the sentinel and scores
    // correct. This is the limit of the sentinel, not a guarantee it provides.
    // The only real protection is tagging answerFormat correctly.
    expect(isPyqAnswerCorrect({ ...numeric, answerFormat: "mcq" }, -1)).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify both fail**

Run: `npx vitest run lib/chapter-pyq/pyqQuestionMap.test.ts lib/chapter-pyq/pyqScoring.test.ts`

Expected: FAIL — `Cannot find module './pyqQuestionMap'` and `Cannot find module './pyqScoring'`.

- [ ] **Step 4: Write the scoring module**

Create `lib/chapter-pyq/pyqScoring.ts`:

```ts
import type { Question } from "@/types";

/**
 * JEE Main numeric entry accepts a value rounded to two decimals, so compare
 * with an absolute tolerance rather than `===` on floats.
 */
export const PYQ_NUMERIC_TOLERANCE = 0.01;

/**
 * `answer` is the value stored in the shells' `Record<string, number>`:
 * an option index for MCQ, the entered numeric value for `answerFormat === "numerical"`.
 *
 * The `answerFormat` branch comes first and is the only thing separating the two
 * comparisons. `correctAnswer === -1` is not a sentinel to lean on: it is a
 * reachable entered value, so reordering these two checks is a real bug.
 */
export function isPyqAnswerCorrect(q: Question, answer: number | undefined): boolean {
  if (answer === undefined || !Number.isFinite(answer)) return false;
  if (q.answerFormat === "numerical") {
    const expected = Number(String(q.numericAnswer ?? "").trim());
    if (!Number.isFinite(expected)) return false;
    return Math.abs(answer - expected) <= PYQ_NUMERIC_TOLERANCE;
  }
  return answer === q.correctAnswer;
}
```

- [ ] **Step 5: Write the mapper**

Create `lib/chapter-pyq/pyqQuestionMap.ts`:

```ts
import type { Question } from "@/types";
import { stripHtmlToPlain } from "@/lib/mock/catalogQuestionMap";
import { resolvePyqFigureHtml } from "@/lib/chapter-pyq/pyqFigures";
import type { PyqExamShift, PyqQuestionRow, PyqTier } from "@/lib/chapter-pyq/pyqQuestionRow";

export type ChapterPyqQuestion = {
  question: Question;
  tier: PyqTier;
  /** Coarse label — `pyq_chapters.name`, the PDF chapter title (e.g. "Rotational Motion"). */
  pdfChapterName: string;
  /** Fine label — `pyq_topics.name` (e.g. "Moment of Inertia"). Null when the row has no topic. */
  topicName: string | null;
  qNo: number;
  sourcePage: number;
  /** e.g. "30 Jan 2024 (E)". Null when `exam_date` is missing. */
  examLabel: string | null;
};

export type ChapterPyqQuestionBundle = {
  catalogSlug: string;
  chapterName: string;
  questions: ChapterPyqQuestion[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const emptyReference: Question["reference"] = {
  theory: "",
  relatedTopics: [],
  applicationExample: "",
};

export function formatPyqExamLabel(
  examDate: string | null,
  shift: PyqExamShift | null
): string | null {
  if (!examDate) return null;
  const m = examDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const label = `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  if (shift === "morning") return `${label} (M)`;
  if (shift === "evening") return `${label} (E)`;
  return label;
}

/** MCQ options in `option_index` order, padded to four so the shell renders a stable grid. */
function mcqOptions(row: PyqQuestionRow): string[] {
  const ordered = [...row.question_options]
    .sort((a, b) => a.option_index - b.option_index)
    .map((o) => o.body ?? "");
  while (ordered.length < 4) ordered.push("");
  return ordered.slice(0, 4);
}

/**
 * Returns null for rows the student must never see: no body (skeleton row) or no
 * parent chapter. Publishing status is filtered upstream by
 * `filterPublishableRows`; this is a shape guard, not a gate.
 */
export function mapPyqRowToChapterPyqQuestion(
  row: PyqQuestionRow,
  chapterFallback: string
): ChapterPyqQuestion | null {
  const body = row.body?.trim();
  if (!body || !row.chapters) return null;

  const pdfChapterName = row.chapters.name || chapterFallback;
  const topicName = row.topics?.name?.trim() || null;
  const isNumerical = row.format === "numerical";
  const questionHtml = resolvePyqFigureHtml(body, row.figure_links);

  const question: Question = {
    id: row.id,
    subject: "physics",
    topic: topicName ?? pdfChapterName,
    classLevel: 12,
    examType: ["JEE_Mains"],
    question: stripHtmlToPlain(questionHtml) || "Question",
    questionHtml,
    // The MathonGo book ships no worked solutions; students see right/wrong only.
    solutionHtml: null,
    options: isNumerical ? [] : mcqOptions(row),
    // -1 is an out-of-range option index, not an unreachable value: a student can
    // legitimately enter -1. Scoring must branch on answerFormat first.
    correctAnswer: isNumerical ? -1 : (row.correct_option ?? 1) - 1,
    answerFormat: isNumerical ? "numerical" : "mcq",
    numericAnswer: isNumerical ? row.numerical_answer : null,
    hint: "",
    solution: "",
    reference: emptyReference,
  };

  return {
    question,
    tier: row.tier,
    pdfChapterName,
    topicName,
    qNo: row.q_no,
    sourcePage: row.source_page,
    examLabel: formatPyqExamLabel(row.exam_date, row.exam_shift),
  };
}

export function mapPyqRowsToChapterPyqQuestions(
  rows: PyqQuestionRow[],
  chapterName: string
): ChapterPyqQuestionBundle {
  const questions = rows
    .map((row) => mapPyqRowToChapterPyqQuestion(row, chapterName))
    .filter((q): q is ChapterPyqQuestion => q !== null);
  return {
    catalogSlug: rows[0]?.chapters?.catalog_slug ?? "",
    chapterName,
    questions,
  };
}
```

- [ ] **Step 6: Run both test files**

Run: `npx vitest run lib/chapter-pyq/pyqQuestionMap.test.ts lib/chapter-pyq/pyqScoring.test.ts`

Expected: PASS — 10 + 7 tests. The figure assertions require Task 9's `resolvePyqFigureHtml`; if Task 9 has not landed, run Task 9 Steps 1–4 first, then return here.

- [ ] **Step 7: Typecheck the shared type change**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "types/index|catalogQuestionMap|MockPageContent"`

Expected: no output — both new fields are optional, so no existing `Question` producer breaks.

- [ ] **Step 8: Commit (only if the user asked)**

```bash
git add types/index.ts lib/chapter-pyq/pyqQuestionMap.ts lib/chapter-pyq/pyqQuestionMap.test.ts lib/chapter-pyq/pyqScoring.ts lib/chapter-pyq/pyqScoring.test.ts
git commit -m "Map PYQ rows to app questions with honest numerical answers."
```

---

### Task 6: Numeric answer input in both NTA shells

**Files:**
- Modify: `components/prep-mock/nta/ntaExamParts.tsx` — add `NtaNumericAnswerInput`
- Modify: `components/prep-mock/nta/NtaExamShell.tsx:25-46` (props), `:265-293` (options block)
- Modify: `components/prep-mock/nta/NtaExamShellMobile.tsx:31-48` (props), `:289-311` (options block)

**Interfaces:**
- Consumes: `Question.answerFormat` (Task 5); `isPyqAnswerCorrect` (Task 5, used by Task 7 not by the shells)
- Produces, added to **both** `NtaExamShellProps` and the mobile props type:
  ```ts
  /** Raw numeric-entry text per question id. Only read when `answerFormat === "numerical"`. */
  numericDrafts?: Record<string, string>;
  /** Every keystroke of the numeric input. The caller parses and commits to `answers`. */
  onNumericDraftChange?: (questionId: string, raw: string) => void;
  /** Optional short label rendered beside the question number (Chapter PYQ tier badge). */
  questionBadges?: Record<string, string>;
  ```
- `answers` stays `Record<string, number>`. **No signature widens.** See "The numerical decision" above: the number is an option index for MCQ and the entered value for a numerical, discriminated by the question, not the answer.

All three props are optional with no default behaviour, so `MockPageContent` passes none and the mock flow is byte-identical. `NtaExamShell` must forward all three through its existing `shellProps` object (`NtaExamShell.tsx:87-108`) so the mobile shell receives them too.

**Why the draft logic lives in `lib/`:** the Vitest `include` globs only collect `lib/**` and `app/**`, and the node environment cannot import JSX. Anything inside `ntaExamParts.tsx` is therefore untestable, so the keystroke sanitiser and the commit rule go in `lib/chapter-pyq/pyqNumericDraft.ts` and the component imports them.

- [ ] **Step 1: Write the failing draft test**

Create `lib/chapter-pyq/pyqNumericDraft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { commitNumericDraft, sanitizeNumericDraft } from "./pyqNumericDraft";

describe("numeric draft handling", () => {
  it("keeps partial decimals typeable", () => {
    expect(sanitizeNumericDraft("3")).toBe("3");
    expect(sanitizeNumericDraft("3.")).toBe("3.");
    expect(sanitizeNumericDraft("-")).toBe("-");
    expect(sanitizeNumericDraft("-0.25")).toBe("-0.25");
  });

  it("strips letters, spaces and stray signs or dots", () => {
    expect(sanitizeNumericDraft("12abc")).toBe("12");
    expect(sanitizeNumericDraft("1-2")).toBe("12");
    expect(sanitizeNumericDraft("1.2.3")).toBe("1.23");
    expect(sanitizeNumericDraft("")).toBe("");
  });

  it("commits only finite values and reports the rest as unanswered", () => {
    expect(commitNumericDraft("12")).toBe(12);
    expect(commitNumericDraft("3.")).toBe(3);
    expect(commitNumericDraft("-0.25")).toBe(-0.25);
    expect(commitNumericDraft("0")).toBe(0);
    expect(commitNumericDraft("")).toBeUndefined();
    expect(commitNumericDraft("-")).toBeUndefined();
    expect(commitNumericDraft(".")).toBeUndefined();
  });
});
```

`commitNumericDraft("0")` returning `0` while `commitNumericDraft("")` returns `undefined` is the whole reason the draft/commit split exists: `Number("")` is also `0`, and conflating them would mark an empty answer box as answered in the palette.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/chapter-pyq/pyqNumericDraft.test.ts`

Expected: FAIL — `Cannot find module './pyqNumericDraft'`.

- [ ] **Step 3: Write the draft module**

Create `lib/chapter-pyq/pyqNumericDraft.ts`:

```ts
const NUMERIC_DRAFT_RE = /^-?\d*\.?\d*$/;

/** Sanitize a keystroke into a partial decimal (keeps `"-"` and `"3."` typeable). */
export function sanitizeNumericDraft(raw: string): string {
  const stripped = String(raw ?? "").replace(/[^0-9.\-]/g, "");
  const signed = stripped.startsWith("-")
    ? `-${stripped.slice(1).replace(/-/g, "")}`
    : stripped.replace(/-/g, "");
  const parts = signed.split(".");
  const joined = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : signed;
  return NUMERIC_DRAFT_RE.test(joined) ? joined : "";
}

/** `undefined` means "not answered" — that is what the palette and legend counts read. */
export function commitNumericDraft(draft: string): number | undefined {
  const t = draft.trim();
  if (t === "" || t === "-" || t === "." || t === "-.") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/chapter-pyq/pyqNumericDraft.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 5: Add the shared numeric input part**

In `components/prep-mock/nta/ntaExamParts.tsx`, add to the imports at the top of the file:

```tsx
import { sanitizeNumericDraft } from "@/lib/chapter-pyq/pyqNumericDraft";
```

Then, after `NtaOptionBody`:

```tsx
const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "-"] as const;

/** JEE Main numeric-entry answer box. Mobile also gets an on-screen keypad. */
export const NtaNumericAnswerInput = memo(function NtaNumericAnswerInput({
  value,
  onChange,
  disabled = false,
  mobile = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  mobile?: boolean;
}) {
  const push = (key: string) =>
    onChange(sanitizeNumericDraft(key === "-" && value.startsWith("-") ? value.slice(1) : value + key));

  return (
    <div className="w-full min-w-0">
      <p className={mobile ? "mb-1 text-[13px] font-bold" : "mb-1.5 text-sm font-bold sm:mb-2 sm:text-base"}>
        Answer :
      </p>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(sanitizeNumericDraft(e.target.value))}
        aria-label="Numerical answer"
        className="w-full max-w-[16rem] rounded border px-3 py-2 text-base tabular-nums outline-none disabled:opacity-50"
        style={{ borderColor: "var(--nta-border)", background: "var(--nta-surface)", color: "var(--nta-text)" }}
      />
      <p className="mt-1 text-[11px]" style={{ color: "var(--nta-muted)" }}>
        {disabled
          ? "Numeric entry is unavailable in this session."
          : "Enter the numerical value. No options for this question."}
      </p>
      {mobile && !disabled ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {KEYPAD.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => push(key)}
              className="rounded border py-2 text-base font-bold tabular-nums"
              style={{ borderColor: "var(--nta-border)", background: "var(--nta-surface)" }}
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(sanitizeNumericDraft(value.slice(0, -1)))}
            className="col-span-3 rounded border py-2 text-sm font-bold"
            style={{ borderColor: "var(--nta-border)", background: "var(--nta-surface)" }}
          >
            Backspace
          </button>
        </div>
      ) : null}
    </div>
  );
});
```

- [ ] **Step 6: Add the props and the conditional block to the desktop shell**

In `components/prep-mock/nta/NtaExamShell.tsx`:

1. Add the three optional props to `NtaExamShellProps` (after `onSubmitClick`), destructure them in the component signature with `numericDrafts`, `onNumericDraftChange`, `questionBadges`, and add all three to the `shellProps` object so the mobile shell receives them.
2. Import `NtaNumericAnswerInput` alongside the existing `NtaOptionBody` / `NtaQuestionStem` import.
3. Replace the `Options :` heading and the `q.options.map(...)` block (lines 265–293) with:

```tsx
              {q.answerFormat === "numerical" ? (
                <NtaNumericAnswerInput
                  value={numericDrafts?.[q.id] ?? ""}
                  onChange={(next) => onNumericDraftChange?.(q.id, next)}
                  disabled={!onNumericDraftChange}
                />
              ) : (
                <>
                  <p className="mb-1.5 text-sm font-bold sm:mb-2 sm:text-base lg:mb-2.5">Options :</p>
                  <div className="w-full min-w-0 space-y-1.5 sm:space-y-2 lg:space-y-2">
                    {/* unchanged: the existing q.options.map(...) label/radio markup */}
                  </div>
                </>
              )}
```

Move the existing `<label>…</label>` markup inside the `else` branch verbatim — do not retype it, and do not change any class name, style or handler in it.

4. Render the badge next to the question number. Find the existing question-number heading above the stem and append:

```tsx
{questionBadges?.[q.id] ? (
  <span
    className="ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
    style={{ borderColor: "var(--nta-border)", color: "var(--nta-muted)" }}
  >
    {questionBadges[q.id]}
  </span>
) : null}
```

- [ ] **Step 7: Mirror it in the mobile shell**

In `components/prep-mock/nta/NtaExamShellMobile.tsx`: add the same three optional props to the props type (after `onSubmitClick`), destructure them, import `NtaNumericAnswerInput`, and replace the `q.options.map(...)` block (lines 289–311) with the same conditional, passing `mobile`:

```tsx
        {q.answerFormat === "numerical" ? (
          <NtaNumericAnswerInput
            value={numericDrafts?.[q.id] ?? ""}
            onChange={(next) => onNumericDraftChange?.(q.id, next)}
            disabled={!onNumericDraftChange}
            mobile
          />
        ) : (
          <div className="space-y-2">
            {/* unchanged: the existing q.options.map(...) button markup */}
          </div>
        )}
```

Add the badge next to the existing `Q {displayQuestionNum} of {displayQuestionTotal}` line (around line 247) using the same `questionBadges?.[q.id]` guard with mobile-scale classes (`text-[9px]`).

- [ ] **Step 8: Typecheck and confirm the mock flow is unchanged**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "prep-mock"`

Expected: no output.

Run: `npx vitest run`

Expected: PASS — the whole suite, unchanged count plus the new files.

Manual check: start `npm run dev`, open `/mock-test`, start any paper. Four options render, selecting one marks the palette green, Clear resets it, the timer counts down. Nothing about the mock flow may look different — `MockPageContent` passes none of the new props, and its numerical questions still arrive as `buildNumericMcq`-fabricated MCQs with no `answerFormat`.

- [ ] **Step 9: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/pyqNumericDraft.ts lib/chapter-pyq/pyqNumericDraft.test.ts components/prep-mock/nta
git commit -m "Add optional numeric answer entry and question badges to the NTA shells."
```

---

### Task 7: `ChapterPyqExamSession` orchestrator

**Files:**
- Create: `lib/chapter-pyq/pyqSets.ts`
- Test: `lib/chapter-pyq/pyqSets.test.ts`
- Create: `components/chapter-pyq/ChapterPyqExamSession.tsx`

**Interfaces:**
- Consumes: `ChapterPyqQuestion` (Task 5), `isPyqAnswerCorrect` (Task 5), `commitNumericDraft`/`sanitizeNumericDraft` (Task 6), `NtaExamShell` + `NtaMockTokens` + `NtaSubmitModal` + `NtaGeneralInstructions`, `useAuth`
- Produces:
  - `export function splitIntoSetSizes(total: number): number[]`
  - `export function buildPyqSets<T>(items: T[]): T[][]`
  - `export const PYQ_SECONDS_PER_QUESTION = 120`
  - `export function secondsForSet(size: number): number`
  - `export default function ChapterPyqExamSession(props: { chapterName: string; subjectLabel: string; questions: ChapterPyqQuestion[]; setLabel: string; onExit: () => void })` — `questions` is **one already-split set**, so the caller (Task 10) owns tier filtering and `buildPyqSets`

- [ ] **Step 1: Write the failing splitter test**

Create `lib/chapter-pyq/pyqSets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PYQ_SECONDS_PER_QUESTION,
  buildPyqSets,
  secondsForSet,
  splitIntoSetSizes,
} from "./pyqSets";

describe("pyq set splitting", () => {
  it("matches the spec's worked examples", () => {
    expect(splitIntoSetSizes(132)).toEqual([27, 27, 26, 26, 26]);
    expect(splitIntoSetSizes(79)).toEqual([27, 26, 26]);
    expect(splitIntoSetSizes(29)).toEqual([29]);
    expect(splitIntoSetSizes(24)).toEqual([24]);
  });

  it("uses max(1, round(total / 25)) sets", () => {
    expect(splitIntoSetSizes(1)).toEqual([1]);
    expect(splitIntoSetSizes(12)).toEqual([12]);
    expect(splitIntoSetSizes(13)).toEqual([13]);
    expect(splitIntoSetSizes(37)).toEqual([37]);
    expect(splitIntoSetSizes(38)).toEqual([19, 19]);
  });

  it("never leaves a stub set and never differs by more than one", () => {
    for (let total = 1; total <= 400; total++) {
      const sizes = splitIntoSetSizes(total);
      expect(sizes.reduce((a, b) => a + b, 0), `total ${total}`).toBe(total);
      expect(Math.min(...sizes), `total ${total}`).toBeGreaterThan(0);
      expect(Math.max(...sizes) - Math.min(...sizes), `total ${total}`).toBeLessThanOrEqual(1);
      expect(sizes.length, `total ${total}`).toBe(Math.max(1, Math.round(total / 25)));
    }
  });

  it("puts the larger sets first", () => {
    const sizes = splitIntoSetSizes(132);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });

  it("returns no sets for an empty chapter", () => {
    expect(splitIntoSetSizes(0)).toEqual([]);
    expect(splitIntoSetSizes(-5)).toEqual([]);
    expect(buildPyqSets([])).toEqual([]);
  });

  it("slices items sequentially into the computed sizes", () => {
    const items = Array.from({ length: 132 }, (_, i) => i + 1);
    const sets = buildPyqSets(items);
    expect(sets.map((s) => s.length)).toEqual([27, 27, 26, 26, 26]);
    expect(sets[0]?.[0]).toBe(1);
    expect(sets[0]?.at(-1)).toBe(27);
    expect(sets[1]?.[0]).toBe(28);
    expect(sets.flat()).toEqual(items);
  });

  it("allows two minutes per question in the set", () => {
    expect(PYQ_SECONDS_PER_QUESTION).toBe(120);
    expect(secondsForSet(27)).toBe(3240);
    expect(secondsForSet(24)).toBe(2880);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/chapter-pyq/pyqSets.test.ts`

Expected: FAIL — `Cannot find module './pyqSets'`.

- [ ] **Step 3: Write the splitter**

Create `lib/chapter-pyq/pyqSets.ts`:

```ts
/** Real-exam pacing: 2 minutes per question in the set. */
export const PYQ_SECONDS_PER_QUESTION = 120;

const TARGET_SET_SIZE = 25;

/**
 * Set count is `max(1, round(total / 25))`; sizes differ by at most one and the
 * remainder goes to the leading sets. No stub sets, ever.
 *
 * `Math.round` is half-up in JS, so 37 → 1 set and 38 → 2 sets.
 */
export function splitIntoSetSizes(total: number): number[] {
  if (!Number.isFinite(total) || total <= 0) return [];
  const count = Math.max(1, Math.round(total / TARGET_SET_SIZE));
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Sequential slices — sets stay in the order the (filtered) list arrived in. */
export function buildPyqSets<T>(items: T[]): T[][] {
  const sizes = splitIntoSetSizes(items.length);
  const out: T[][] = [];
  let cursor = 0;
  for (const size of sizes) {
    out.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return out;
}

export function secondsForSet(size: number): number {
  return Math.max(0, size) * PYQ_SECONDS_PER_QUESTION;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/chapter-pyq/pyqSets.test.ts`

Expected: PASS — 7 tests, including the 400-iteration invariant loop.

- [ ] **Step 5: Write the orchestrator**

Create `components/chapter-pyq/ChapterPyqExamSession.tsx`. This mirrors — never imports — `MockPageContent`'s answer handlers (`:964-966`, `:1039-1083`), timer effect (`:483-495`), visited effect (`:497-502`) and shell wiring (`:1650-1676`).

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { Question } from "@/types";
import { NtaMockTokens } from "@/components/prep-mock/nta/NtaMockTokens";
import { NtaExamShell } from "@/components/prep-mock/nta/NtaExamShell";
import { NtaSubmitModal } from "@/components/prep-mock/nta/NtaSubmitModal";
import { useAuth } from "@/hooks/useAuth";
import type { ChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";
import { isPyqAnswerCorrect } from "@/lib/chapter-pyq/pyqScoring";
import { commitNumericDraft } from "@/lib/chapter-pyq/pyqNumericDraft";
import { PYQ_TIER_LABEL } from "@/lib/chapter-pyq/pyqTiers";
import { secondsForSet } from "@/lib/chapter-pyq/pyqSets";

type ChapterPyqExamSessionProps = {
  chapterName: string;
  subjectLabel: string;
  /** Already tier-filtered and already split into exactly this one set. */
  questions: ChapterPyqQuestion[];
  setLabel: string;
  onExit: () => void;
};

export default function ChapterPyqExamSession({
  chapterName,
  subjectLabel,
  questions: entries,
  setLabel,
  onExit,
}: ChapterPyqExamSessionProps) {
  const { profile, user } = useAuth();
  const { resolvedTheme } = useTheme();
  const questions = useMemo<Question[]>(() => entries.map((e) => e.question), [entries]);
  const totalSeconds = useMemo(() => secondsForSet(questions.length), [questions.length]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [startTime] = useState(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [finished, setFinished] = useState(false);

  const questionBadges = useMemo(
    () => Object.fromEntries(entries.map((e) => [e.question.id, PYQ_TIER_LABEL[e.tier]])),
    [entries]
  );

  const handleFinish = useCallback(() => {
    setSubmitDialogOpen(false);
    setFinished(true);
  }, []);

  useEffect(() => {
    if (finished) return;
    const interval = setInterval(() => {
      const left = Math.max(0, totalSeconds - Math.floor((Date.now() - startTime) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(interval);
        handleFinish();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [finished, startTime, totalSeconds, handleFinish]);

  useEffect(() => {
    const id = questions[currentIndex]?.id;
    if (!id) return;
    setVisitedIds((prev) => new Set(prev).add(id));
  }, [currentIndex, questions]);

  const handleAnswerSelect = useCallback((questionId: string, idx: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: idx }));
  }, []);

  /** Draft text is authoritative while typing; `answers` only ever holds finite values. */
  const handleNumericDraftChange = useCallback((questionId: string, raw: string) => {
    setNumericDrafts((prev) => ({ ...prev, [questionId]: raw }));
    const committed = commitNumericDraft(raw);
    setAnswers((prev) => {
      const next = { ...prev };
      if (committed === undefined) delete next[questionId];
      else next[questionId] = committed;
      return next;
    });
  }, []);

  const clearCurrent = useCallback(() => {
    const id = questions[currentIndex]?.id;
    if (!id) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setNumericDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [questions, currentIndex]);

  const goNext = useCallback(
    () => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1)),
    [questions.length]
  );

  const flagCurrent = useCallback(() => {
    const id = questions[currentIndex]?.id;
    if (id) setFlagged((prev) => new Set(prev).add(id));
  }, [questions, currentIndex]);

  const score = useMemo(
    () => questions.filter((q) => isPyqAnswerCorrect(q, answers[q.id])).length,
    [questions, answers]
  );

  if (finished) {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-4 rounded-xl border border-border/50 bg-card/30 p-6">
        <h2 className="text-2xl font-bold text-foreground">
          {score} / {questions.length}
        </h2>
        <p className="text-sm text-muted-foreground">
          {chapterName} · {setLabel}
        </p>
        <ul className="space-y-1 text-sm">
          {entries.map((entry, i) => (
            <li key={entry.question.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-muted-foreground">
                Q{i + 1} · {entry.topicName ?? entry.pdfChapterName}
                {entry.examLabel ? ` · ${entry.examLabel}` : ""}
              </span>
              <span
                className={
                  isPyqAnswerCorrect(entry.question, answers[entry.question.id])
                    ? "font-bold text-primary"
                    : "font-bold text-destructive"
                }
              >
                {answers[entry.question.id] === undefined
                  ? "Skipped"
                  : isPyqAnswerCorrect(entry.question, answers[entry.question.id])
                    ? "Correct"
                    : "Wrong"}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          This book ships no worked solutions, so only right/wrong is shown.
        </p>
        <button type="button" onClick={onExit} className="font-bold text-primary hover:underline">
          Back to chapter
        </button>
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-100 flex flex-col">
      <NtaMockTokens
        skin={resolvedTheme === "light" ? "light" : "dark"}
        className="flex min-h-0 flex-1 flex-col"
      >
        <NtaExamShell
          candidateName={profile?.name ?? user?.name ?? "Candidate"}
          avatarUrl={profile?.avatar_url ?? null}
          examNameLine={`JEE Main Chapter PYQ · ${chapterName}`}
          subjectPaperLine={`${subjectLabel} · ${setLabel}`}
          secondsLeft={secondsLeft}
          questions={questions}
          currentIndex={currentIndex}
          onSelectIndex={setCurrentIndex}
          answers={answers}
          flagged={flagged}
          visitedIds={visitedIds}
          numericDrafts={numericDrafts}
          onNumericDraftChange={handleNumericDraftChange}
          questionBadges={questionBadges}
          onAnswerSelect={handleAnswerSelect}
          onSaveAndNext={goNext}
          onClearResponse={clearCurrent}
          onSaveMarkReviewNext={() => {
            flagCurrent();
            goNext();
          }}
          onMarkReviewNext={() => {
            clearCurrent();
            flagCurrent();
            goNext();
          }}
          onMarkForReviewOnly={() => {
            clearCurrent();
            flagCurrent();
          }}
          onBackNav={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNextNav={goNext}
          onSubmitClick={() => setSubmitDialogOpen(true)}
        />
        <NtaSubmitModal
          open={submitDialogOpen}
          onCancel={() => setSubmitDialogOpen(false)}
          onConfirm={handleFinish}
        />
      </NtaMockTokens>
    </div>
  );
}
```

Check `NtaMockTokens`'s `skin` prop values and `useAuth`'s returned field names against their definitions before finishing; if `NtaSkin` uses different literals than `"light"`/`"dark"`, copy the expression `MockPageContent` uses for `ntaSkin`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "ChapterPyq"`

Expected: no output. `PYQ_TIER_LABEL` comes from Task 8; if Task 8 has not landed, run Task 8 Steps 1–4 first.

- [ ] **Step 7: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/pyqSets.ts lib/chapter-pyq/pyqSets.test.ts components/chapter-pyq/ChapterPyqExamSession.tsx
git commit -m "Add the Chapter PYQ exam session orchestrator and balanced set splitting."
```

---

### Task 8: Tier filter and per-question badge

**Files:**
- Create: `lib/chapter-pyq/pyqTiers.ts`
- Test: `lib/chapter-pyq/pyqTiers.test.ts`
- Create: `components/chapter-pyq/ChapterPyqTierFilter.tsx`

**Interfaces:**
- Consumes: `PyqTier` (Task 3), `ChapterPyqQuestion` (Task 5)
- Produces:
  - `export type PyqTierFilter = PyqTier | "all"`
  - `export const PYQ_TIER_ORDER: readonly PyqTier[]` — `["must_do", "concept_builder", "advanced"]`
  - `export const PYQ_TIER_LABEL: Record<PyqTier, string>`
  - `export const PYQ_TIER_CHIPS: { id: PyqTierFilter; label: string }[]`
  - `export function filterByTier(entries: ChapterPyqQuestion[], tier: PyqTierFilter): ChapterPyqQuestion[]`
  - `export function countByTier(entries: ChapterPyqQuestion[]): Record<PyqTierFilter, number>`
  - `export function isPyqTierFilter(value: string): value is PyqTierFilter`

**Ordering rule:** filter first, then split. Changing the tier re-splits, because `buildPyqSets` (Task 7) is called on the filtered array. `must_do` leads the chip order because it is the largest tier (79 of 132) and the default study path.

- [ ] **Step 1: Write the failing test**

Create `lib/chapter-pyq/pyqTiers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPyqSets } from "./pyqSets";
import {
  PYQ_TIER_CHIPS,
  PYQ_TIER_LABEL,
  PYQ_TIER_ORDER,
  countByTier,
  filterByTier,
  isPyqTierFilter,
} from "./pyqTiers";
import type { ChapterPyqQuestion } from "./pyqQuestionMap";
import type { PyqTier } from "./pyqQuestionRow";

function fake(id: string, tier: PyqTier): ChapterPyqQuestion {
  return {
    question: {
      id,
      subject: "physics",
      topic: "t",
      classLevel: 12,
      examType: ["JEE_Mains"],
      question: "stem",
      options: ["a", "b", "c", "d"],
      correctAnswer: 0,
      answerFormat: "mcq",
      numericAnswer: null,
      hint: "",
      solution: "",
      reference: { theory: "", relatedTopics: [], applicationExample: "" },
    },
    tier,
    pdfChapterName: "Laws of Motion",
    topicName: "t",
    qNo: 1,
    sourcePage: 47,
    examLabel: null,
  };
}

const pilot: ChapterPyqQuestion[] = [
  ...Array.from({ length: 79 }, (_, i) => fake(`m${i}`, "must_do")),
  ...Array.from({ length: 29 }, (_, i) => fake(`c${i}`, "concept_builder")),
  ...Array.from({ length: 24 }, (_, i) => fake(`a${i}`, "advanced")),
];

describe("pyq tiers", () => {
  it("orders and labels the three tiers", () => {
    expect([...PYQ_TIER_ORDER]).toEqual(["must_do", "concept_builder", "advanced"]);
    expect(PYQ_TIER_LABEL).toEqual({
      must_do: "Must Do",
      concept_builder: "Concept Builder",
      advanced: "Advanced",
    });
    expect(PYQ_TIER_CHIPS.map((c) => c.id)).toEqual([
      "all",
      "must_do",
      "concept_builder",
      "advanced",
    ]);
  });

  it("filters to a tier and passes everything through for all", () => {
    expect(filterByTier(pilot, "all")).toHaveLength(132);
    expect(filterByTier(pilot, "must_do")).toHaveLength(79);
    expect(filterByTier(pilot, "concept_builder")).toHaveLength(29);
    expect(filterByTier(pilot, "advanced")).toHaveLength(24);
  });

  it("counts per tier including the all bucket", () => {
    expect(countByTier(pilot)).toEqual({
      all: 132,
      must_do: 79,
      concept_builder: 29,
      advanced: 24,
    });
  });

  it("re-splits when the tier changes, matching the spec's examples", () => {
    const sizes = (tier: Parameters<typeof filterByTier>[1]) =>
      buildPyqSets(filterByTier(pilot, tier)).map((s) => s.length);
    expect(sizes("all")).toEqual([27, 27, 26, 26, 26]);
    expect(sizes("must_do")).toEqual([27, 26, 26]);
    expect(sizes("concept_builder")).toEqual([29]);
    expect(sizes("advanced")).toEqual([24]);
  });

  it("preserves relative order within a tier", () => {
    expect(filterByTier(pilot, "advanced").map((e) => e.question.id)).toEqual(
      Array.from({ length: 24 }, (_, i) => `a${i}`)
    );
  });

  it("validates a tier filter from a query string", () => {
    expect(isPyqTierFilter("must_do")).toBe(true);
    expect(isPyqTierFilter("all")).toBe(true);
    expect(isPyqTierFilter("hard")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/chapter-pyq/pyqTiers.test.ts`

Expected: FAIL — `Cannot find module './pyqTiers'`.

- [ ] **Step 3: Write the tier module**

Create `lib/chapter-pyq/pyqTiers.ts`:

```ts
import type { ChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";
import type { PyqTier } from "@/lib/chapter-pyq/pyqQuestionRow";

export type PyqTierFilter = PyqTier | "all";

/** Must Do leads: it is the largest tier (79 of the pilot's 132) and the default path. */
export const PYQ_TIER_ORDER: readonly PyqTier[] = ["must_do", "concept_builder", "advanced"];

export const PYQ_TIER_LABEL: Record<PyqTier, string> = {
  must_do: "Must Do",
  concept_builder: "Concept Builder",
  advanced: "Advanced",
};

export const PYQ_TIER_CHIPS: { id: PyqTierFilter; label: string }[] = [
  { id: "all", label: "All" },
  ...PYQ_TIER_ORDER.map((tier) => ({ id: tier as PyqTierFilter, label: PYQ_TIER_LABEL[tier] })),
];

export function isPyqTierFilter(value: string): value is PyqTierFilter {
  return value === "all" || (PYQ_TIER_ORDER as readonly string[]).includes(value);
}

/** Runs before set splitting, so changing the tier re-splits the session. */
export function filterByTier(
  entries: ChapterPyqQuestion[],
  tier: PyqTierFilter
): ChapterPyqQuestion[] {
  if (tier === "all") return entries;
  return entries.filter((entry) => entry.tier === tier);
}

export function countByTier(entries: ChapterPyqQuestion[]): Record<PyqTierFilter, number> {
  const out: Record<PyqTierFilter, number> = {
    all: entries.length,
    must_do: 0,
    concept_builder: 0,
    advanced: 0,
  };
  for (const entry of entries) out[entry.tier] += 1;
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/chapter-pyq/pyqTiers.test.ts`

Expected: PASS — 6 tests.

- [ ] **Step 5: Write the chip component**

Create `components/chapter-pyq/ChapterPyqTierFilter.tsx`, following the mock library's pre-start chip pattern (`components/prep-mock/library/MockTestLibraryView.tsx:1001-1012`) with Chapter PYQ's Tailwind classes rather than its CSS-module class names:

```tsx
"use client";

import { PYQ_TIER_CHIPS, type PyqTierFilter } from "@/lib/chapter-pyq/pyqTiers";

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
            className={
              active
                ? "rounded-full border border-primary bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary"
                : "rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
            }
          >
            {chip.label} · {count}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "pyqTiers|ChapterPyqTierFilter"`

Expected: no output.

- [ ] **Step 7: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/pyqTiers.ts lib/chapter-pyq/pyqTiers.test.ts components/chapter-pyq/ChapterPyqTierFilter.tsx
git commit -m "Add the Chapter PYQ tier filter and tier badge labels."
```

---

### Task 9: Supabase Storage figures

**Files:**
- Create: `lib/chapter-pyq/pyqFigures.ts`
- Test: `lib/chapter-pyq/pyqFigures.test.ts`
- Modify: `lib/mock/mockRichTextKatex.ts:95-135` — recognise Supabase public Storage objects in `patchMockHtmlImages`
- Test: `lib/mock/mockRichTextKatex.test.ts` (new)

**Interfaces:**
- Consumes: `PyqFigureLinkRow`, `PyqFigureRow` (Task 3)
- Produces:
  - `export const PYQ_FIGURE_BUCKET = "pyq"`
  - `export function pyqFigurePublicUrl(figure: Pick<PyqFigureRow, "storage_path" | "public_url">): string`
  - `export function resolvePyqFigureHtml(body: string, links: PyqFigureLinkRow[]): string` — used by Task 5's mapper
  - `export const SUPABASE_PUBLIC_OBJECT_RE` (exported from `lib/mock/mockRichTextKatex.ts` for the test)

**Where the `[[fig:KEY]]` transform lives:** `lib/chapter-pyq/pyqFigures.ts`, called once by `mapPyqRowToChapterPyqQuestion` (Task 5) on the server before the bundle is cached. It never runs in the render path. The emitted `<img>` carries **only** `src`, `alt` and `class` — the three attributes in `sanitizeMockHtml`'s `ADD_ATTR` list (`lib/mock/mockHtml.ts:7`) — because `NtaQuestionStem` sanitizes before `patchNtaHtmlPresentation`, and `patchMockHtmlImages` adds `loading` / `decoding` / `referrerpolicy` afterwards.

`pyq_figures.storage_path` already includes the bucket as its first segment (`pyq/physics/figures/p047_x101.png`), so the public URL is `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${storage_path}`. That matches what the ingestion plan writes: it uploads to bucket `pyq` under `physics/figures/<figure_key>.png` and stores `pyq/physics/figures/<figure_key>.png`. The bucket is created **public**, so `/object/public/` resolves without a signed URL.

- [ ] **Step 1: Write the failing figure test**

Create `lib/chapter-pyq/pyqFigures.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PYQ_FIGURE_BUCKET, pyqFigurePublicUrl, resolvePyqFigureHtml } from "./pyqFigures";
import { PYQ_SAMPLE_FIGURES } from "./fixtures/lawsOfMotionSample";
import type { PyqFigureLinkRow } from "./pyqQuestionRow";

const link = (key: string, sort_order = 0): PyqFigureLinkRow => ({
  role: "question_body",
  sort_order,
  figures: PYQ_SAMPLE_FIGURES.find((f) => f.figure_key === key) ?? null,
});

describe("pyq figures", () => {
  it("builds a public Storage URL from storage_path", () => {
    // vitest.config.ts sets NEXT_PUBLIC_SUPABASE_URL to http://127.0.0.1:54321
    expect(pyqFigurePublicUrl({ storage_path: "pyq/physics/figures/p047_x101.png", public_url: null })).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/pyq/physics/figures/p047_x101.png"
    );
    expect(PYQ_FIGURE_BUCKET).toBe("pyq");
  });

  it("prefers a stored public_url when the row has one", () => {
    const stored = PYQ_SAMPLE_FIGURES.find((f) => f.public_url !== null)!;
    expect(pyqFigurePublicUrl(stored)).toBe(stored.public_url);
  });

  it("prefixes the bucket when storage_path omits it", () => {
    expect(pyqFigurePublicUrl({ storage_path: "physics/figures/x.png", public_url: null })).toContain(
      "/public/pyq/physics/figures/x.png"
    );
  });

  it("replaces a placeholder with an img carrying src, alt and class only", () => {
    const html = resolvePyqFigureHtml("Block shown [[fig:p047_x101]]", [link("p047_x101")]);
    expect(html).toContain("<img");
    expect(html).toContain('class="nta-mock-img"');
    expect(html).toContain("p047_x101.png");
    expect(html).toContain("Block on a rough inclined plane");
    expect(html).not.toContain("[[fig:");
    expect(html).not.toContain("loading=");
    expect(html).not.toContain("onerror");
  });

  it("drops an unknown placeholder rather than showing it to a student", () => {
    const html = resolvePyqFigureHtml("See [[fig:p999_x000]] here", []);
    expect(html).not.toContain("[[fig:");
    expect(html).not.toContain("p999_x000");
    expect(html).toContain("See");
  });

  it("appends question_body figures the body never referenced", () => {
    const html = resolvePyqFigureHtml("No placeholder in this stem.", [
      link("p052_x318", 1),
      link("p047_x101", 0),
    ]);
    const first = html.indexOf("p047_x101");
    const second = html.indexOf("p052_x318");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
  });

  it("does not append a figure the body already referenced", () => {
    const html = resolvePyqFigureHtml("[[fig:p047_x101]]", [link("p047_x101")]);
    expect(html.match(/p047_x101/g)).toHaveLength(1);
  });

  it("ignores option and match-list figures in the stem", () => {
    const html = resolvePyqFigureHtml("Stem only.", [
      { role: "option", sort_order: 0, figures: PYQ_SAMPLE_FIGURES[0]! },
    ]);
    expect(html).not.toContain("<img");
  });

  it("escapes quotes in alt text", () => {
    const html = resolvePyqFigureHtml("[[fig:k]]", [
      {
        role: "question_body",
        sort_order: 0,
        figures: { figure_key: "k", storage_path: "pyq/a.png", public_url: null, alt_text: 'a "quoted" label' },
      },
    ]);
    expect(html).toContain("&quot;quoted&quot;");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/chapter-pyq/pyqFigures.test.ts`

Expected: FAIL — `Cannot find module './pyqFigures'`.

- [ ] **Step 3: Write the figure module**

Create `lib/chapter-pyq/pyqFigures.ts`:

```ts
import type { PyqFigureLinkRow, PyqFigureRow } from "@/lib/chapter-pyq/pyqQuestionRow";

/** `pyq_figures.storage_path` includes this as its first segment. The bucket is public. */
export const PYQ_FIGURE_BUCKET = "pyq";

const FIG_PLACEHOLDER_RE = /\[\[fig:([a-zA-Z0-9_]+)\]\]/g;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function pyqFigurePublicUrl(
  figure: Pick<PyqFigureRow, "storage_path" | "public_url">
): string {
  const stored = figure.public_url?.trim();
  if (stored) return stored;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const path = figure.storage_path.replace(/^\/+/, "");
  const withBucket = path.startsWith(`${PYQ_FIGURE_BUCKET}/`)
    ? path
    : `${PYQ_FIGURE_BUCKET}/${path}`;
  return `${base}/storage/v1/object/public/${withBucket}`;
}

/**
 * Emits only `src`, `alt` and `class` — the attributes `sanitizeMockHtml` allows.
 * `patchMockHtmlImages` adds `loading` / `decoding` / `referrerpolicy` after sanitize.
 */
function imgTag(figure: PyqFigureRow): string {
  const alt = escapeAttr(figure.alt_text ?? figure.figure_key);
  return `<img src="${escapeAttr(pyqFigurePublicUrl(figure))}" alt="${alt}" class="nta-mock-img">`;
}

/**
 * Turns `[[fig:KEY]]` placeholders in a question body into `<img>` tags, then
 * appends any `question_body` figure the body never referenced — the ingestion
 * pipeline links figures independently of placeholder text, and a silently
 * dropped free-body diagram makes a question unanswerable.
 */
export function resolvePyqFigureHtml(body: string, links: PyqFigureLinkRow[]): string {
  const stemFigures = links
    .filter((l) => l.role === "question_body" && l.figures)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((l) => l.figures as PyqFigureRow);

  const byKey = new Map(stemFigures.map((f) => [f.figure_key, f]));
  const used = new Set<string>();

  const withPlaceholders = String(body ?? "").replace(FIG_PLACEHOLDER_RE, (_full, key: string) => {
    const figure = byKey.get(key);
    if (!figure) return "";
    used.add(key);
    return imgTag(figure);
  });

  const trailing = stemFigures.filter((f) => !used.has(f.figure_key)).map(imgTag);
  return trailing.length > 0
    ? `${withPlaceholders.trim()}<p>${trailing.join("")}</p>`
    : withPlaceholders;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/chapter-pyq/pyqFigures.test.ts`

Expected: PASS — 9 tests.

- [ ] **Step 5: Write the failing `patchMockHtmlImages` test**

Create `lib/mock/mockRichTextKatex.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SUPABASE_PUBLIC_OBJECT_RE, patchMockHtmlImages } from "./mockRichTextKatex";

const STORAGE_URL =
  "https://kmnqvqoyjjbovtaqozfc.supabase.co/storage/v1/object/public/pyq/physics/figures/p047_x101.png";

describe("patchMockHtmlImages", () => {
  it("still proxies legacy testbee images", () => {
    const out = patchMockHtmlImages(
      '<img src="https://testbee.in/preview/show_qimage/abc.png">'
    );
    expect(out).toContain("/api/mock/question-image?url=");
    expect(out).toContain("nta-mock-img");
  });

  it("recognises a Supabase public Storage object", () => {
    expect(SUPABASE_PUBLIC_OBJECT_RE.test(STORAGE_URL)).toBe(true);
    expect(SUPABASE_PUBLIC_OBJECT_RE.test("https://evil.example.com/a.png")).toBe(false);
  });

  it("serves Supabase Storage figures directly, never through the proxy", () => {
    const out = patchMockHtmlImages(`<img src="${STORAGE_URL}" alt="fbd" class="nta-mock-img">`);
    expect(out).toContain(`src="${STORAGE_URL}"`);
    expect(out).not.toContain("/api/mock/question-image");
  });

  it("adds the render attributes Storage figures need", () => {
    const out = patchMockHtmlImages(`<img src="${STORAGE_URL}" alt="fbd" class="nta-mock-img">`);
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('decoding="async"');
    expect(out).toContain("nta-mock-img");
    expect(out).toContain('alt="fbd"');
  });

  it("leaves an unknown absolute src alone apart from the render attributes", () => {
    const out = patchMockHtmlImages('<img src="https://cdn.example.com/x.png">');
    expect(out).toContain('src="https://cdn.example.com/x.png"');
    expect(out).not.toContain("/api/mock/question-image");
  });

  it("does not double up an existing class or attribute", () => {
    const out = patchMockHtmlImages(
      `<img src="${STORAGE_URL}" class="nta-mock-img" loading="eager">`
    );
    expect(out.match(/nta-mock-img/g)).toHaveLength(1);
    expect(out.match(/loading=/g)).toHaveLength(1);
    expect(out).toContain('loading="eager"');
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run lib/mock/mockRichTextKatex.test.ts`

Expected: FAIL — `SUPABASE_PUBLIC_OBJECT_RE` is not exported.

- [ ] **Step 7: Wire Storage into `patchMockHtmlImages`**

In `lib/mock/mockRichTextKatex.ts`, after the `TESTBEE_QIMAGE_RE` declaration (line 95–96), add:

```ts
/**
 * First-party Supabase Storage public objects — Chapter PYQ figures live at
 * `pyq/physics/figures/`. These are served directly: they are our own origin,
 * so the `/api/mock/question-image` proxy (which exists only to work around
 * Testbee's hotlink behaviour) must not swallow them.
 */
export const SUPABASE_PUBLIC_OBJECT_RE =
  /^https?:\/\/(?:[a-z0-9-]+\.supabase\.co|127\.0\.0\.1(?::\d+)?|localhost(?::\d+)?)\/storage\/v1\/object\/public\/[A-Za-z0-9._~/-]+\.(?:png|jpe?g|gif|webp)$/i;
```

Then inside `patchMockHtmlImages`, guard the normalisation that currently rewrites every src, so a first-party Storage URL is never touched. Replace lines 105–107:

```ts
    if (src.startsWith("//")) src = `https:${src}`;
    if (!/^https?:\/\//i.test(src)) src = `https://${src}`;
    src = src.replace(/^https:\/\/testbee\.in\//i, "https://www.testbee.in/");
```

with:

```ts
    const isSupabaseObject = SUPABASE_PUBLIC_OBJECT_RE.test(src);
    if (!isSupabaseObject) {
      if (src.startsWith("//")) src = `https:${src}`;
      if (!/^https?:\/\//i.test(src)) src = `https://${src}`;
      src = src.replace(/^https:\/\/testbee\.in\//i, "https://www.testbee.in/");
    }
```

Everything after that — the class, `referrerpolicy`, `loading`, `decoding` additions and the `TESTBEE_QIMAGE_RE` proxy rewrite — stays exactly as it is. The proxy branch already cannot match a Storage URL, and the guard stops the `https://` coercion from mangling a local `http://127.0.0.1:54321` dev URL.

- [ ] **Step 8: Run both figure test files and the whole suite**

Run: `npx vitest run lib/mock/mockRichTextKatex.test.ts lib/chapter-pyq/pyqFigures.test.ts`

Expected: PASS — 6 + 9 tests.

Run: `npx vitest run`

Expected: PASS — full suite.

Manual check: with `npm run dev`, open a mock paper that has a Testbee image and confirm it still renders through `/api/mock/question-image` (Network tab).

- [ ] **Step 9: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/pyqFigures.ts lib/chapter-pyq/pyqFigures.test.ts lib/mock/mockRichTextKatex.ts lib/mock/mockRichTextKatex.test.ts
git commit -m "Render Chapter PYQ figure placeholders from Supabase Storage."
```

---

### Task 10: Wire `ChapterPyqPracticeView`

**Files:**
- Modify: `components/chapter-pyq/ChapterPyqPracticeView.tsx` (replaces the `Questions coming soon` paragraph, line 43)

**Interfaces:**
- Consumes: `findChapter`, `CHAPTER_PYQ_SUBJECTS` (already imported); `fetchChapterPyqQuestions` (Task 4); `ChapterPyqQuestion` (Task 5); `filterByTier`, `countByTier`, `PyqTierFilter` (Task 8); `buildPyqSets`, `secondsForSet` (Task 7); `ChapterPyqTierFilter` (Task 8); `ChapterPyqExamSession` (Task 7)
- Produces: no new exports — this is the last wiring step

**The empty state stays.** It is still the correct render for a chapter with zero publishable questions, which during the pilot is 28 of 29 physics chapters and — permanently, until the Electrostatics split is solved — `electric-charges-and-fields`. Only the wording changes so it is honest rather than a placeholder.

- [ ] **Step 1: Replace the body of the practice view**

Keep the existing `Chapter not found` branch (lines 17–26) and the header (lines 33–41) verbatim. Replace the `<p className="mt-8 …">Questions coming soon</p>` line with the loading / empty / pre-start / in-session states:

```tsx
  const [entries, setEntries] = useState<ChapterPyqQuestion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tier, setTier] = useState<PyqTierFilter>("all");
  const [activeSetIndex, setActiveSetIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setEntries(null);
    setLoadError(null);
    void fetchChapterPyqQuestions(entry.slug)
      .then((bundle) => {
        if (!cancelled) setEntries(bundle?.questions ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setEntries([]);
        setLoadError(e instanceof Error ? e.message : "Could not load questions.");
      });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const filtered = useMemo(() => filterByTier(entries ?? [], tier), [entries, tier]);
  const sets = useMemo(() => buildPyqSets(filtered), [filtered]);
  const counts = useMemo(() => countByTier(entries ?? []), [entries]);
```

Order inside the component body matters, because React forbids conditional hooks. The current file computes `entry` (line 15), returns early when it is null (lines 17–26), then computes `subjectLabel` (lines 28–29). Reorder to: `const entry = findChapter(...)` → all four `useState` calls → the `useEffect` (guarded by `if (!entry) return;`) → the three `useMemo` calls → the `if (!entry)` early return → `subjectLabel`. The early return moves *below* every hook; its JSX is unchanged.

Then, in place of the removed paragraph:

```tsx
        {activeSetIndex !== null && sets[activeSetIndex] ? (
          <ChapterPyqExamSession
            chapterName={entry.name}
            subjectLabel={subjectLabel}
            questions={sets[activeSetIndex]}
            setLabel={`Set ${activeSetIndex + 1} of ${sets.length}`}
            onExit={() => setActiveSetIndex(null)}
          />
        ) : entries === null ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading questions…</p>
        ) : entries.length === 0 ? (
          <div className="mt-8 space-y-2">
            <p className="font-bold text-foreground">No questions yet</p>
            <p className="text-sm text-muted-foreground">
              {loadError ?? "Previous year questions for this chapter are still being prepared."}
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            <ChapterPyqTierFilter value={tier} counts={counts} onChange={setTier} />
            <p className="text-sm text-muted-foreground">
              {filtered.length} questions · {sets.length} {sets.length === 1 ? "set" : "sets"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {sets.map((set, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveSetIndex(i)}
                  className="rounded-xl border border-border/50 bg-card/30 p-4 text-left transition-colors hover:border-primary/40 hover:bg-card/50"
                >
                  <span className="block font-bold text-foreground">Set {i + 1}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {set.length} questions · {Math.round(secondsForSet(set.length) / 60)} min
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
```

Add the imports at the top of the file: `useEffect`, `useMemo`, `useState` from `react`; `fetchChapterPyqQuestions`; `type ChapterPyqQuestion`; `filterByTier`, `countByTier`, `type PyqTierFilter`; `buildPyqSets`, `secondsForSet`; `ChapterPyqTierFilter`; `ChapterPyqExamSession`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "chapter-pyq"`

Expected: no output.

- [ ] **Step 3: Run the whole suite**

Run: `npx vitest run`

Expected: PASS. Every new `lib/chapter-pyq/*.test.ts` file plus `lib/mock/mockRichTextKatex.test.ts` and the pre-existing suites.

- [ ] **Step 4: Manual verification against the fixture**

Until the ingestion pipeline has run, point the API at the fixture to exercise the UI. In `app/api/chapter-pyq/questions/route.ts`, temporarily replace the `fetchPyqRowsForCatalogChapter(supabase, chapter)` call with

```ts
const rows = LAWS_OF_MOTION_SAMPLE_ROWS.filter((r) => r.chapters?.catalog_slug === chapter);
```

(importing `LAWS_OF_MOTION_SAMPLE_ROWS` and `filterPublishableRows`, wrapping in `sortPyqRows(filterPublishableRows(rows))`). Then run `npm run dev` and check, in order:

1. `/chapter-pyq` → Physics tab → `Laws of Motion` shows `6 questions`, `Units and Measurements` shows `3 questions`, every other chapter shows `0 questions`.
2. `/chapter-pyq/physics/laws-of-motion` → tier chips read `All · 6`, `Must Do · 3`, `Concept Builder · 1`, `Advanced · 2`; one set of 6 questions, 12 min.
3. Selecting `Advanced` re-splits to one set of 2 questions, 4 min. Selecting `Concept Builder` gives 1 question, 2 min.
4. Start the set. Q1 shows four options; Q3 (the numerical) shows the **Answer** box and no options. Type `12` → palette square turns answered. `Clear` empties both the box and the palette state.
5. Q2 renders its free-body diagram. The stem never shows `[[fig:`.
6. Submit → score counts the numerical as correct for `12` and wrong for `12.5`.
7. `/chapter-pyq/physics/units-and-measurements` shows all three questions with two distinct coarse labels (`Units and Dimensions`, `Experimental Physics`).
8. `/chapter-pyq/physics/electric-charges-and-fields` shows **No questions yet**.
9. `/chapter-pyq/physics/capacitance` shows **Chapter not found** — there is no route for a merged-away PDF chapter.
10. The `unreviewed`, `skeleton_only` and `flagged` fixture rows never appear anywhere.

**Revert the temporary fixture wiring before finishing the task.** The route must call `fetchPyqRowsForCatalogChapter` again.

- [ ] **Step 5: Commit (only if the user asked)**

```bash
git add components/chapter-pyq/ChapterPyqPracticeView.tsx
git commit -m "Wire real questions into the Chapter PYQ practice page."
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Physics 28 → 29 (`Communication System` last, syllabus order kept) | 1 |
| Mathematics in Physics / Experimental Physics become topics | 2 |
| All 32 PDF-chapter mapping rows | 2 |
| Merge rule: several PDF chapters → one catalog page | 2, 4, 5 |
| `pyq_chapters.catalog_slug` deliberately non-unique | 4 (`chapters.catalog_slug` eq on the aliased embed, no `maybeSingle`) |
| Two label levels (`pyq_chapters.name` coarse, `pyq_topics.name` fine) | 5 |
| PDF chapter 17 deferred; `electric-charges-and-fields` has no source | 2, 10 |
| No chapter page or route for a merged-away PDF chapter | 2 (test), 10 (manual step 9) |
| Publishing gate `auto_ok` / `human_ok` | 3, 4 |
| `pyq_` table prefix; every embed aliased so the JSON keys stay unprefixed | 3 (`PYQ_QUESTION_SELECT`), 4 (both queries) |
| Chapter card count = publishable count; `CHAPTER_PYQ_QUESTION_COUNT` removed | 4 |
| Reuse `NtaExamShell` / `NtaExamShellMobile` / `ntaExamParts` / KaTeX unchanged | 6, 7 |
| `MockPageContent` not reused; new thin `ChapterPyqExamSession` | 7 |
| Numeric answer input + answer-comparison path; no fabricated options | 5, 6 |
| Tier filter + per-question badge | 6 (badge prop), 8 (filter) |
| Set count `max(1, round(total/25))`, sizes differ by ≤ 1, no stubs | 7 |
| Worked examples 132 / 79 / 29 / 24 | 7, 8 |
| Timer 2 min per question in the set | 7 |
| Figures from Supabase Storage wired into `patchMockHtmlImages` | 9 |
| `[[fig:KEY]]` → `<img>`, homed in `lib/chapter-pyq/pyqFigures.ts` | 9 |
| Scoring: one MCQ and one numerical each score correctly | 5 (test), 10 (manual step 6) |
| Unbuilt chapters keep an empty state | 10 |
| Tests in existing Vitest `describe`/`it` style under `lib/` | all |
| Schema migration, Phases 2–9, `pymupdf` pin, figure-key collision | **Out of scope** — sibling ingestion plan |
| Worked solutions, Electrostatics split, mid-session resume, Chemistry/Maths PDFs | **Non-goals** per the spec |

## Placeholder scan

- No TBD, TODO, "implement later", or "similar to Task N" steps. Every code step carries the code.
- No step says "add error handling" or "handle edge cases" without showing it.
- Commit steps are all gated on explicit user request, per the repo rule.
- **Cross-task consistency checks run:**
  - `answers: Record<string, number>` is stated identically in "The numerical decision", Task 5 (`isPyqAnswerCorrect(q, answer: number | undefined)`), Task 6 (props table — no widening) and Task 7 (`useState<Record<string, number>>`). No task widens it.
  - A numerical question is `options: []`, `correctAnswer: -1`, `answerFormat: "numerical"`, `numericAnswer: <string>` in Task 5's mapper, Task 5's tests, Task 6's shell branch (`q.answerFormat === "numerical"`) and Task 7's scoring call. Consistent.
  - `sanitizeNumericDraft` / `commitNumericDraft` are defined once, in `lib/chapter-pyq/pyqNumericDraft.ts` (Task 6 Step 3), because the node-only Vitest config cannot import a `.tsx` file. `ntaExamParts.tsx` imports `sanitizeNumericDraft` (Task 6 Step 5) and Task 7 imports `commitNumericDraft`. Neither is redefined anywhere.
  - `resolvePyqFigureHtml(body, links)` has the same signature in Task 5's mapper call and Task 9's definition. Task 5 Step 6 and Task 7 Step 6 both name the ordering dependency.
  - `PYQ_TIER_LABEL` is defined once (Task 8) and consumed by Task 7's `questionBadges`.
  - `mapPyqRowsToChapterPyqQuestions` and `ChapterPyqQuestionBundle` are named identically in Task 4's route, Task 4's client wrapper and Task 5's definition.
  - `filterPublishableRows` / `sortPyqRows` / `tallyPublishableCounts` are defined in Task 3 and consumed in Task 4 under the same names.
  - Every database relation is named with its `pyq_` prefix and nowhere without it: `pyq_questions` in both Task 4 queries, and `pyq_chapters` / `pyq_topics` / `pyq_question_options` / `pyq_figure_links` / `pyq_figures` only inside `PYQ_QUESTION_SELECT` and the Task 4 counts select. Each embed is aliased to its unprefixed key, so `row.chapters`, `row.topics`, `row.question_options`, `row.figure_links` and `link.figures` — and the `chapters.catalog_slug` embedded filter — are unchanged across Tasks 3, 4, 5 and 9.
  - The `-1` on a numerical `correctAnswer` is documented as an out-of-range option index in "The numerical decision", Task 5's mapper comment, `pyqScoring.ts`'s docstring and Task 5's two sentinel tests. No place claims it is unreachable; the guarantee everywhere is the `answerFormat` branch.
- **Global Constraints consistency:** no task modifies `MockPageContent`; all three new shell props are optional; no task alphabetises `PHYSICS_NAMES`; no task fabricates numerical options; no task touches EduDeca or EduBite; no command uses `&&`; every commit step is conditional.
- **Known ordering dependencies** (stated inline, not left implicit): Task 5 needs Task 9's `resolvePyqFigureHtml`; Task 7 needs Task 8's `PYQ_TIER_LABEL`; Task 4's typecheck needs Task 5's mapper. If executing strictly in order, run Task 9 Steps 1–4 and Task 8 Steps 1–4 before Task 5 Step 6 and Task 7 Step 6 respectively, or accept a failing typecheck until the later task lands.
