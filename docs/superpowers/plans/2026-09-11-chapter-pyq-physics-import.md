# Chapter PYQ Physics Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land real JEE Main Physics previous-year questions in `/chapter-pyq/physics/laws-of-motion`, proven end to end on one chapter, so a signed-in student can filter by tier, sit a timed set, and be scored.

**Architecture:** Two halves that meet at one Postgres schema. The ingestion half is Python in `c:\Users\tempo\Downloads\files` running the spec's phases 2–9 against the already-built `skeleton.json`, writing into the Web Supabase project and a public `pyq` Storage bucket. The app half is pure TypeScript in `Web/`: a PDF-chapter-to-catalog map, a row-to-`Question` mapper, a balanced set splitter, an additive numeric-answer mode on the existing NTA shells, and a thin `ChapterPyqExamSession` orchestrator. The app half is testable against a hand-seeded SQL fixture (Task 10) so no UI work waits on the model phases.

**Tech Stack:** Next.js App Router, TypeScript, Vitest 3, Supabase Postgres 17 + Supabase Storage, the existing KaTeX/sanitize pipeline under `Web/lib/mock/`, Python 3.14.7 with `pymupdf==1.26.3`, Sarvam for extraction and solve-verify.

**Source of truth:** [`2026-09-11-chapter-pyq-physics-import-design.md`](../specs/2026-09-11-chapter-pyq-physics-import-design.md). Predecessor plan: [`2026-09-11-chapter-pyq.md`](./2026-09-11-chapter-pyq.md).

## Global Constraints

- Web only. Do not touch EduDeca or EduBite.
- JEE Main Physics only. Pilot chapter is Laws of Motion (PDF chapter 5, 132 questions, pages 47–60).
- `skeleton.json` is immutable. No stage may add, remove, renumber, or re-link a question. Models fill `body` and `options` only.
- Whitelist enforcement at the parser: reject any model response containing an unknown `q_no` or `figure_key`, and retry that page. Never write unknown keys to the database.
- Never run layout-detection models (Docling, Surya, LayoutParser) on this PDF. Glyph coordinates are already available.
- Never base64 an image into a Postgres column. Store the storage path only.
- Retries escalate to a different model. Re-running the same model is not verification.
- Quote no accuracy number that was not measured against the Phase 8 gold sample.
- `pymupdf==1.26.3`. Later versions are blocked by Windows Smart App Control on this machine.
- Students see only `review_status in ('auto_ok','human_ok')`. Counts use the same filter.
- Commit only when the user explicitly asks (repo rule). Skip commit steps until then.
- Follow existing Vitest `describe`/`it` style under `lib/`.

All app commands run from `c:\Users\tempo\Downloads\EduBlast\Web`. All Python commands run from `c:\Users\tempo\Downloads\files` using `C:\Python314\python.exe`.

## File map

| File | Responsibility |
|------|----------------|
| `Web/supabase/migrations/20261019120000_chapter_pyq_question_bank.sql` | Question-bank schema, three spec corrections, RLS, `pyq` Storage bucket |
| `Web/lib/chapter-pyq/catalog.ts` | Physics 28 → 29 chapters; drop the hardcoded question count |
| `Web/lib/chapter-pyq/catalog.test.ts` | Catalog counts and syllabus ordering |
| `Web/lib/chapter-pyq/pdfChapterMap.ts` | All 32 PDF chapters → catalog chapter names/slugs; merges; deferred chapter 17 |
| `Web/lib/chapter-pyq/pdfChapterMap.test.ts` | Mapping invariants |
| `Web/lib/chapter-pyq/tiers.ts` | `concept_builder` / `must_do` / `advanced` vocabulary, labels, filter |
| `Web/lib/chapter-pyq/pyqQuestionMap.ts` | DB row → app `Question`, figure placeholders → `<img>`, no fabricated options |
| `Web/lib/chapter-pyq/pyqQuestionMap.test.ts` | Mapper behaviour |
| `Web/lib/chapter-pyq/sessionSets.ts` | Balanced set splitting and timer sizing |
| `Web/lib/chapter-pyq/sessionSets.test.ts` | The spec's four worked examples |
| `Web/lib/chapter-pyq/figureUrl.ts` | `figure_key` → storage path → public URL |
| `Web/lib/chapter-pyq/figureUrl.test.ts` | Path and URL construction |
| `Web/lib/chapter-pyq/numericAnswer.ts` | Numeric answer normalise + compare |
| `Web/lib/chapter-pyq/numericAnswer.test.ts` | Comparison rules |
| `Web/lib/chapter-pyq/fetchChapterPyqQuestions.ts` | Publishable questions for a catalog slug; per-chapter counts |
| `Web/lib/chapter-pyq/fetchChapterPyqQuestions.test.ts` | Query shape against a stub client |
| `Web/lib/mock/mockRichTextKatex.ts` | `patchMockHtmlImages` also resolves `pyq/physics/figures/…` |
| `Web/lib/mock/mockRichTextKatex.test.ts` | New PYQ cases; Testbee behaviour unchanged |
| `Web/components/prep-mock/nta/ntaExamParts.tsx` | `computeNtaLegendCounts` counts numeric answers |
| `Web/components/prep-mock/nta/NtaExamShell.tsx` | Additive numeric-answer mode |
| `Web/components/prep-mock/nta/NtaExamShellMobile.tsx` | Additive numeric-answer mode |
| `Web/components/chapter-pyq/ChapterPyqNumericPad.tsx` | Shared numeric keypad |
| `Web/components/chapter-pyq/ChapterPyqExamSession.tsx` | Set picker, timer, answer/flag state, shell wiring, results |
| `Web/components/chapter-pyq/ChapterPyqTierFilter.tsx` | Tier chips and per-question badge |
| `Web/components/chapter-pyq/ChapterPyqPracticeView.tsx` | Replace the empty state with the real flow |
| `Web/components/chapter-pyq/ChapterPyqListView.tsx` | Live publishable counts on cards |
| `Web/scripts/seed-chapter-pyq-fixture.sql` | Six hand-written Laws of Motion rows for local UI work |
| `files/requirements.txt` | The `pymupdf==1.26.3` pin and the rest of the Python deps |
| `files/load_storage.py` | Phase 2 — expected counts, figure dedupe, upload, skeleton insert |
| `files/resolve_orphans.py` | Phase 3 — orphan attachment and `exam_date` repair |
| `files/bakeoff.py` | Phase 4 — model bake-off over six pages |
| `files/extract_pass.py` | Phases 5 and 6 — constrained extraction and second observer |
| `files/solve_verify.py` | Phase 7 — answer verification |
| `files/gold_sample.py` | Phase 8 — gold sample review page and accuracy report |
| `files/review_queue.py` | Phase 9 — review queue build and publish |

`files/` is shorthand for `c:\Users\tempo\Downloads\files`. It is outside all three apps, so writing there does not violate the Web-only constraint.

---

### Task 1: Question-bank schema migration

**Files:**
- Create: `Web/supabase/migrations/20261019120000_chapter_pyq_question_bank.sql`

**Interfaces:**
- Consumes: nothing
- Produces: tables `subjects`, `units`, `chapters`, `topics`, `questions`, `question_options`, `figures`, `figure_links`, `ingestion_runs`; view `v_ingestion_check` with columns `chapter_no, name, expected, actual, missing_answer, flagged, delta`; enums `question_tier('concept_builder','must_do','advanced')`, `question_format('mcq','numerical','match_list','assertion_reason','statement')`, `pyq_exam_shift('morning','evening')`, `figure_role('question_body','option','match_list_item')`; public Storage bucket `pyq`

Four deliberate deviations from `files/schema.sql`, all of them stated here so a reviewer does not have to diff by eye:

1. `questions.body` is nullable — spec correction 1.
2. `review_status` gains a `CHECK` over the five documented values and a `COMMENT` naming them — spec correction 2. `schema.sql` documented the list in a trailing comment only.
3. `chapters.catalog_slug text` is added with a **non-unique** index — spec correction 3. Several `chapters` rows share one slug when PDF chapters merge; `unique (chapter_no)` keeps rows distinct.
4. `schema.sql` writes `primary key (figure_id, question_id, coalesce(option_id, …))` on `figure_links`. Postgres does not allow expressions in a primary key, so that DDL cannot execute. This migration uses a surrogate `id` primary key plus a unique index on the same expression, which preserves the intent. The `embedding vector(768)` column and the `vector` extension are dropped as out of scope (semantic search is not in the spec); the shift enum is renamed `pyq_exam_shift` so a type and a column no longer share the name `exam_shift`.

The filename timestamp is **later than the last existing migration** (`20261018140000_teacher_welcome_rdm_just_stamped_rows.sql`). `supabase db push` refuses migrations that sort before an already-applied version, so do not date this file 2026-09-11.

- [ ] **Step 1: Write the migration**

Create `Web/supabase/migrations/20261019120000_chapter_pyq_question_bank.sql`:

```sql
-- JEE Main PYQ question bank (MathonGo Physics book) for /chapter-pyq.
-- Mirrors c:\Users\tempo\Downloads\files\schema.sql with the design spec's
-- corrections: questions.body nullable, 'skeleton_only' a documented
-- review_status, and chapters.catalog_slug (deliberately NOT unique).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.question_tier AS ENUM ('concept_builder', 'must_do', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.question_format AS ENUM
    ('mcq', 'numerical', 'match_list', 'assertion_reason', 'statement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pyq_exam_shift AS ENUM ('morning', 'evening');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.figure_role AS ENUM ('question_body', 'option', 'match_list_item');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.subjects (
  id    smallserial PRIMARY KEY,
  name  text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.units (
  id          smallserial PRIMARY KEY,
  subject_id  smallint NOT NULL REFERENCES public.subjects(id),
  name        text NOT NULL,
  sort_order  smallint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chapters (
  id          smallserial PRIMARY KEY,
  unit_id     smallint NOT NULL REFERENCES public.units(id),
  chapter_no  smallint NOT NULL,
  name        text NOT NULL,
  expected_question_count smallint,
  catalog_slug text,
  UNIQUE (chapter_no)
);

COMMENT ON COLUMN public.chapters.catalog_slug IS
  'App catalog chapter slug this PDF chapter renders under. Deliberately NOT unique: merged PDF chapters share one slug. NULL means deferred (PDF chapter 17).';

CREATE INDEX IF NOT EXISTS chapters_catalog_slug_idx
  ON public.chapters (catalog_slug);

CREATE TABLE IF NOT EXISTS public.topics (
  id          serial PRIMARY KEY,
  chapter_id  smallint NOT NULL REFERENCES public.chapters(id),
  name        text NOT NULL,
  sort_order  smallint,
  UNIQUE (chapter_id, name)
);

CREATE TABLE IF NOT EXISTS public.questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id      smallint NOT NULL REFERENCES public.chapters(id),
  topic_id        int REFERENCES public.topics(id),
  q_no            smallint NOT NULL,
  tier            public.question_tier NOT NULL,
  format          public.question_format NOT NULL,
  body            text,
  correct_option  smallint CHECK (correct_option BETWEEN 1 AND 4),
  numerical_answer text,
  exam_date       date,
  exam_shift      public.pyq_exam_shift,
  exam_year       smallint GENERATED ALWAYS AS
                    (extract(year from exam_date)::smallint) STORED,
  out_of_syllabus boolean NOT NULL DEFAULT false,
  good_to_solve   boolean NOT NULL DEFAULT false,
  source_page     smallint NOT NULL,
  source_bbox     jsonb,
  extraction_confidence real,
  review_status   text NOT NULL DEFAULT 'unreviewed'
                    CONSTRAINT questions_review_status_check
                    CHECK (review_status IN
                      ('unreviewed', 'skeleton_only', 'auto_ok', 'flagged', 'human_ok')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, q_no)
);

COMMENT ON COLUMN public.questions.body IS
  'Markdown with inline LaTeX. NULL while review_status = ''skeleton_only''; figures referenced inline as [[fig:p047_x549]].';
COMMENT ON COLUMN public.questions.review_status IS
  'unreviewed|skeleton_only|auto_ok|flagged|human_ok. Students see auto_ok and human_ok only.';

CREATE INDEX IF NOT EXISTS questions_chapter_tier_idx ON public.questions (chapter_id, tier);
CREATE INDEX IF NOT EXISTS questions_year_shift_idx ON public.questions (exam_year, exam_shift);
CREATE INDEX IF NOT EXISTS questions_topic_idx ON public.questions (topic_id);
CREATE INDEX IF NOT EXISTS questions_unpublished_idx
  ON public.questions (review_status) WHERE review_status <> 'human_ok';

CREATE TABLE IF NOT EXISTS public.question_options (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_index  smallint NOT NULL CHECK (option_index BETWEEN 1 AND 4),
  body          text,
  UNIQUE (question_id, option_index)
);

CREATE TABLE IF NOT EXISTS public.figures (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  figure_key    text NOT NULL UNIQUE,
  storage_path  text NOT NULL,
  public_url    text,
  px_width      int,
  px_height     int,
  bytes         int,
  checksum      text,
  source_page   smallint NOT NULL,
  source_bbox   jsonb NOT NULL,
  alt_text      text
);

COMMENT ON COLUMN public.figures.figure_key IS
  'p{page:03d}_x{xref} from the PDF xref, e.g. p047_x549.';
COMMENT ON COLUMN public.figures.storage_path IS
  'bucket/object, e.g. pyq/physics/figures/p047_x549. Never store image bytes in Postgres.';

CREATE TABLE IF NOT EXISTS public.figure_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  figure_id     uuid NOT NULL REFERENCES public.figures(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_id     uuid REFERENCES public.question_options(id) ON DELETE CASCADE,
  role          public.figure_role NOT NULL,
  sort_order    smallint DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS figure_links_unique_idx
  ON public.figure_links
     (figure_id, question_id,
      coalesce(option_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS figure_links_question_idx ON public.figure_links (question_id);

CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file     text NOT NULL,
  model_used      text,
  pages_processed int,
  questions_written int,
  figures_written int,
  cost_usd        numeric(10,4),
  started_at      timestamptz DEFAULT now(),
  finished_at     timestamptz,
  notes           jsonb
);

CREATE OR REPLACE VIEW public.v_ingestion_check AS
SELECT
  c.chapter_no,
  c.name,
  c.expected_question_count AS expected,
  count(q.id)               AS actual,
  count(q.id) FILTER (WHERE q.correct_option IS NULL
                        AND q.numerical_answer IS NULL) AS missing_answer,
  count(q.id) FILTER (WHERE q.review_status = 'flagged') AS flagged,
  c.expected_question_count - count(q.id) AS delta
FROM public.chapters c
LEFT JOIN public.questions q ON q.chapter_id = c.id
GROUP BY c.id, c.chapter_no, c.name, c.expected_question_count
ORDER BY c.chapter_no;

-- Publishing gate at the database, not only in the client query.
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.figures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.figure_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ingestion_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ingestion_runs TO service_role;

DROP POLICY IF EXISTS pyq_subjects_select ON public.subjects;
CREATE POLICY pyq_subjects_select
  ON public.subjects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pyq_units_select ON public.units;
CREATE POLICY pyq_units_select
  ON public.units FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pyq_chapters_select ON public.chapters;
CREATE POLICY pyq_chapters_select
  ON public.chapters FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pyq_topics_select ON public.topics;
CREATE POLICY pyq_topics_select
  ON public.topics FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pyq_figures_select ON public.figures;
CREATE POLICY pyq_figures_select
  ON public.figures FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pyq_questions_select_published ON public.questions;
CREATE POLICY pyq_questions_select_published
  ON public.questions FOR SELECT TO authenticated
  USING (review_status IN ('auto_ok', 'human_ok'));

DROP POLICY IF EXISTS pyq_question_options_select_published ON public.question_options;
CREATE POLICY pyq_question_options_select_published
  ON public.question_options FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id = question_options.question_id
      AND q.review_status IN ('auto_ok', 'human_ok')
  ));

DROP POLICY IF EXISTS pyq_figure_links_select_published ON public.figure_links;
CREATE POLICY pyq_figure_links_select_published
  ON public.figure_links FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.id = figure_links.question_id
      AND q.review_status IN ('auto_ok', 'human_ok')
  ));

-- Public read bucket. Object names are pyq/physics/figures/<figure_key>, so a
-- figures.storage_path of 'pyq/physics/figures/p047_x549' is bucket + object.
INSERT INTO storage.buckets (id, name, public)
VALUES ('pyq', 'pyq', true)
ON CONFLICT (id) DO UPDATE SET public = true;
```

- [ ] **Step 2: Apply the migration**

Run from `Web`: `npm run supabase:push`

Expected: `Applying migration 20261019120000_chapter_pyq_question_bank.sql...` then `Finished supabase db push.` No other migration is re-applied.

- [ ] **Step 3: Verify the schema landed**

Run this SQL against the Web project (`TestBee`, ref `bytsiknhtcnlxwzgqkrd`) in the Supabase SQL editor:

```sql
SELECT is_nullable FROM information_schema.columns
  WHERE table_name = 'questions' AND column_name = 'body';
SELECT count(*) AS non_unique_catalog_slug_indexes
  FROM pg_indexes WHERE tablename = 'chapters' AND indexname = 'chapters_catalog_slug_idx';
SELECT pg_get_constraintdef(oid) FROM pg_constraint
  WHERE conname = 'questions_review_status_check';
SELECT count(*) FROM v_ingestion_check;
SELECT public FROM storage.buckets WHERE id = 'pyq';
```

Expected: `is_nullable = YES`; one index row; the constraint definition lists all five statuses including `skeleton_only`; `v_ingestion_check` returns `0` (no chapters yet) without erroring; bucket `public = true`.

- [ ] **Step 4: Confirm no unique constraint snuck onto `catalog_slug`**

```sql
SELECT indexdef FROM pg_indexes
  WHERE tablename = 'chapters' AND indexdef ILIKE '%catalog_slug%';
```

Expected: exactly one row, and it does **not** contain `UNIQUE`. If it does, the merge rule breaks — drop and recreate it non-unique.

- [ ] **Step 5: Commit (only if the user asked)**

```bash
git add Web/supabase/migrations/20261019120000_chapter_pyq_question_bank.sql
git commit -m "Add PYQ question bank schema for Chapter PYQ imports."
```

---

### Task 2: Catalog — physics 28 → 29 chapters

**Files:**
- Modify: `Web/lib/chapter-pyq/catalog.ts` (the `PHYSICS_NAMES` array, lines 53–82; `CHAPTER_PYQ_QUESTION_COUNT`, line 11)
- Test: `Web/lib/chapter-pyq/catalog.test.ts`

**Interfaces:**
- Consumes: `slugify` from `Web/lib/slugs.ts`
- Produces: `chaptersForSubject("physics")` returns 29 entries ending in `{ name: "Communication System", slug: "communication-system" }`; `CHAPTER_PYQ_QUESTION_COUNT` is removed

`PHYSICS_NAMES` is syllabus-ordered, not alphabetical. `Communication System` goes **last**, after `Semiconductor Electronics`, which also matches the PDF's chapter order. Do not sort the array.

`CHAPTER_PYQ_QUESTION_COUNT = 0` is deleted here rather than in Task 11 so the compiler lists every call site in one pass. Its two consumers are `ChapterPyqListView.tsx` (line 81) and `catalog.test.ts` (line 73); Task 11 replaces the view's usage with live counts. Until then, have the list view render the string `—` in that slot so the build stays green.

- [ ] **Step 1: Update the failing test first**

In `Web/lib/chapter-pyq/catalog.test.ts`, drop `CHAPTER_PYQ_QUESTION_COUNT` from the import list and from the `filterChapters` test body, then replace the last `it` block with:

```ts
  it("has 29 physics and 20 chemistry chapters", () => {
    expect(chaptersForSubject("physics")).toHaveLength(29);
    expect(chaptersForSubject("chemistry")).toHaveLength(20);
    expect(CHAPTER_PYQ_CHAPTERS).toHaveLength(31 + 29 + 20);
  });

  it("keeps physics in syllabus order with Communication System last", () => {
    const physics = chaptersForSubject("physics").map((c) => c.name);
    expect(physics[0]).toBe("Units and Measurements");
    expect(physics.at(-2)).toBe("Semiconductor Electronics");
    expect(physics.at(-1)).toBe("Communication System");
    expect(physics).not.toEqual([...physics].sort());
    expect(findChapter("physics", "communication-system")?.name).toBe("Communication System");
  });
```

The `filterChapters` test becomes:

```ts
  it("filters by chapter name", () => {
    const hits = filterChapters(chaptersForSubject("math"), "integ");
    expect(hits.map((c) => c.name)).toEqual([
      "Definite Integration",
      "Indefinite Integration",
    ]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/chapter-pyq/catalog.test.ts`

Expected: FAIL — `expected 28 to be 29` on the count test, plus a TypeScript import error for the removed `CHAPTER_PYQ_QUESTION_COUNT`.

- [ ] **Step 3: Add the chapter and drop the constant**

In `Web/lib/chapter-pyq/catalog.ts`, delete line 11 (`export const CHAPTER_PYQ_QUESTION_COUNT = 0;`) and append to `PHYSICS_NAMES` after `"Semiconductor Electronics"`:

```ts
  "Semiconductor Electronics",
  "Communication System",
] as const;
```

- [ ] **Step 4: Keep the list view compiling**

In `Web/components/chapter-pyq/ChapterPyqListView.tsx`, remove `CHAPTER_PYQ_QUESTION_COUNT` from the import and change the card meta line to a placeholder that Task 11 replaces:

```tsx
            <p className="mt-2 text-sm text-muted-foreground">Practice</p>
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run lib/chapter-pyq/catalog.test.ts`

Expected: PASS (all six tests)

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "CHAPTER_PYQ_QUESTION_COUNT"`

Expected: no output.

- [ ] **Step 6: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/catalog.ts lib/chapter-pyq/catalog.test.ts components/chapter-pyq/ChapterPyqListView.tsx
git commit -m "Add Communication System to the Chapter PYQ physics catalog."
```

---

### Task 3: PDF chapter → catalog chapter mapping

**Files:**
- Create: `Web/lib/chapter-pyq/pdfChapterMap.ts`
- Test: `Web/lib/chapter-pyq/pdfChapterMap.test.ts`

**Interfaces:**
- Consumes: `slugify` from `Web/lib/slugs.ts`; `CHAPTER_PYQ_CHAPTERS` and `findChapter` from `./catalog`
- Produces:
  - `export type PyqPdfChapter = { pdfChapterNo: number; pdfTitle: string; catalogName: string | null; catalogSlug: string | null; deferred: boolean }`
  - `export const PYQ_PHYSICS_PDF_CHAPTERS: readonly PyqPdfChapter[]` (32 rows)
  - `export const PYQ_PILOT_PDF_CHAPTER_NO = 5`
  - `export function pdfChapterByNo(pdfChapterNo: number): PyqPdfChapter | null`
  - `export function catalogSlugForPdfChapter(pdfChapterNo: number): string | null`
  - `export function pdfChaptersForCatalogSlug(catalogSlug: string): PyqPdfChapter[]`
  - `export function deferredPdfChapterNos(): number[]`

Store the catalog **name** and derive the slug with `slugify`, so the slug can never drift from the catalog. A test asserts every non-deferred `catalogName` exists in the physics catalog, which turns any typo into a failing test rather than an empty chapter page.

- [ ] **Step 1: Write the failing test**

Create `Web/lib/chapter-pyq/pdfChapterMap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findChapter } from "./catalog";
import {
  PYQ_PHYSICS_PDF_CHAPTERS,
  PYQ_PILOT_PDF_CHAPTER_NO,
  catalogSlugForPdfChapter,
  deferredPdfChapterNos,
  pdfChapterByNo,
  pdfChaptersForCatalogSlug,
} from "./pdfChapterMap";

describe("PYQ physics PDF chapter map", () => {
  it("covers PDF chapters 1..32 exactly once", () => {
    expect(PYQ_PHYSICS_PDF_CHAPTERS).toHaveLength(32);
    const nos = PYQ_PHYSICS_PDF_CHAPTERS.map((c) => c.pdfChapterNo);
    expect(nos).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  it("points every non-deferred row at a real catalog chapter", () => {
    for (const row of PYQ_PHYSICS_PDF_CHAPTERS) {
      if (row.deferred) continue;
      expect(row.catalogSlug).not.toBeNull();
      expect(findChapter("physics", row.catalogSlug!)?.name).toBe(row.catalogName);
    }
  });

  it("maps the pilot chapter 1:1", () => {
    expect(PYQ_PILOT_PDF_CHAPTER_NO).toBe(5);
    expect(pdfChapterByNo(5)?.pdfTitle).toBe("Laws of Motion");
    expect(catalogSlugForPdfChapter(5)).toBe("laws-of-motion");
    expect(pdfChaptersForCatalogSlug("laws-of-motion").map((c) => c.pdfChapterNo)).toEqual([5]);
  });

  it("collapses several PDF chapters onto one catalog slug", () => {
    expect(
      pdfChaptersForCatalogSlug("units-and-measurements").map((c) => c.pdfChapterNo)
    ).toEqual([1, 2, 32]);
    expect(
      pdfChaptersForCatalogSlug("system-of-particles-and-rotational-motion").map(
        (c) => c.pdfChapterNo
      )
    ).toEqual([7, 8]);
    expect(
      pdfChaptersForCatalogSlug("electrostatic-potential-and-capacitance").map(
        (c) => c.pdfChapterNo
      )
    ).toEqual([18]);
  });

  it("defers PDF chapter 17 and leaves Electric Charges and Fields sourceless", () => {
    expect(deferredPdfChapterNos()).toEqual([17]);
    expect(pdfChapterByNo(17)?.deferred).toBe(true);
    expect(catalogSlugForPdfChapter(17)).toBeNull();
    expect(pdfChaptersForCatalogSlug("electric-charges-and-fields")).toEqual([]);
  });

  it("returns null for an unknown PDF chapter number", () => {
    expect(pdfChapterByNo(0)).toBeNull();
    expect(pdfChapterByNo(33)).toBeNull();
    expect(catalogSlugForPdfChapter(33)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/chapter-pyq/pdfChapterMap.test.ts`

Expected: FAIL — `Cannot find module './pdfChapterMap'`

- [ ] **Step 3: Write the map**

Create `Web/lib/chapter-pyq/pdfChapterMap.ts`:

```ts
import { slugify } from "@/lib/slugs";

/** One row of the design spec's "PDF chapter → app catalog chapter" table. */
export type PyqPdfChapter = {
  pdfChapterNo: number;
  pdfTitle: string;
  /** Catalog chapter name, or null when the PDF chapter is deferred. */
  catalogName: string | null;
  /** `slugify(catalogName)`, or null when deferred. */
  catalogSlug: string | null;
  deferred: boolean;
};

export const PYQ_PILOT_PDF_CHAPTER_NO = 5;

/**
 * PDF chapter 17 (Electrostatics) straddles two catalog chapters and cannot be
 * routed without per-question classification, so it is deferred. Consequence:
 * "Electric Charges and Fields" has no question source yet.
 */
const ROWS: readonly (readonly [number, string, string | null])[] = [
  [1, "Mathematics in Physics", "Units and Measurements"],
  [2, "Units and Dimensions", "Units and Measurements"],
  [3, "Motion In One Dimension", "Motion in a Straight Line"],
  [4, "Motion In Two Dimensions", "Motion in a Plane"],
  [5, "Laws of Motion", "Laws of Motion"],
  [6, "Work Power Energy", "Work, Energy and Power"],
  [7, "Center of Mass Momentum and Collision", "System of Particles and Rotational Motion"],
  [8, "Rotational Motion", "System of Particles and Rotational Motion"],
  [9, "Gravitation", "Gravitation"],
  [10, "Mechanical Properties of Solids", "Mechanical Properties of Solids"],
  [11, "Mechanical Properties of Fluids", "Mechanical Properties of Fluids"],
  [12, "Oscillations", "Oscillations"],
  [13, "Waves and Sound", "Waves"],
  [14, "Thermal Properties of Matter", "Thermal Properties of Matter"],
  [15, "Thermodynamics", "Thermodynamics"],
  [16, "Kinetic Theory of Gases", "Kinetic Theory of Gases"],
  [17, "Electrostatics", null],
  [18, "Capacitance", "Electrostatic Potential and Capacitance"],
  [19, "Current Electricity", "Current Electricity"],
  [20, "Magnetic Properties of Matter", "Magnetism and Matter"],
  [21, "Magnetic Effects of Current", "Moving Charges and Magnetism"],
  [22, "Electromagnetic Induction", "Electromagnetic Induction"],
  [23, "Alternating Current", "Alternating Current"],
  [24, "Ray Optics", "Ray Optics"],
  [25, "Wave Optics", "Wave Optics"],
  [26, "Dual Nature of Matter", "Dual Nature of Radiation and Matter"],
  [27, "Atomic Physics", "Atoms"],
  [28, "Nuclear Physics", "Nuclei"],
  [29, "Electromagnetic Waves", "Electromagnetic Waves"],
  [30, "Semiconductors", "Semiconductor Electronics"],
  [31, "Communication System", "Communication System"],
  [32, "Experimental Physics", "Units and Measurements"],
];

export const PYQ_PHYSICS_PDF_CHAPTERS: readonly PyqPdfChapter[] = ROWS.map(
  ([pdfChapterNo, pdfTitle, catalogName]) => ({
    pdfChapterNo,
    pdfTitle,
    catalogName,
    catalogSlug: catalogName ? slugify(catalogName) : null,
    deferred: catalogName === null,
  })
);

export function pdfChapterByNo(pdfChapterNo: number): PyqPdfChapter | null {
  return PYQ_PHYSICS_PDF_CHAPTERS.find((c) => c.pdfChapterNo === pdfChapterNo) ?? null;
}

export function catalogSlugForPdfChapter(pdfChapterNo: number): string | null {
  return pdfChapterByNo(pdfChapterNo)?.catalogSlug ?? null;
}

/** Every PDF chapter that renders on one catalog chapter page, in PDF order. */
export function pdfChaptersForCatalogSlug(catalogSlug: string): PyqPdfChapter[] {
  return PYQ_PHYSICS_PDF_CHAPTERS.filter((c) => c.catalogSlug === catalogSlug);
}

export function deferredPdfChapterNos(): number[] {
  return PYQ_PHYSICS_PDF_CHAPTERS.filter((c) => c.deferred).map((c) => c.pdfChapterNo);
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run lib/chapter-pyq/pdfChapterMap.test.ts`

Expected: PASS (six tests). If "points every non-deferred row at a real catalog chapter" fails, a `catalogName` string does not match `PHYSICS_NAMES` exactly — fix the string in `ROWS`, never in `catalog.ts`.

- [ ] **Step 5: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/pdfChapterMap.ts lib/chapter-pyq/pdfChapterMap.test.ts
git commit -m "Map the 32 PYQ PDF physics chapters onto catalog chapters."
```

---

### Task 4: Tier vocabulary and row → `Question` mapper

**Files:**
- Create: `Web/lib/chapter-pyq/tiers.ts`
- Create: `Web/lib/chapter-pyq/pyqQuestionMap.ts`
- Test: `Web/lib/chapter-pyq/pyqQuestionMap.test.ts`

**Interfaces:**
- Consumes: `Question` from `@/types`; `escapeHtmlTextNode` from `@/lib/mock/mockRichTextKatex`
- Produces:
  - `export type ChapterPyqTier = "concept_builder" | "must_do" | "advanced"` (from `tiers.ts`)
  - `export type ChapterPyqTierFilter = ChapterPyqTier | "all"`
  - `export const CHAPTER_PYQ_TIERS: { id: ChapterPyqTier; label: string }[]`
  - `export function tierLabel(tier: ChapterPyqTier): string`
  - `export function filterByTier<T extends { tier: ChapterPyqTier }>(items: readonly T[], filter: ChapterPyqTierFilter): T[]`
  - `export type ChapterPyqQuestionRow` (the select shape, below)
  - `export type ChapterPyqQuestion = Question & { qNo: number; tier: ChapterPyqTier; answerMode: "mcq" | "numeric"; numericAnswer: string | null; coarseLabel: string; fineLabel: string; examLabel: string }`
  - `export function renderPyqBodyToHtml(body: string | null, figureSrcByKey: Record<string, string>): string`
  - `export function mapPyqRowToQuestion(row: ChapterPyqQuestionRow, figureSrcByKey: Record<string, string>): ChapterPyqQuestion`

This mirrors `mapCatalogQuestionRowToQuestion` in `Web/lib/mock/catalogQuestionMap.ts` (same `emptyReference`, same `stripHtmlToPlain` idea, same `classLevel`/`examType` defaults) with two deliberate differences: it carries two label levels, and it **never** fabricates MCQ options for a numerical question the way `buildNumericMcq` in `Web/scripts/import-mock-paper-json.ts` does. A numerical question gets `options: []` and `correctAnswer: -1`.

- [ ] **Step 1: Write the failing test**

Create `Web/lib/chapter-pyq/pyqQuestionMap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  mapPyqRowToQuestion,
  renderPyqBodyToHtml,
  type ChapterPyqQuestionRow,
} from "./pyqQuestionMap";
import { CHAPTER_PYQ_TIERS, filterByTier, tierLabel } from "./tiers";

const mcqRow: ChapterPyqQuestionRow = {
  id: "11111111-1111-1111-1111-111111111111",
  q_no: 7,
  tier: "must_do",
  format: "mcq",
  body: "A block of mass $m$ rests on a rough incline.\n\n[[fig:p047_x549]]",
  correct_option: 3,
  numerical_answer: null,
  exam_date: "2024-01-30",
  exam_shift: "evening",
  chapters: { name: "Laws of Motion", catalog_slug: "laws-of-motion" },
  topics: { name: "Frictional force" },
  question_options: [
    { option_index: 1, body: "$\\mu m g$" },
    { option_index: 2, body: "$2\\mu m g$" },
    { option_index: 3, body: "$\\mu m g \\cos\\theta$" },
    { option_index: 4, body: "zero" },
  ],
};

const numericRow: ChapterPyqQuestionRow = {
  id: "22222222-2222-2222-2222-222222222222",
  q_no: 17,
  tier: "advanced",
  format: "numerical",
  body: "Find the tension in newton.",
  correct_option: null,
  numerical_answer: "18",
  exam_date: null,
  exam_shift: null,
  chapters: { name: "Laws of Motion", catalog_slug: "laws-of-motion" },
  topics: null,
  question_options: [],
};

const figureSrc = { p047_x549: "pyq/physics/figures/p047_x549" };

describe("mapPyqRowToQuestion", () => {
  it("maps an MCQ row with options in index order", () => {
    const q = mapPyqRowToQuestion(mcqRow, figureSrc);
    expect(q.id).toBe(mcqRow.id);
    expect(q.subject).toBe("physics");
    expect(q.answerMode).toBe("mcq");
    expect(q.options).toEqual([
      "$\\mu m g$",
      "$2\\mu m g$",
      "$\\mu m g \\cos\\theta$",
      "zero",
    ]);
    expect(q.correctAnswer).toBe(2);
    expect(q.numericAnswer).toBeNull();
  });

  it("carries the coarse chapter label and the fine topic label", () => {
    const q = mapPyqRowToQuestion(mcqRow, figureSrc);
    expect(q.coarseLabel).toBe("Laws of Motion");
    expect(q.fineLabel).toBe("Frictional force");
    expect(q.topic).toBe("Frictional force");
    expect(q.examLabel).toBe("30 Jan 2024 (E)");
  });

  it("falls back to the coarse label when the row has no topic", () => {
    const q = mapPyqRowToQuestion(numericRow, figureSrc);
    expect(q.fineLabel).toBe("");
    expect(q.topic).toBe("Laws of Motion");
    expect(q.examLabel).toBe("");
  });

  it("never fabricates options for a numerical question", () => {
    const q = mapPyqRowToQuestion(numericRow, figureSrc);
    expect(q.answerMode).toBe("numeric");
    expect(q.options).toEqual([]);
    expect(q.correctAnswer).toBe(-1);
    expect(q.numericAnswer).toBe("18");
  });

  it("renders figure placeholders as images and drops unknown keys", () => {
    const html = renderPyqBodyToHtml("Before [[fig:p047_x549]] after [[fig:p999_x1]]", figureSrc);
    expect(html).toContain('<img src="pyq/physics/figures/p047_x549"');
    expect(html).not.toContain("p999_x1");
    expect(html).not.toContain("[[fig:");
  });

  it("escapes HTML in the body but leaves LaTeX intact", () => {
    const html = renderPyqBodyToHtml("Show $a < b$ and <script>x</script>", {});
    expect(html).toContain("$a &lt; b$");
    expect(html).not.toContain("<script>");
  });

  it("returns an empty stem for a skeleton row with a null body", () => {
    const q = mapPyqRowToQuestion({ ...mcqRow, body: null }, figureSrc);
    expect(q.questionHtml).toBe("");
    expect(q.question).toBe("");
  });
});

describe("tiers", () => {
  it("labels all three tiers", () => {
    expect(CHAPTER_PYQ_TIERS.map((t) => t.id)).toEqual([
      "concept_builder",
      "must_do",
      "advanced",
    ]);
    expect(tierLabel("concept_builder")).toBe("Concept Builder");
    expect(tierLabel("must_do")).toBe("Must Do");
    expect(tierLabel("advanced")).toBe("Advanced");
  });

  it("filters by tier and passes everything through on all", () => {
    const items = [{ tier: "must_do" as const }, { tier: "advanced" as const }];
    expect(filterByTier(items, "all")).toHaveLength(2);
    expect(filterByTier(items, "advanced")).toEqual([{ tier: "advanced" }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/chapter-pyq/pyqQuestionMap.test.ts`

Expected: FAIL — `Cannot find module './pyqQuestionMap'`

- [ ] **Step 3: Write the tier vocabulary**

Create `Web/lib/chapter-pyq/tiers.ts`:

```ts
/** `questions.tier` in the PYQ bank; matches the book's own question tiers. */
export type ChapterPyqTier = "concept_builder" | "must_do" | "advanced";

export type ChapterPyqTierFilter = ChapterPyqTier | "all";

export const CHAPTER_PYQ_TIERS: { id: ChapterPyqTier; label: string }[] = [
  { id: "concept_builder", label: "Concept Builder" },
  { id: "must_do", label: "Must Do" },
  { id: "advanced", label: "Advanced" },
];

export function tierLabel(tier: ChapterPyqTier): string {
  switch (tier) {
    case "concept_builder":
      return "Concept Builder";
    case "must_do":
      return "Must Do";
    case "advanced":
      return "Advanced";
    default: {
      const never: never = tier;
      return never;
    }
  }
}

export function isChapterPyqTier(value: string): value is ChapterPyqTier {
  return value === "concept_builder" || value === "must_do" || value === "advanced";
}

export function filterByTier<T extends { tier: ChapterPyqTier }>(
  items: readonly T[],
  filter: ChapterPyqTierFilter
): T[] {
  if (filter === "all") return [...items];
  return items.filter((item) => item.tier === filter);
}
```

- [ ] **Step 4: Write the mapper**

Create `Web/lib/chapter-pyq/pyqQuestionMap.ts`:

```ts
import { escapeHtmlTextNode } from "@/lib/mock/mockRichTextKatex";
import type { Question } from "@/types";
import type { ChapterPyqTier } from "./tiers";

/** Shape of the `questions` select in `fetchChapterPyqQuestions`. */
export type ChapterPyqQuestionRow = {
  id: string;
  q_no: number;
  tier: ChapterPyqTier;
  format: "mcq" | "numerical" | "match_list" | "assertion_reason" | "statement";
  body: string | null;
  correct_option: number | null;
  numerical_answer: string | null;
  exam_date: string | null;
  exam_shift: "morning" | "evening" | null;
  chapters: { name: string; catalog_slug: string | null } | null;
  topics: { name: string } | null;
  question_options: { option_index: number; body: string | null }[];
};

export type ChapterPyqQuestion = Question & {
  qNo: number;
  tier: ChapterPyqTier;
  /** `numeric` means no options exist — render a keypad, not radio buttons. */
  answerMode: "mcq" | "numeric";
  numericAnswer: string | null;
  /** `chapters.name` — the PDF chapter, used as the coarse grouping label. */
  coarseLabel: string;
  /** `topics.name` — the PDF's in-chapter heading. Empty when absent. */
  fineLabel: string;
  /** `30 Jan 2024 (E)`, or empty when `exam_date` is null. */
  examLabel: string;
};

const FIGURE_PLACEHOLDER_RE = /\[\[fig:([A-Za-z0-9._-]+)\]\]/g;

const emptyReference: Question["reference"] = {
  theory: "",
  relatedTopics: [],
  applicationExample: "",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * `body` is Markdown with inline LaTeX, not HTML. Escape it as a text node so a
 * stray tag cannot reach the DOM, split blank-line blocks into paragraphs, then
 * swap `[[fig:KEY]]` for an `<img>`. KaTeX auto-render reads `textContent`, so
 * escaped `&lt;` inside `$…$` still renders as `<`.
 */
export function renderPyqBodyToHtml(
  body: string | null,
  figureSrcByKey: Record<string, string>
): string {
  const raw = String(body ?? "").trim();
  if (!raw) return "";
  return raw
    .split(/\n\s*\n/)
    .map((block) => {
      const html = escapeHtmlTextNode(block.trim()).replace(
        FIGURE_PLACEHOLDER_RE,
        (_match, key: string) => {
          const src = figureSrcByKey[key];
          return src ? `<img src="${src}" alt="" class="nta-mock-img">` : "";
        }
      );
      return html ? `<p>${html}</p>` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function stemToPlain(body: string | null): string {
  return String(body ?? "")
    .replace(FIGURE_PLACEHOLDER_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function examLabelFor(
  examDate: string | null,
  examShift: "morning" | "evening" | null
): string {
  if (!examDate) return "";
  const [year, month, day] = examDate.split("-");
  const monthLabel = MONTHS[Number(month) - 1];
  if (!monthLabel || !year || !day) return "";
  const shift = examShift === "morning" ? " (M)" : examShift === "evening" ? " (E)" : "";
  return `${Number(day)} ${monthLabel} ${year}${shift}`;
}

export function mapPyqRowToQuestion(
  row: ChapterPyqQuestionRow,
  figureSrcByKey: Record<string, string>
): ChapterPyqQuestion {
  const isNumeric = row.format === "numerical";
  const options = isNumeric
    ? []
    : [...row.question_options]
        .sort((a, b) => a.option_index - b.option_index)
        .map((o) => o.body ?? "");
  const coarseLabel = row.chapters?.name ?? "";
  const fineLabel = row.topics?.name ?? "";

  return {
    id: row.id,
    subject: "physics",
    topic: fineLabel || coarseLabel,
    classLevel: 12,
    examType: ["JEE_Mains"],
    question: stemToPlain(row.body),
    questionHtml: renderPyqBodyToHtml(row.body, figureSrcByKey),
    solutionHtml: null,
    options,
    correctAnswer: isNumeric ? -1 : (row.correct_option ?? 1) - 1,
    hint: "",
    solution: "",
    reference: emptyReference,
    qNo: row.q_no,
    tier: row.tier,
    answerMode: isNumeric ? "numeric" : "mcq",
    numericAnswer: isNumeric ? row.numerical_answer : null,
    coarseLabel,
    fineLabel,
    examLabel: examLabelFor(row.exam_date, row.exam_shift),
  };
}
```

- [ ] **Step 5: Run tests and make sure they pass**

Run: `npx vitest run lib/chapter-pyq/pyqQuestionMap.test.ts`

Expected: PASS (nine tests)

- [ ] **Step 6: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/tiers.ts lib/chapter-pyq/pyqQuestionMap.ts lib/chapter-pyq/pyqQuestionMap.test.ts
git commit -m "Map PYQ question rows to the app Question type without fake options."
```

---

### Task 5: Balanced set splitting and timer sizing

**Files:**
- Create: `Web/lib/chapter-pyq/sessionSets.ts`
- Test: `Web/lib/chapter-pyq/sessionSets.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `export const CHAPTER_PYQ_TARGET_SET_SIZE = 25`
  - `export const CHAPTER_PYQ_SECONDS_PER_QUESTION = 120`
  - `export function setCountFor(total: number, target?: number): number`
  - `export function splitIntoBalancedSets<T>(items: readonly T[], target?: number): T[][]`
  - `export function sessionSecondsForSet(setSize: number): number`

The spec's rule, verbatim: set count is `max(1, round(total / 25))`; sizes are distributed as evenly as possible and differ by at most one; no stub sets; the timer is 2 minutes per question in the set. A fixed 25 left a 7-question tail on 132 and could not express a 24-question Advanced tier at all.

- [ ] **Step 1: Write the failing test**

Create `Web/lib/chapter-pyq/sessionSets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CHAPTER_PYQ_SECONDS_PER_QUESTION,
  CHAPTER_PYQ_TARGET_SET_SIZE,
  sessionSecondsForSet,
  setCountFor,
  splitIntoBalancedSets,
} from "./sessionSets";

const sizesFor = (total: number) =>
  splitIntoBalancedSets(Array.from({ length: total }, (_, i) => i + 1)).map((s) => s.length);

describe("chapter PYQ session sets", () => {
  it("uses a 25-question target at 2 minutes per question", () => {
    expect(CHAPTER_PYQ_TARGET_SET_SIZE).toBe(25);
    expect(CHAPTER_PYQ_SECONDS_PER_QUESTION).toBe(120);
    expect(sessionSecondsForSet(27)).toBe(27 * 120);
    expect(sessionSecondsForSet(24)).toBe(2880);
  });

  it("matches the spec's worked examples", () => {
    expect(sizesFor(132)).toEqual([27, 27, 26, 26, 26]);
    expect(sizesFor(79)).toEqual([27, 26, 26]);
    expect(sizesFor(29)).toEqual([29]);
    expect(sizesFor(24)).toEqual([24]);
  });

  it("rounds the set count and never returns a stub", () => {
    expect(setCountFor(132)).toBe(5);
    expect(setCountFor(79)).toBe(3);
    expect(setCountFor(29)).toBe(1);
    expect(setCountFor(24)).toBe(1);
    expect(setCountFor(1)).toBe(1);
    expect(setCountFor(0)).toBe(0);
  });

  it("keeps set sizes within one of each other", () => {
    for (let total = 1; total <= 200; total++) {
      const sizes = sizesFor(total);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(total);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(Math.min(...sizes)).toBeGreaterThan(0);
    }
  });

  it("preserves input order across sets", () => {
    const sets = splitIntoBalancedSets([1, 2, 3, 4, 5], 2);
    expect(sets.flat()).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns no sets for an empty list", () => {
    expect(splitIntoBalancedSets([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/chapter-pyq/sessionSets.test.ts`

Expected: FAIL — `Cannot find module './sessionSets'`

- [ ] **Step 3: Write the splitter**

Create `Web/lib/chapter-pyq/sessionSets.ts`:

```ts
export const CHAPTER_PYQ_TARGET_SET_SIZE = 25;
export const CHAPTER_PYQ_SECONDS_PER_QUESTION = 120;

/** `max(1, round(total / 25))`, so a 24-question tier is one set, not a stub. */
export function setCountFor(total: number, target = CHAPTER_PYQ_TARGET_SET_SIZE): number {
  if (total <= 0) return 0;
  return Math.max(1, Math.round(total / target));
}

/**
 * Contiguous slices whose sizes differ by at most one. With 132 questions this
 * gives 27/27/26/26/26 rather than 25×5 plus a 7-question stub.
 */
export function splitIntoBalancedSets<T>(
  items: readonly T[],
  target = CHAPTER_PYQ_TARGET_SET_SIZE
): T[][] {
  const total = items.length;
  const count = setCountFor(total, target);
  if (count === 0) return [];

  const base = Math.floor(total / count);
  const remainder = total % count;

  const sets: T[][] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const size = base + (i < remainder ? 1 : 0);
    sets.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return sets;
}

export function sessionSecondsForSet(setSize: number): number {
  return Math.max(0, setSize) * CHAPTER_PYQ_SECONDS_PER_QUESTION;
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run lib/chapter-pyq/sessionSets.test.ts`

Expected: PASS (six tests)

- [ ] **Step 5: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/sessionSets.ts lib/chapter-pyq/sessionSets.test.ts
git commit -m "Split Chapter PYQ sittings into balanced sets."
```

---

### Task 6: Supabase Storage figures through the KaTeX image pipeline

**Files:**
- Create: `Web/lib/chapter-pyq/figureUrl.ts`
- Test: `Web/lib/chapter-pyq/figureUrl.test.ts`
- Modify: `Web/lib/mock/mockRichTextKatex.ts` (`patchMockHtmlImages`, lines 99–135)
- Test: `Web/lib/mock/mockRichTextKatex.test.ts`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL`
- Produces:
  - `export const CHAPTER_PYQ_FIGURE_BUCKET = "pyq"`
  - `export const CHAPTER_PYQ_FIGURE_PREFIX = "physics/figures"`
  - `export function chapterPyqFigureStoragePath(figureKey: string): string` → `pyq/physics/figures/p047_x549`
  - `export function isChapterPyqFigureStoragePath(src: string): boolean`
  - `export function chapterPyqFigurePublicUrl(storagePath: string): string`
  - `patchMockHtmlImages` now resolves a bare `pyq/physics/figures/<figure_key>` `src` to its public URL before the existing normalisation runs

`patchMockHtmlImages` today proxies Testbee URLs through `/api/mock/question-image` and prefixes every other relative `src` with `https://`, which would mangle a bare storage path. The new branch runs first and returns early into the same attribute-normalisation path, so Testbee and absolute-URL behaviour is untouched.

- [ ] **Step 1: Write the failing tests**

Create `Web/lib/chapter-pyq/figureUrl.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAPTER_PYQ_FIGURE_BUCKET,
  chapterPyqFigurePublicUrl,
  chapterPyqFigureStoragePath,
  isChapterPyqFigureStoragePath,
} from "./figureUrl";

describe("chapter PYQ figure URLs", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://bytsiknhtcnlxwzgqkrd.supabase.co");
  });

  it("builds bucket-qualified storage paths from a figure key", () => {
    expect(CHAPTER_PYQ_FIGURE_BUCKET).toBe("pyq");
    expect(chapterPyqFigureStoragePath("p047_x549")).toBe("pyq/physics/figures/p047_x549");
  });

  it("recognises only PYQ figure storage paths", () => {
    expect(isChapterPyqFigureStoragePath("pyq/physics/figures/p047_x549")).toBe(true);
    expect(isChapterPyqFigureStoragePath("pyq/physics/figures/../secret")).toBe(false);
    expect(isChapterPyqFigureStoragePath("https://example.com/a.png")).toBe(false);
    expect(isChapterPyqFigureStoragePath("pyq/chemistry/figures/p001_x1")).toBe(false);
  });

  it("resolves a storage path to a public object URL", () => {
    expect(chapterPyqFigurePublicUrl("pyq/physics/figures/p047_x549")).toBe(
      "https://bytsiknhtcnlxwzgqkrd.supabase.co/storage/v1/object/public/pyq/physics/figures/p047_x549"
    );
  });
});
```

Append to `Web/lib/mock/mockRichTextKatex.test.ts` (and extend the top import to `import { collapseSpuriousMockHtmlWhitespace, patchMockHtmlImages } from "./mockRichTextKatex";`):

```ts
describe("patchMockHtmlImages", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://bytsiknhtcnlxwzgqkrd.supabase.co");
  });

  it("resolves PYQ storage paths to public Supabase URLs", () => {
    const out = patchMockHtmlImages('<img src="pyq/physics/figures/p047_x549" alt="">');
    expect(out).toContain(
      'src="https://bytsiknhtcnlxwzgqkrd.supabase.co/storage/v1/object/public/pyq/physics/figures/p047_x549"'
    );
    expect(out).toContain("nta-mock-img");
    expect(out).toContain('loading="lazy"');
  });

  it("still proxies testbee images and leaves other absolute URLs alone", () => {
    const testbee = patchMockHtmlImages(
      '<img src="https://www.testbee.in/preview/show_qimage/abc.png">'
    );
    expect(testbee).toContain("/api/mock/question-image?url=");

    const other = patchMockHtmlImages('<img src="https://example.com/a.png">');
    expect(other).toContain('src="https://example.com/a.png"');
    expect(other).not.toContain("/api/mock/question-image");
  });
});
```

Add `beforeEach` and `vi` to that file's vitest import: `import { beforeEach, describe, expect, it, vi } from "vitest";`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/chapter-pyq/figureUrl.test.ts lib/mock/mockRichTextKatex.test.ts`

Expected: FAIL — `Cannot find module './figureUrl'`, and `patchMockHtmlImages` turning the storage path into `https://pyq/physics/figures/p047_x549`.

- [ ] **Step 3: Write the URL helper**

Create `Web/lib/chapter-pyq/figureUrl.ts`:

```ts
/**
 * PYQ figures live in a public bucket so the NTA shells can render them with a
 * plain `<img src>`. `figures.storage_path` is bucket + object, e.g.
 * `pyq/physics/figures/p047_x549` — never the image bytes.
 */
export const CHAPTER_PYQ_FIGURE_BUCKET = "pyq";
export const CHAPTER_PYQ_FIGURE_PREFIX = "physics/figures";

const FIGURE_STORAGE_PATH_RE = /^pyq\/physics\/figures\/p\d{3}_x\d+$/;

export function chapterPyqFigureStoragePath(figureKey: string): string {
  return `${CHAPTER_PYQ_FIGURE_BUCKET}/${CHAPTER_PYQ_FIGURE_PREFIX}/${figureKey}`;
}

export function isChapterPyqFigureStoragePath(src: string): boolean {
  return FIGURE_STORAGE_PATH_RE.test(src);
}

export function chapterPyqFigurePublicUrl(storagePath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${storagePath}`;
}
```

- [ ] **Step 4: Wire it into `patchMockHtmlImages`**

In `Web/lib/mock/mockRichTextKatex.ts`, add the import at the top of the file:

```ts
import {
  chapterPyqFigurePublicUrl,
  isChapterPyqFigureStoragePath,
} from "@/lib/chapter-pyq/figureUrl";
```

Then inside `patchMockHtmlImages`, immediately after the empty-`src` guard and **before** the `//` and `https://` normalisation, insert:

```ts
    if (isChapterPyqFigureStoragePath(src)) {
      src = chapterPyqFigurePublicUrl(src);
    }
```

so the block reads:

```ts
    let src = (srcMatch?.[1] ?? srcMatch?.[2] ?? "").trim();
    if (!src) return _full;

    if (isChapterPyqFigureStoragePath(src)) {
      src = chapterPyqFigurePublicUrl(src);
    }

    if (src.startsWith("//")) src = `https:${src}`;
    if (!/^https?:\/\//i.test(src)) src = `https://${src}`;
```

- [ ] **Step 5: Run tests and make sure they pass**

Run: `npx vitest run lib/chapter-pyq/figureUrl.test.ts lib/mock/mockRichTextKatex.test.ts`

Expected: PASS (five tests; the two pre-existing `collapseSpuriousMockHtmlWhitespace` tests still pass, which is the no-regression check for the mock flow)

- [ ] **Step 6: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/figureUrl.ts lib/chapter-pyq/figureUrl.test.ts lib/mock/mockRichTextKatex.ts lib/mock/mockRichTextKatex.test.ts
git commit -m "Render Supabase Storage PYQ figures through the mock image pipeline."
```

---

### Task 7: Numeric answer input on both NTA shells

**Files:**
- Create: `Web/lib/chapter-pyq/numericAnswer.ts`
- Test: `Web/lib/chapter-pyq/numericAnswer.test.ts`
- Create: `Web/components/chapter-pyq/ChapterPyqNumericPad.tsx`
- Modify: `Web/components/prep-mock/nta/ntaExamParts.tsx` (`computeNtaLegendCounts`, lines 168–190)
- Modify: `Web/components/prep-mock/nta/NtaExamShell.tsx` (`NtaExamShellProps` lines 25–46; the options block lines 265–293)
- Modify: `Web/components/prep-mock/nta/NtaExamShellMobile.tsx` (`NtaExamShellMobileProps` lines 28–49; the options block lines 287–309)

**Interfaces:**
- Consumes: `Question` from `@/types`
- Produces:
  - `export function normalizeNumericAnswer(raw: string): number | null`
  - `export function isNumericAnswerCorrect(raw: string | undefined, expected: string | null): boolean`
  - `export function ChapterPyqNumericPad(props: { value: string; onChange: (next: string) => void; mobile?: boolean }): JSX.Element`
  - Three **optional** props on both shell prop types: `numericAnswers?: Record<string, string>`, `onNumericAnswerChange?: (questionId: string, raw: string) => void`, `isNumericQuestion?: (q: Question) => boolean`
  - `computeNtaLegendCounts(questions, visitedIds, answers, flagged, numericAnswers?)` — fifth parameter defaults to `{}`

Every addition is optional with a default that reproduces today's behaviour exactly, so `MockPageContent` keeps working unchanged. 19 of the pilot chapter's 132 questions are numerical, so this is required, not optional.

- [ ] **Step 1: Write the failing test**

Create `Web/lib/chapter-pyq/numericAnswer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isNumericAnswerCorrect, normalizeNumericAnswer } from "./numericAnswer";

describe("normalizeNumericAnswer", () => {
  it("parses integers, decimals and signs", () => {
    expect(normalizeNumericAnswer("18")).toBe(18);
    expect(normalizeNumericAnswer(" -2.5 ")).toBe(-2.5);
    expect(normalizeNumericAnswer("0")).toBe(0);
  });

  it("rejects anything that is not a finite number", () => {
    expect(normalizeNumericAnswer("")).toBeNull();
    expect(normalizeNumericAnswer("-")).toBeNull();
    expect(normalizeNumericAnswer("18 N")).toBeNull();
    expect(normalizeNumericAnswer("abc")).toBeNull();
  });
});

describe("isNumericAnswerCorrect", () => {
  it("rounds to the nearest integer when the key is an integer", () => {
    expect(isNumericAnswerCorrect("18", "18")).toBe(true);
    expect(isNumericAnswerCorrect("18.4", "18")).toBe(true);
    expect(isNumericAnswerCorrect("17.6", "18")).toBe(true);
    expect(isNumericAnswerCorrect("19", "18")).toBe(false);
  });

  it("compares within 0.01 when the key is not an integer", () => {
    expect(isNumericAnswerCorrect("2.50", "2.5")).toBe(true);
    expect(isNumericAnswerCorrect("2.505", "2.5")).toBe(true);
    expect(isNumericAnswerCorrect("2.6", "2.5")).toBe(false);
  });

  it("is false for a missing answer or a missing key", () => {
    expect(isNumericAnswerCorrect(undefined, "18")).toBe(false);
    expect(isNumericAnswerCorrect("", "18")).toBe(false);
    expect(isNumericAnswerCorrect("18", null)).toBe(false);
    expect(isNumericAnswerCorrect("18", "not a number")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/chapter-pyq/numericAnswer.test.ts`

Expected: FAIL — `Cannot find module './numericAnswer'`

- [ ] **Step 3: Write the comparison module**

Create `Web/lib/chapter-pyq/numericAnswer.ts`:

```ts
/** JEE Main numeric responses are plain numbers; reject units and stray text. */
export function normalizeNumericAnswer(raw: string): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * The answer key stores `questions.numerical_answer` as text. JEE Main integer
 * answers are graded on the nearest integer; a decimal key is graded to 0.01.
 */
export function isNumericAnswerCorrect(
  raw: string | undefined,
  expected: string | null
): boolean {
  const given = normalizeNumericAnswer(raw ?? "");
  const key = expected == null ? null : normalizeNumericAnswer(expected);
  if (given == null || key == null) return false;
  if (Number.isInteger(key)) return Math.round(given) === key;
  return Math.abs(given - key) <= 0.01;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/chapter-pyq/numericAnswer.test.ts`

Expected: PASS (five tests)

- [ ] **Step 5: Build the keypad**

Create `Web/components/chapter-pyq/ChapterPyqNumericPad.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "-"] as const;

type ChapterPyqNumericPadProps = {
  value: string;
  onChange: (next: string) => void;
  mobile?: boolean;
};

/** JEE Main numeric response: a typed value plus an on-screen keypad. */
export function ChapterPyqNumericPad({
  value,
  onChange,
  mobile = false,
}: ChapterPyqNumericPadProps) {
  const append = (key: string) => {
    if (key === "." && value.includes(".")) return;
    if (key === "-") {
      onChange(value.startsWith("-") ? value.slice(1) : `-${value}`);
      return;
    }
    onChange(`${value}${key}`);
  };

  return (
    <div className="w-full max-w-xs">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9.\-]/g, ""))}
        aria-label="Numeric answer"
        placeholder="Enter your answer"
        className={cn(
          "mb-2 w-full rounded border px-3 py-2 text-right font-mono text-base tabular-nums",
          mobile ? "bg-[var(--nta-m-surface)]" : "bg-white text-black"
        )}
      />
      <div className="grid grid-cols-3 gap-1.5">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => append(key)}
            className="rounded border py-2 text-base font-bold tabular-nums"
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          className="rounded border py-2 text-sm font-bold"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onChange("")}
          className="col-span-2 rounded border py-2 text-sm font-bold"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Count numeric answers in the legend**

In `Web/components/prep-mock/nta/ntaExamParts.tsx`, change `computeNtaLegendCounts` to take an optional fifth argument and treat a non-empty numeric entry as answered:

```tsx
export function computeNtaLegendCounts(
  questions: Question[],
  visitedIds: Set<string>,
  answers: Record<string, number>,
  flagged: Set<string>,
  numericAnswers: Record<string, string> = {}
): NtaLegendCounts {
  let notVisited = 0;
  let notAnswered = 0;
  let answered = 0;
  let marked = 0;
  let answeredMarked = 0;
  for (const q of questions) {
    const v = visitedIds.has(q.id);
    const a =
      answers[q.id] !== undefined || (numericAnswers[q.id] ?? "").trim().length > 0;
    const f = flagged.has(q.id);
    if (!v) notVisited++;
    else if (a && f) answeredMarked++;
    else if (f) marked++;
    else if (a) answered++;
    else notAnswered++;
  }
  return { notVisited, notAnswered, answered, marked, answeredMarked };
}
```

- [ ] **Step 7: Add the optional props to the desktop shell**

In `Web/components/prep-mock/nta/NtaExamShell.tsx`:

1. Add to the import block: `import { ChapterPyqNumericPad } from "@/components/chapter-pyq/ChapterPyqNumericPad";`
2. Append to `NtaExamShellProps`:

```tsx
  /** Chapter PYQ numericals: raw typed value per question id. */
  numericAnswers?: Record<string, string>;
  onNumericAnswerChange?: (questionId: string, raw: string) => void;
  /** Defaults to false for every question, which keeps the mock flow MCQ-only. */
  isNumericQuestion?: (q: Question) => boolean;
```

3. Destructure the three new props in the component signature and add them to `shellProps` so the mobile shell receives them.
4. Change the counts call to `computeNtaLegendCounts(questions, visitedIds, answers, flagged, numericAnswers)` and add `numericAnswers` to that `useMemo` dependency array.
5. Add `const isNumeric = isNumericQuestion?.(q) ?? false;` next to `const selected = answers[q.id];`
6. Replace the `Options :` heading and the `q.options.map(...)` block (lines 265–293) with:

```tsx
              {isNumeric ? (
                <>
                  <p className="mb-1.5 text-sm font-bold sm:mb-2 sm:text-base lg:mb-2.5">
                    Answer :
                  </p>
                  <ChapterPyqNumericPad
                    value={numericAnswers?.[q.id] ?? ""}
                    onChange={(next) => onNumericAnswerChange?.(q.id, next)}
                  />
                </>
              ) : (
                <>
                  <p className="mb-1.5 text-sm font-bold sm:mb-2 sm:text-base lg:mb-2.5">
                    Options :
                  </p>
                  <div className="w-full min-w-0 space-y-1.5 sm:space-y-2 lg:space-y-2">
                    {q.options.map((opt, i) => (
                      <label
                        key={i}
                        className={cn(
                          "flex cursor-pointer items-start gap-1.5 rounded border px-2.5 py-1.5 text-xs sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm lg:gap-2.5 lg:px-3.5 lg:py-2 lg:text-base",
                          selected === i ? "ring-2" : ""
                        )}
                        style={{
                          borderColor: "var(--nta-border)",
                          background: selected === i ? "var(--nta-surface)" : "transparent",
                          boxShadow: selected === i ? "0 0 0 2px var(--nta-blue)" : undefined,
                        }}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={selected === i}
                          onChange={() => onAnswerSelect(q.id, i)}
                          className="mt-0.5 size-3.5 shrink-0 sm:mt-1 sm:size-4 lg:mt-1.5 lg:size-[1.0625rem]"
                        />
                        <span className="font-semibold">{i + 1}.</span>
                        <div className="min-w-0 flex-1">
                          <NtaOptionBody text={opt} />
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
```

7. In the palette, change `const answered = answers[qq.id] !== undefined;` to:

```tsx
                  const answered =
                    answers[qq.id] !== undefined ||
                    (numericAnswers?.[qq.id] ?? "").trim().length > 0;
```

- [ ] **Step 8: Mirror it on the mobile shell**

In `Web/components/prep-mock/nta/NtaExamShellMobile.tsx` apply the same six edits: the `ChapterPyqNumericPad` import, the three optional props on `NtaExamShellMobileProps`, the destructure, the `computeNtaLegendCounts` fifth argument plus dependency, the palette `answered` expression, and the options block. The options block (lines 287–309) becomes:

```tsx
        {isNumericQuestion?.(q) ? (
          <>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--nta-m-dim)]">
              Enter your answer
            </p>
            <ChapterPyqNumericPad
              value={numericAnswers?.[q.id] ?? ""}
              onChange={(next) => onNumericAnswerChange?.(q.id, next)}
              mobile
            />
          </>
        ) : (
          <>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--nta-m-dim)]">
              Choose one option
            </p>
            <div className="space-y-2">
              {q.options.map((opt, i) => {
                const isSelected = selected === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onAnswerSelect(q.id, i)}
                    className="nta-m-opt"
                    data-selected={isSelected ? "true" : "false"}
                  >
                    <span className="nta-m-opt-radio" aria-hidden>
                      {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                    </span>
                    <span className="nta-m-opt-num">{i + 1}.</span>
                    <div className="nta-m-opt-body min-w-0 flex-1 text-[13px] leading-snug">
                      <NtaOptionBody text={opt} mobile />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
```

Also change the `MCQ · +4 / −1` chip (line 279) to render `Numerical · +4 / 0` when `isNumericQuestion?.(q)` is true, since numericals carry no negative marking in JEE Main.

- [ ] **Step 9: Typecheck and prove the mock flow did not regress**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "prep-mock|chapter-pyq"`

Expected: no output. `MockPageContent` passes none of the new props, so `isNumericQuestion` is undefined, `isNumeric` is false, and it renders exactly the MCQ branch it renders today.

Run: `npx vitest run lib/chapter-pyq lib/mock`

Expected: PASS

- [ ] **Step 10: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/numericAnswer.ts lib/chapter-pyq/numericAnswer.test.ts components/chapter-pyq/ChapterPyqNumericPad.tsx components/prep-mock/nta
git commit -m "Add a numeric answer mode to the NTA exam shells."
```

---

### Task 8: `ChapterPyqExamSession` orchestrator

**Files:**
- Create: `Web/components/chapter-pyq/ChapterPyqExamSession.tsx`

**Interfaces:**
- Consumes: `splitIntoBalancedSets` and `sessionSecondsForSet` from `@/lib/chapter-pyq/sessionSets`; `isNumericAnswerCorrect` from `@/lib/chapter-pyq/numericAnswer`; `ChapterPyqQuestion` from `@/lib/chapter-pyq/pyqQuestionMap`; `NtaExamShell` from `@/components/prep-mock/nta/NtaExamShell`
- Produces: `export default function ChapterPyqExamSession(props: { questions: ChapterPyqQuestion[]; chapterName: string; candidateName: string; avatarUrl: string | null; onExit: () => void }): JSX.Element`

This mirrors the useful parts of `MockPageContent` — the timer effect at lines 483–495 and the answer handlers at lines 1044–1083 — and imports nothing from it. No quota gating, no RDM bonuses, no attempt recording, no community sharing.

- [ ] **Step 1: Write the orchestrator**

Create `Web/components/chapter-pyq/ChapterPyqExamSession.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NtaExamShell } from "@/components/prep-mock/nta/NtaExamShell";
import { isNumericAnswerCorrect } from "@/lib/chapter-pyq/numericAnswer";
import type { ChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";
import {
  sessionSecondsForSet,
  splitIntoBalancedSets,
} from "@/lib/chapter-pyq/sessionSets";
import type { Question } from "@/types";

type ChapterPyqExamSessionProps = {
  questions: ChapterPyqQuestion[];
  chapterName: string;
  candidateName: string;
  avatarUrl: string | null;
  onExit: () => void;
};

type SessionView = "sets" | "test" | "results";

export default function ChapterPyqExamSession({
  questions,
  chapterName,
  candidateName,
  avatarUrl,
  onExit,
}: ChapterPyqExamSessionProps) {
  const sets = useMemo(() => splitIntoBalancedSets(questions), [questions]);

  const [view, setView] = useState<SessionView>("sets");
  const [setIndex, setSetIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [numericAnswers, setNumericAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const active = sets[setIndex] ?? [];
  const totalSeconds = sessionSecondsForSet(active.length);

  const isNumericQuestion = useCallback(
    (q: Question) => active.find((item) => item.id === q.id)?.answerMode === "numeric",
    [active]
  );

  const handleFinish = useCallback(() => {
    setView("results");
    setStartTime(null);
  }, []);

  useEffect(() => {
    if (view !== "test" || startTime == null) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const left = Math.max(0, totalSeconds - elapsed);
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(interval);
        handleFinish();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [view, startTime, totalSeconds, handleFinish]);

  useEffect(() => {
    if (view !== "test") return;
    const id = active[currentIndex]?.id;
    if (!id) return;
    setVisitedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, [view, active, currentIndex]);

  const startSet = (index: number) => {
    setSetIndex(index);
    setCurrentIndex(0);
    setAnswers({});
    setNumericAnswers({});
    setFlagged(new Set());
    setVisitedIds(new Set());
    setSecondsLeft(sessionSecondsForSet(sets[index]?.length ?? 0));
    setStartTime(Date.now());
    setView("test");
  };

  const handleAnswerSelect = useCallback((questionId: string, idx: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: idx }));
  }, []);

  const handleNumericChange = useCallback((questionId: string, raw: string) => {
    setNumericAnswers((prev) => ({ ...prev, [questionId]: raw }));
  }, []);

  const clearCurrent = useCallback(() => {
    const id = active[currentIndex]?.id;
    if (!id) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setNumericAnswers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [active, currentIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(active.length - 1, i + 1));
  }, [active.length]);

  const markCurrent = useCallback(() => {
    const id = active[currentIndex]?.id;
    if (!id) return;
    setFlagged((prev) => new Set(prev).add(id));
  }, [active, currentIndex]);

  const correctCount = useMemo(
    () =>
      active.filter((q) =>
        q.answerMode === "numeric"
          ? isNumericAnswerCorrect(numericAnswers[q.id], q.numericAnswer)
          : answers[q.id] === q.correctAnswer
      ).length,
    [active, answers, numericAnswers]
  );

  if (questions.length === 0) return <p className="font-bold">Questions coming soon</p>;

  if (view === "sets") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {questions.length} questions in {sets.length} {sets.length === 1 ? "set" : "sets"} · 2
          minutes per question
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {sets.map((set, index) => (
            <button
              key={index}
              type="button"
              onClick={() => startSet(index)}
              className="rounded-xl border border-border/50 bg-card/30 p-4 text-left transition-colors hover:border-primary/40"
            >
              <span className="block font-bold text-foreground">Set {index + 1}</span>
              <span className="block text-sm text-muted-foreground">
                {set.length} questions · {Math.round(sessionSecondsForSet(set.length) / 60)} min
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === "results") {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">
          {correctCount} / {active.length} correct
        </h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => setView("sets")} className="font-bold text-primary">
            Back to sets
          </button>
          <button type="button" onClick={onExit} className="font-bold text-muted-foreground">
            Leave chapter
          </button>
        </div>
      </div>
    );
  }

  return (
    <NtaExamShell
      candidateName={candidateName}
      avatarUrl={avatarUrl}
      examNameLine="JEE Main — Chapter PYQ"
      subjectPaperLine={`Physics · ${chapterName} · Set ${setIndex + 1}`}
      secondsLeft={secondsLeft}
      questions={active}
      currentIndex={currentIndex}
      onSelectIndex={setCurrentIndex}
      answers={answers}
      flagged={flagged}
      visitedIds={visitedIds}
      onAnswerSelect={handleAnswerSelect}
      numericAnswers={numericAnswers}
      onNumericAnswerChange={handleNumericChange}
      isNumericQuestion={isNumericQuestion}
      onSaveAndNext={goNext}
      onClearResponse={clearCurrent}
      onSaveMarkReviewNext={() => {
        markCurrent();
        goNext();
      }}
      onMarkReviewNext={() => {
        clearCurrent();
        markCurrent();
        goNext();
      }}
      onMarkForReviewOnly={() => {
        clearCurrent();
        markCurrent();
      }}
      onBackNav={() => setCurrentIndex((i) => Math.max(0, i - 1))}
      onNextNav={goNext}
      onSubmitClick={handleFinish}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "ChapterPyqExamSession"`

Expected: no output. If `questions={active}` errors, `ChapterPyqQuestion` has drifted from `Question` — fix the mapper in Task 4, not the shell.

- [ ] **Step 3: Confirm no import from `MockPageContent`**

Run: `Select-String -Path components/chapter-pyq/ChapterPyqExamSession.tsx -Pattern "MockPageContent"`

Expected: no output.

- [ ] **Step 4: Commit (only if the user asked)**

```bash
git add components/chapter-pyq/ChapterPyqExamSession.tsx
git commit -m "Add the Chapter PYQ exam session orchestrator."
```

---

### Task 9: Tier filter and per-question badge

**Files:**
- Create: `Web/components/chapter-pyq/ChapterPyqTierFilter.tsx`
- Modify: `Web/components/chapter-pyq/ChapterPyqExamSession.tsx` (render a badge above the shell)

**Interfaces:**
- Consumes: `CHAPTER_PYQ_TIERS`, `ChapterPyqTierFilter`, `tierLabel` from `@/lib/chapter-pyq/tiers`
- Produces:
  - `export function ChapterPyqTierFilter(props: { value: ChapterPyqTierFilter; counts: Record<ChapterPyqTierFilter, number>; onChange: (next: ChapterPyqTierFilter) => void }): JSX.Element`
  - `export function ChapterPyqTierBadge(props: { tier: ChapterPyqTier }): JSX.Element`

Filtering happens **before** the array reaches the shell, so the shell keeps its pure-props contract. The chips follow the mock library's pre-start filter-chip pattern and the subject tabs already in `ChapterPyqListView.tsx` (lines 38–52).

- [ ] **Step 1: Write the filter and badge**

Create `Web/components/chapter-pyq/ChapterPyqTierFilter.tsx`:

```tsx
"use client";

import {
  CHAPTER_PYQ_TIERS,
  tierLabel,
  type ChapterPyqTier,
  type ChapterPyqTierFilter as TierFilterValue,
} from "@/lib/chapter-pyq/tiers";

const OPTIONS: { id: TierFilterValue; label: string }[] = [
  { id: "all", label: "All" },
  ...CHAPTER_PYQ_TIERS,
];

export function ChapterPyqTierFilter({
  value,
  counts,
  onChange,
}: {
  value: TierFilterValue;
  counts: Record<TierFilterValue, number>;
  onChange: (next: TierFilterValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Question tier">
      {OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            disabled={counts[option.id] === 0}
            onClick={() => onChange(option.id)}
            className={
              active
                ? "rounded-full border border-primary bg-primary/15 px-4 py-2 text-sm font-bold text-primary"
                : "rounded-full border border-border bg-muted/30 px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
            }
          >
            {option.label} ({counts[option.id]})
          </button>
        );
      })}
    </div>
  );
}

const BADGE_CLASS: Record<ChapterPyqTier, string> = {
  concept_builder: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  must_do: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  advanced: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

export function ChapterPyqTierBadge({ tier }: { tier: ChapterPyqTier }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${BADGE_CLASS[tier]}`}
    >
      {tierLabel(tier)}
    </span>
  );
}
```

- [ ] **Step 2: Show the badge for the current question**

In `Web/components/chapter-pyq/ChapterPyqExamSession.tsx`, import the badge:

```tsx
import { ChapterPyqTierBadge } from "@/components/chapter-pyq/ChapterPyqTierFilter";
```

and wrap the `NtaExamShell` return so the badge and both label levels sit above it:

```tsx
  const current = active[currentIndex];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {current ? (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <ChapterPyqTierBadge tier={current.tier} />
          <span className="font-bold text-foreground">{current.coarseLabel}</span>
          {current.fineLabel ? <span>· {current.fineLabel}</span> : null}
          {current.examLabel ? <span>· {current.examLabel}</span> : null}
        </div>
      ) : null}
      <NtaExamShell
        /* …unchanged props… */
      />
    </div>
  );
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "ChapterPyqTierFilter|ChapterPyqExamSession"`

Expected: no output.

- [ ] **Step 4: Commit (only if the user asked)**

```bash
git add components/chapter-pyq/ChapterPyqTierFilter.tsx components/chapter-pyq/ChapterPyqExamSession.tsx
git commit -m "Add the Chapter PYQ tier filter and question badge."
```

---

### Task 10: Data access and a hand-seeded fixture

**Files:**
- Create: `Web/lib/chapter-pyq/fetchChapterPyqQuestions.ts`
- Test: `Web/lib/chapter-pyq/fetchChapterPyqQuestions.test.ts`
- Create: `Web/scripts/seed-chapter-pyq-fixture.sql`

**Interfaces:**
- Consumes: `supabase` from `@/integrations/supabase/client`; `pdfChaptersForCatalogSlug` from `./pdfChapterMap`; `mapPyqRowToQuestion` from `./pyqQuestionMap`; `chapterPyqFigureStoragePath` from `./figureUrl`
- Produces:
  - `export const CHAPTER_PYQ_PUBLISHED_STATUSES = ["auto_ok", "human_ok"] as const`
  - `export async function fetchChapterPyqQuestions(catalogSlug: string, client?: SupabaseLike): Promise<ChapterPyqQuestion[]>`
  - `export async function fetchChapterPyqCounts(client?: SupabaseLike): Promise<Record<string, number>>` — keyed by `catalog_slug`
  - `export type SupabaseLike` — the narrow surface the two functions use, so tests can pass a stub

The query spans **every** PDF chapter that maps to the catalog slug, which is what makes a merged chapter page work. It filters on `review_status` even though RLS already does, so a service-role caller sees the same rows a student does.

- [ ] **Step 1: Write the failing test**

Create `Web/lib/chapter-pyq/fetchChapterPyqQuestions.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  CHAPTER_PYQ_PUBLISHED_STATUSES,
  fetchChapterPyqCounts,
  fetchChapterPyqQuestions,
} from "./fetchChapterPyqQuestions";

type Call = { table: string; select: string; filters: [string, unknown][] };

function stubClient(rowsByTable: Record<string, unknown[]>, calls: Call[]) {
  return {
    from(table: string) {
      const call: Call = { table, select: "", filters: [] };
      calls.push(call);
      const builder = {
        select(columns: string) {
          call.select = columns;
          return builder;
        },
        in(column: string, values: unknown[]) {
          call.filters.push([`in:${column}`, values]);
          return builder;
        },
        order() {
          return Promise.resolve({ data: rowsByTable[table] ?? [], error: null });
        },
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve({ data: rowsByTable[table] ?? [], error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

const chapterRows = [
  { id: 5, name: "Laws of Motion", catalog_slug: "laws-of-motion" },
];

const questionRows = [
  {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    q_no: 1,
    tier: "must_do",
    format: "mcq",
    body: "Stem one [[fig:p047_x549]]",
    correct_option: 2,
    numerical_answer: null,
    exam_date: "2024-01-30",
    exam_shift: "evening",
    chapters: { name: "Laws of Motion", catalog_slug: "laws-of-motion" },
    topics: { name: "Newton's laws of motion" },
    question_options: [
      { option_index: 1, body: "a" },
      { option_index: 2, body: "b" },
      { option_index: 3, body: "c" },
      { option_index: 4, body: "d" },
    ],
    figure_links: [{ figures: { figure_key: "p047_x549" } }],
  },
];

describe("fetchChapterPyqQuestions", () => {
  it("only ever asks for publishable rows", async () => {
    expect([...CHAPTER_PYQ_PUBLISHED_STATUSES]).toEqual(["auto_ok", "human_ok"]);
    const calls: Call[] = [];
    await fetchChapterPyqQuestions(
      "laws-of-motion",
      stubClient({ chapters: chapterRows, questions: questionRows }, calls)
    );
    const questionCall = calls.find((c) => c.table === "questions");
    expect(questionCall?.filters).toContainEqual([
      "in:review_status",
      ["auto_ok", "human_ok"],
    ]);
  });

  it("spans every PDF chapter that maps to the catalog slug", async () => {
    const calls: Call[] = [];
    await fetchChapterPyqQuestions(
      "units-and-measurements",
      stubClient({ chapters: [], questions: [] }, calls)
    );
    const chapterCall = calls.find((c) => c.table === "chapters");
    expect(chapterCall?.filters).toContainEqual([
      "in:chapter_no",
      [1, 2, 32],
    ]);
  });

  it("maps rows and resolves figure keys to storage paths", async () => {
    const calls: Call[] = [];
    const out = await fetchChapterPyqQuestions(
      "laws-of-motion",
      stubClient({ chapters: chapterRows, questions: questionRows }, calls)
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.coarseLabel).toBe("Laws of Motion");
    expect(out[0]!.questionHtml).toContain('src="pyq/physics/figures/p047_x549"');
  });

  it("returns an empty array for a deferred or unmapped slug without querying", async () => {
    const calls: Call[] = [];
    const out = await fetchChapterPyqQuestions(
      "electric-charges-and-fields",
      stubClient({}, calls)
    );
    expect(out).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe("fetchChapterPyqCounts", () => {
  it("sums publishable questions per catalog slug", async () => {
    const calls: Call[] = [];
    const counts = await fetchChapterPyqCounts(
      stubClient(
        {
          questions: [
            { chapters: { catalog_slug: "laws-of-motion" } },
            { chapters: { catalog_slug: "laws-of-motion" } },
            { chapters: { catalog_slug: "units-and-measurements" } },
            { chapters: { catalog_slug: null } },
          ],
        },
        calls
      )
    );
    expect(counts["laws-of-motion"]).toBe(2);
    expect(counts["units-and-measurements"]).toBe(1);
    expect(Object.keys(counts)).not.toContain("null");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/chapter-pyq/fetchChapterPyqQuestions.test.ts`

Expected: FAIL — `Cannot find module './fetchChapterPyqQuestions'`

- [ ] **Step 3: Write the data access module**

Create `Web/lib/chapter-pyq/fetchChapterPyqQuestions.ts`:

```ts
import { supabase } from "@/integrations/supabase/client";
import { chapterPyqFigureStoragePath } from "./figureUrl";
import { pdfChaptersForCatalogSlug } from "./pdfChapterMap";
import {
  mapPyqRowToQuestion,
  type ChapterPyqQuestion,
  type ChapterPyqQuestionRow,
} from "./pyqQuestionMap";

export const CHAPTER_PYQ_PUBLISHED_STATUSES = ["auto_ok", "human_ok"] as const;

/** The narrow slice of the Supabase client these functions use. */
export type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (
        column: string,
        values: readonly unknown[]
      ) => PromiseLike<{ data: unknown; error: unknown }> & {
        in: (
          column: string,
          values: readonly unknown[]
        ) => PromiseLike<{ data: unknown; error: unknown }> & {
          order: (
            column: string,
            opts?: { ascending?: boolean }
          ) => PromiseLike<{ data: unknown; error: unknown }>;
        };
        order: (
          column: string,
          opts?: { ascending?: boolean }
        ) => PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
};

const QUESTION_COLUMNS =
  "id, q_no, tier, format, body, correct_option, numerical_answer, exam_date, exam_shift, " +
  "chapters(name, catalog_slug), topics(name), question_options(option_index, body), " +
  "figure_links(figures(figure_key))";

type QuestionRowWithFigures = ChapterPyqQuestionRow & {
  figure_links?: { figures: { figure_key: string } | null }[] | null;
};

function figureSrcMapFor(row: QuestionRowWithFigures): Record<string, string> {
  const out: Record<string, string> = {};
  for (const link of row.figure_links ?? []) {
    const key = link.figures?.figure_key;
    if (key) out[key] = chapterPyqFigureStoragePath(key);
  }
  return out;
}

/**
 * Every publishable question on a catalog chapter page, across every PDF chapter
 * that maps to it. Returns `[]` for a deferred or unmapped slug without querying.
 */
export async function fetchChapterPyqQuestions(
  catalogSlug: string,
  client: SupabaseLike = supabase as unknown as SupabaseLike
): Promise<ChapterPyqQuestion[]> {
  const pdfChapterNos = pdfChaptersForCatalogSlug(catalogSlug).map((c) => c.pdfChapterNo);
  if (pdfChapterNos.length === 0) return [];

  const chapterResult = await client
    .from("chapters")
    .select("id, name, catalog_slug")
    .in("chapter_no", pdfChapterNos);
  if (chapterResult.error) throw chapterResult.error;

  const chapterIds = ((chapterResult.data ?? []) as { id: number }[]).map((c) => c.id);
  if (chapterIds.length === 0) return [];

  const questionResult = await client
    .from("questions")
    .select(QUESTION_COLUMNS)
    .in("chapter_id", chapterIds)
    .in("review_status", CHAPTER_PYQ_PUBLISHED_STATUSES)
    .order("q_no", { ascending: true });
  if (questionResult.error) throw questionResult.error;

  const rows = (questionResult.data ?? []) as QuestionRowWithFigures[];
  return rows.map((row) => mapPyqRowToQuestion(row, figureSrcMapFor(row)));
}

/** Publishable question count per `chapters.catalog_slug`, for the chapter cards. */
export async function fetchChapterPyqCounts(
  client: SupabaseLike = supabase as unknown as SupabaseLike
): Promise<Record<string, number>> {
  const result = await client
    .from("questions")
    .select("chapters(catalog_slug)")
    .in("review_status", CHAPTER_PYQ_PUBLISHED_STATUSES);
  if (result.error) throw result.error;

  const counts: Record<string, number> = {};
  for (const row of (result.data ?? []) as { chapters: { catalog_slug: string | null } | null }[]) {
    const slug = row.chapters?.catalog_slug;
    if (!slug) continue;
    counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return counts;
}
```

If the stub's chained `.in().in().order()` shape fights the declared `SupabaseLike` type, simplify by declaring `SupabaseLike = { from: (table: string) => any }` with a one-line comment explaining that the real type comes from `@supabase/supabase-js` and the alias exists only so tests can inject a stub. Do not loosen the return types.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/chapter-pyq/fetchChapterPyqQuestions.test.ts`

Expected: PASS (five tests)

- [ ] **Step 5: Write the hand-seeded fixture**

Create `Web/scripts/seed-chapter-pyq-fixture.sql`. Six Laws of Motion questions — five MCQ, one numerical, one with a figure — so every app task above can be exercised before the model phases run. Run it in the Supabase SQL editor against the Web project.

```sql
-- Local/dev fixture: six Laws of Motion questions so the Chapter PYQ UI can be
-- built and eyeballed before Phases 4-9 produce real extractions.
-- Safe to re-run: every insert is keyed and idempotent.

INSERT INTO public.subjects (name) VALUES ('Physics')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO public.units (subject_id, name, sort_order)
SELECT s.id, 'Mechanics 1', 1 FROM public.subjects s WHERE s.name = 'Physics'
  AND NOT EXISTS (SELECT 1 FROM public.units WHERE name = 'Mechanics 1');

INSERT INTO public.chapters (unit_id, chapter_no, name, expected_question_count, catalog_slug)
SELECT u.id, 5, 'Laws of Motion', 132, 'laws-of-motion'
  FROM public.units u WHERE u.name = 'Mechanics 1'
  ON CONFLICT (chapter_no) DO UPDATE
    SET catalog_slug = EXCLUDED.catalog_slug,
        expected_question_count = EXCLUDED.expected_question_count;

INSERT INTO public.topics (chapter_id, name, sort_order)
SELECT c.id, t.name, t.sort_order
  FROM public.chapters c,
       (VALUES ('Newton''s laws of motion', 1), ('Frictional force', 2)) AS t(name, sort_order)
  WHERE c.chapter_no = 5
  ON CONFLICT (chapter_id, name) DO NOTHING;

INSERT INTO public.figures
  (figure_key, storage_path, source_page, source_bbox, px_width, px_height, bytes)
VALUES
  ('p047_x549', 'pyq/physics/figures/p047_x549', 47,
   '[38, 79.7, 297.5, 220.3]'::jsonb, 177, 160, 9577)
  ON CONFLICT (figure_key) DO NOTHING;

INSERT INTO public.questions
  (chapter_id, topic_id, q_no, tier, format, body, correct_option, numerical_answer,
   exam_date, exam_shift, source_page, review_status)
SELECT c.id, tp.id, v.q_no, v.tier::public.question_tier, v.fmt::public.question_format,
       v.body, v.correct_option, v.numerical_answer, v.exam_date::date,
       v.shift::public.pyq_exam_shift, v.page, 'auto_ok'
  FROM public.chapters c
  JOIN public.topics tp ON tp.chapter_id = c.id AND tp.name = 'Newton''s laws of motion'
  CROSS JOIN (VALUES
    (1, 'concept_builder', 'mcq',
     'A body of mass $m$ moves with constant velocity. The net force on it is [[fig:p047_x549]]',
     1, NULL, '2024-01-30', 'evening', 47),
    (2, 'must_do', 'mcq',
     'Two blocks of mass $2\,$kg and $3\,$kg are connected by a light string. Find the tension.',
     3, NULL, '2023-04-06', 'morning', 47),
    (3, 'must_do', 'mcq',
     'A $5\,$kg block rests on a rough floor with $\mu = 0.4$. The limiting friction is',
     2, NULL, '2022-06-24', 'evening', 48),
    (4, 'advanced', 'mcq',
     'A wedge of mass $M$ is free to slide. The acceleration of the block relative to the wedge is',
     4, NULL, NULL, NULL, 48),
    (5, 'concept_builder', 'mcq',
     'Action and reaction forces act on', 3, NULL, '2021-02-25', 'morning', 49),
    (17, 'advanced', 'numerical',
     'A force $F = 12\,$N acts on a $\frac{2}{3}\,$kg mass. Its acceleration in $\text{m s}^{-2}$ is',
     NULL, '18', '2025-01-22', 'evening', 49)
  ) AS v(q_no, tier, fmt, body, correct_option, numerical_answer, exam_date, shift, page)
  WHERE c.chapter_no = 5
  ON CONFLICT (chapter_id, q_no) DO UPDATE
    SET body = EXCLUDED.body,
        correct_option = EXCLUDED.correct_option,
        numerical_answer = EXCLUDED.numerical_answer,
        review_status = EXCLUDED.review_status;

INSERT INTO public.question_options (question_id, option_index, body)
SELECT q.id, o.idx, o.body
  FROM public.questions q
  JOIN public.chapters c ON c.id = q.chapter_id AND c.chapter_no = 5
  CROSS JOIN (VALUES
    (1, 'zero'), (2, '$mg$'), (3, '$2mg$'), (4, 'cannot be determined')
  ) AS o(idx, body)
  WHERE q.format = 'mcq'
  ON CONFLICT (question_id, option_index) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO public.figure_links (figure_id, question_id, role, sort_order)
SELECT f.id, q.id, 'question_body', 0
  FROM public.figures f
  JOIN public.chapters c ON c.chapter_no = 5
  JOIN public.questions q ON q.chapter_id = c.id AND q.q_no = 1
  WHERE f.figure_key = 'p047_x549'
  ON CONFLICT DO NOTHING;
```

- [ ] **Step 6: Verify the fixture reads back through the publishing gate**

```sql
SELECT q.q_no, q.format, q.review_status, c.catalog_slug, t.name AS topic
  FROM public.questions q
  JOIN public.chapters c ON c.id = q.chapter_id
  LEFT JOIN public.topics t ON t.id = q.topic_id
  WHERE c.catalog_slug = 'laws-of-motion'
  ORDER BY q.q_no;
```

Expected: 6 rows, all `review_status = 'auto_ok'`, five `mcq` and one `numerical` (`q_no = 17`).

- [ ] **Step 7: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/fetchChapterPyqQuestions.ts lib/chapter-pyq/fetchChapterPyqQuestions.test.ts scripts/seed-chapter-pyq-fixture.sql
git commit -m "Fetch publishable Chapter PYQ questions and counts."
```

---

### Task 11: Practice view and live chapter counts

**Files:**
- Modify: `Web/components/chapter-pyq/ChapterPyqPracticeView.tsx` (replace the `Questions coming soon` body, line 43)
- Modify: `Web/components/chapter-pyq/ChapterPyqListView.tsx` (replace the `Practice` placeholder from Task 2)

**Interfaces:**
- Consumes: `fetchChapterPyqQuestions` and `fetchChapterPyqCounts` from `@/lib/chapter-pyq/fetchChapterPyqQuestions`; `filterByTier` from `@/lib/chapter-pyq/tiers`; `ChapterPyqTierFilter` from `@/components/chapter-pyq/ChapterPyqTierFilter`; `ChapterPyqExamSession`
- Produces: `/chapter-pyq/physics/laws-of-motion` renders the tier filter and the session; chapters with zero publishable questions keep `Questions coming soon`

The empty state is kept, not deleted — it is the correct state for the 28 other physics chapters and for the two subjects with no import at all.

- [ ] **Step 1: Wire the practice view**

In `Web/components/chapter-pyq/ChapterPyqPracticeView.tsx`, add the imports and replace the final `<p>` with a loading/empty/session switch:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChapterPyqExamSession from "@/components/chapter-pyq/ChapterPyqExamSession";
import { ChapterPyqTierFilter } from "@/components/chapter-pyq/ChapterPyqTierFilter";
import { CHAPTER_PYQ_SUBJECTS, findChapter } from "@/lib/chapter-pyq/catalog";
import { fetchChapterPyqQuestions } from "@/lib/chapter-pyq/fetchChapterPyqQuestions";
import type { ChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";
import { filterByTier, type ChapterPyqTierFilter as TierFilterValue } from "@/lib/chapter-pyq/tiers";
```

Inside the component, after the `entry` guard:

```tsx
  const router = useRouter();
  const [questions, setQuestions] = useState<ChapterPyqQuestion[] | null>(null);
  const [tier, setTier] = useState<TierFilterValue>("all");

  useEffect(() => {
    let cancelled = false;
    if (!entry) return;
    fetchChapterPyqQuestions(entry.slug)
      .then((rows) => {
        if (!cancelled) setQuestions(rows);
      })
      .catch(() => {
        if (!cancelled) setQuestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const counts = useMemo(() => {
    const all = questions ?? [];
    return {
      all: all.length,
      concept_builder: all.filter((q) => q.tier === "concept_builder").length,
      must_do: all.filter((q) => q.tier === "must_do").length,
      advanced: all.filter((q) => q.tier === "advanced").length,
    };
  }, [questions]);

  const visible = useMemo(() => filterByTier(questions ?? [], tier), [questions, tier]);
```

and replace `<p className="mt-8 font-bold text-foreground">Questions coming soon</p>` with:

```tsx
        <div className="mt-8 space-y-4">
          {questions === null ? (
            <p className="text-sm text-muted-foreground">Loading questions…</p>
          ) : questions.length === 0 ? (
            <p className="font-bold text-foreground">Questions coming soon</p>
          ) : (
            <>
              <ChapterPyqTierFilter value={tier} counts={counts} onChange={setTier} />
              <ChapterPyqExamSession
                key={tier}
                questions={visible}
                chapterName={entry.name}
                candidateName="Candidate"
                avatarUrl={null}
                onExit={() => router.push("/chapter-pyq")}
              />
            </>
          )}
        </div>
```

`key={tier}` remounts the session when the filter changes, so set boundaries and the timer are recomputed instead of stale. That is what makes the spec's "changing the tier changes the set size" test pass.

- [ ] **Step 2: Wire live counts onto the chapter cards**

In `Web/components/chapter-pyq/ChapterPyqListView.tsx`, add:

```tsx
import { useEffect, useState } from "react";
import { fetchChapterPyqCounts } from "@/lib/chapter-pyq/fetchChapterPyqQuestions";
```

```tsx
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetchChapterPyqCounts()
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

and replace the `Practice` placeholder with:

```tsx
            <p className="mt-2 text-sm text-muted-foreground">
              {counts[entry.slug] ?? 0} questions
            </p>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "chapter-pyq"`

Expected: no output.

- [ ] **Step 4: Run the whole chapter-pyq suite**

Run: `npx vitest run lib/chapter-pyq lib/mock lib/auth/middlewareMatcher.test.ts`

Expected: PASS

- [ ] **Step 5: Manual check against the fixture**

With `npm run dev:turbo` running and the Task 10 fixture applied, sign in as a student and confirm each of these:

1. `/chapter-pyq` → Physics tab → the **Laws of Motion** card reads `6 questions`; every other physics card reads `0 questions`; the list has 29 physics cards ending in **Communication System**.
2. `/chapter-pyq/physics/laws-of-motion` → tier chips read `All (6) · Concept Builder (2) · Must Do (2) · Advanced (2)`, then one set of 6 questions at 12 min.
3. Question 1 renders the `p047_x549` figure. Open DevTools → Network and confirm the request goes to `…/storage/v1/object/public/pyq/physics/figures/p047_x549` and returns 200.
4. `q_no 17` shows the numeric keypad, not four radio buttons. Type `18`, submit, and the score reads `1 / 1` when it is the only question answered correctly.
5. Pick **Advanced** → 1 set of 2 questions at 4 min. The set size changed with the tier.
6. `/chapter-pyq/physics/gravitation` still reads **Questions coming soon**.
7. `/chapter-pyq/physics/electric-charges-and-fields` reads **Questions coming soon** (PDF chapter 17 is deferred).
8. No route exists for a PDF chapter that became a topic: `/chapter-pyq/physics/capacitance` and `/chapter-pyq/physics/rotational-motion` both render **Chapter not found**.
9. `/mock-test` → start any mock → the MCQ options still render as radio buttons and figures still load. This is the no-regression check on Tasks 6 and 7.

- [ ] **Step 6: Commit (only if the user asked)**

```bash
git add components/chapter-pyq/ChapterPyqPracticeView.tsx components/chapter-pyq/ChapterPyqListView.tsx
git commit -m "Render real Chapter PYQ questions and live chapter counts."
```

---

### Task 12: Phase 2 — expected counts, figure dedupe, upload, skeleton insert

**Files:**
- Create: `files/requirements.txt`
- Create: `files/load_storage.py`

**Interfaces:**
- Consumes: `files/out/skeleton.json` (4,115 records), `files/out/answer_key.json` (32 chapters), `files/out/figures.json` (1,336 rows, 1,335 distinct keys), `files/out/figures/*.png` (1,335 files); env `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- Produces: populated `subjects`/`units`/`chapters`/`topics`/`questions`; `figures` + `figure_links` for chapter 5; objects at `pyq/physics/figures/<figure_key>`; `files/out/phase2_report.json`

Chapter → `catalog_slug` values must match `Web/lib/chapter-pyq/pdfChapterMap.ts` exactly. Copy the 32 pairs from that file's `ROWS` array; chapter 17 gets `catalog_slug = NULL`.

The manifest has **1,336 rows but 1,335 distinct `figure_key`s** — `p420_x3821` appears twice with different bboxes. Deduping the manifest rows therefore finds **11** duplicate groups; deduping the 1,335 files on disk finds the **10** page-spanning groups `CURSOR_PLAN.md` predicts, and 1,325 unique checksums. Both numbers are correct for their own domain; the script must not treat the repeat as a parse error. See the spec's known-defect note.

- [ ] **Step 1: Record the dependency pins**

Create `files/requirements.txt`:

```
# pymupdf 1.28.2 installs but Windows Smart App Control blocks _mupdf.pyd on
# reputation grounds (CodeIntegrity 3077 / 3118). 1.26.3 loads. Do not bump.
pymupdf==1.26.3
supabase
httpx
pydantic
tenacity
```

- [ ] **Step 2: Verify the environment still matches the pin**

Run: `C:\Python314\python.exe -c "import fitz, sys; print(sys.version); print(fitz.__doc__)"`

Expected: `3.14.7 …` and a PyMuPDF banner reporting **1.26.3**. If the import raises `ImportError: DLL load failed`, Smart App Control has blocked the binary — reinstall with `C:\Python314\python.exe -m pip install --force-reinstall pymupdf==1.26.3`.

- [ ] **Step 3: Write `load_storage.py`**

Create `files/load_storage.py` with these stages, each idempotent and each printing a counter line:

1. **Taxonomy.** Upsert `subjects('Physics')`, one `units` row per PDF unit grouping (`Mechanics 1` is enough for the pilot; group the rest by chapter ranges), then 32 `chapters` rows with `chapter_no`, `name` from `skeleton.json`'s `chapter_title`, and the `catalog_slug` copied from `pdfChapterMap.ts`. Upsert on `chapter_no`.
2. **Expected counts.** `expected_question_count = len(answer_key[str(chapter_no)]["answers"])` for all 32. Print `expected counts written : 32`.
3. **Topics.** Distinct `(chapter_no, topic)` from `skeleton.json`, upsert on `(chapter_id, name)`.
4. **Questions.** All 4,115 rows. Map `answer_type → format`, `answer_value → correct_option` (int) when `answer_type == 'mcq'` else `numerical_answer` (text), `page → source_page`, `bbox → source_bbox`, `body = None`, `options` ignored, `review_status = 'skeleton_only'`. Upsert on `(chapter_id, q_no)` in batches of 500.
5. **Figure dedupe.** Walk the 1,336 manifest rows. Group by SHA-256 of the file on disk. Log `manifest rows : 1336`, `distinct figure_key : 1335`, `unique checksums : N`, `duplicate groups : N`. Keep one `figures` row per `figure_key` (the table's unique constraint makes the repeated `p420_x3821` a no-op on the second pass) and set `checksum` so a later chapter can link to an already-uploaded file rather than re-upload it.
6. **Upload, pilot only.** For each of the 63 distinct `figure_key`s on pages 47–60, upload `out/figures/<key>.png` to bucket `pyq`, object `physics/figures/<key>`, `content-type: image/png`, `upsert=True`. Set `storage_path = 'pyq/physics/figures/<key>'` and `public_url` to the public object URL. Never read the bytes into a Postgres column.
7. **Figure links.** One `figure_links` row per `(figure_key, question)` pair from `skeleton.json`'s `figure_keys`, `role = 'question_body'`, `sort_order` = position in the array.
8. **Run record.** Insert one `ingestion_runs` row with `source_file`, `pages_processed`, `questions_written`, `figures_written`, `cost_usd = 0`.

Write the counters to `files/out/phase2_report.json`.

- [ ] **Step 4: Run it**

Run from `files`: `C:\Python314\python.exe load_storage.py`

Expected stdout includes `questions upserted : 4115`, `manifest rows : 1336`, `distinct figure_key : 1335`, `duplicate groups : 11`, `figures uploaded : 63`, `figure links : 63`.

- [ ] **Step 5: Check the gate**

```sql
SELECT * FROM v_ingestion_check WHERE chapter_no = 5;
SELECT count(*) FROM v_ingestion_check WHERE delta <> 0;
SELECT count(*) FROM figures;
SELECT count(*) FROM figure_links;
SELECT count(*) FROM questions WHERE review_status = 'skeleton_only';
```

Expected: chapter 5 shows `expected = 132, actual = 132, delta = 0`; **zero** chapters with a non-zero delta; `figures` ≥ 63; `figure_links` = 63; `skeleton_only` = 4,115.

The gate for this task is **delta 0 for Laws of Motion**. `CURSOR_PLAN.md`'s book-wide `count(*) from figures = 1,325` is a full-book gate and is out of pilot scope — only the pilot chapter's figures are uploaded. Record the actual figure count in `phase2_report.json` instead of asserting 1,325.

- [ ] **Step 6: Prove students still see nothing**

```sql
SET LOCAL ROLE authenticated;
SELECT count(*) FROM questions;
RESET ROLE;
```

Expected: `0`. All 4,115 rows are `skeleton_only`, so the RLS publishing gate hides them. If this is not zero, the policy from Task 1 is wrong — fix it before Phase 5 writes any bodies.

- [ ] **Step 7: Re-run to prove idempotency**

Run: `C:\Python314\python.exe load_storage.py`

Expected: the same counters, and `SELECT count(*) FROM questions` still returns 4,115. No duplicate rows, no duplicate storage objects.

---

### Task 13: Phase 3 — orphan figures and missing exam dates

**Files:**
- Create: `files/resolve_orphans.py`

**Interfaces:**
- Consumes: `files/out/skeleton.json`, `files/out/figures.json`, `files/out/orphan_figures.json` (88 rows); the original PDF for glyph coordinates
- Produces: `figure_links` rows for resolved orphans; `questions.exam_date` / `exam_shift` updates; `files/out/manual_review.json`

No AI. Two deterministic rules, quoted from `CURSOR_PLAN.md`:

> an orphan sitting at the top of a column (y < 60) belongs to the last question of that same column on the previous page

> For the 228 undated questions: the date tag is on the continuation page. Search the top of the next page's matching column.

Two data facts to build against, both measured:

- **The pilot chapter has zero orphan figures.** All 88 orphans are outside pages 47–60, so the orphan half of this phase is a no-op for the pilot. Run it book-wide anyway — it is free — but gate only on the chapter.
- `column` is spelled differently in the two files: `"L"`/`"R"` in `skeleton.json`, `"left"`/`"right"` in `figures.json`. Normalise before matching, or every rule silently matches nothing.
- Manifest keys minus linked keys is **90**, while `orphan_figures.json` lists **88**. The two extra are `p245_x7015` and `p245_x7016`, the continuation-page halves of two duplicate-checksum pairs that `build_skeleton.py` already recognised. They need no link. Assert exactly these two and fail on any other difference.

The pilot's real work is the **5 undated questions** in chapter 5: `q_no 30` (page 50, column L), `52` and `53` (page 52, L), `70` (page 54, L), `79` (page 54, R).

- [ ] **Step 1: Write `resolve_orphans.py`**

Create `files/resolve_orphans.py`:

1. Load the three JSON files. Normalise `column` to `L`/`R`.
2. Assert `set(manifest_keys) - set(linked_keys) - set(orphan_keys) == {"p245_x7015", "p245_x7016"}`. Exit non-zero with the actual difference if not.
3. For each orphan with `bbox[1] < 60`: find the highest `q_no` on `page - 1` in the same column; emit a `figure_links` row with `role = 'question_body'`. Orphans with `bbox[1] >= 60` go straight to `manual_review.json`.
4. For each undated question: open the PDF with `fitz`, read `page.get_text("dict")` for `page + 1`, scan spans in the matching column with `y < 120` for `^(\d{1,2}) (Jan|Feb|…|Dec) (\d{4}) \((M|E)\)$`, and on a hit write `exam_date` and `exam_shift`. No hit → `manual_review.json`.
5. Print `orphans resolved : N`, `orphans remaining : N`, `dates resolved : N`, `dates remaining : N`.

- [ ] **Step 2: Run it**

Run from `files`: `C:\Python314\python.exe resolve_orphans.py`

Expected: the `p245` assertion passes, and `orphans remaining` plus `dates remaining` are printed. `CURSOR_PLAN.md`'s book-wide gate is `orphan figures < 15, undated questions < 40`.

- [ ] **Step 3: Check the pilot gate**

```sql
SELECT count(*) AS undated_in_pilot
  FROM questions q JOIN chapters c ON c.id = q.chapter_id
  WHERE c.chapter_no = 5 AND q.exam_date IS NULL;
```

Expected: `0`. If any of the five remain, they must appear in `manual_review.json` with their page numbers and be resolved by hand before Phase 8 — an undated question is still extractable, so this does not block Phases 4–7.

- [ ] **Step 4: Confirm nothing was renumbered**

```sql
SELECT count(*) FROM questions;
SELECT count(*) FROM v_ingestion_check WHERE delta <> 0;
```

Expected: `4115` and `0`. The skeleton is immutable; this phase may only fill `exam_date`, `exam_shift`, and `figure_links`.

---

### Task 14: Phase 4 — model bake-off

**Files:**
- Create: `files/bakeoff.py`

**Interfaces:**
- Consumes: `files/out/pages/page_0NN.png`, `files/out/skeleton.json`; env `SARVAM_API_KEY`, `GEMINI_API_KEY`
- Produces: `files/out/bakeoff/<model>/page_0NN.json`, `files/bakeoff_results.md`

Six pages, not `CURSOR_PLAN.md`'s 20, chosen from the pilot chapter's measured density:

| Page | Why | Questions | Figures |
|---|---|---|---|
| 47 | chapter opening, mid density | 9 | 4 |
| 50 | densest page in the chapter | 13 | 5 |
| 54 | text and math dense, few figures | 12 | 3 |
| 57 | **figure-heavy** | 8 | 9 |
| 58 | **math-dense**, almost no figures | 9 | 2 |
| 60 | chapter close | 8 | 7 |

Three candidates, unchanged from the plan: `gemma4` via Sarvam `/v2/chat/completions` with image input; Sarvam Vision through the Doc Agents dashboard (manual, ~15 min); `gemini-flash-lite` as an external control.

- [ ] **Step 1: Write `bakeoff.py`**

Create `files/bakeoff.py`:

1. `PAGES = [47, 50, 54, 57, 58, 60]`.
2. For each page build the skeleton slice: `q_no` list in reading order, `figure_keys` per question, `tier`, `topic`, `exam_date`. Instruct the model to transcribe the stem as Markdown with inline LaTeX, split four options or mark numerical, and place `[[fig:KEY]]` using **only** the supplied keys. `temperature = 0`, `response_format = json`.
3. Score automatically against the skeleton: question count, exact `q_no` set match, `figure_key` placement. Reject and record any unknown `q_no` or `figure_key` — that is the whitelist invariant, and it is a scoring signal here rather than a retry.
4. Write per-model JSON, then `bakeoff_results.md` with a table and a recommendation. Leave LaTeX correctness as a blank column for the human pass.

- [ ] **Step 2: Run it**

Run from `files`: `C:\Python314\python.exe bakeoff.py`

Expected: 6 pages × 2 automated candidates complete; `bakeoff_results.md` exists with automated scores filled and the LaTeX column empty.

- [ ] **Step 3: Score LaTeX by eye and check the gate**

Open each of the six page rasters beside the extracted body and score LaTeX correctness per model. Fill the column in `bakeoff_results.md`.

**Gate:** the leader must reach **90% or better** LaTeX correctness — proceed with that model. If nothing clears **80%**, stop and report. Do not spend the extraction budget. Record the chosen model and the runner-up (the runner-up becomes the Phase 6 observer and the retry escalation target).

- [ ] **Step 4: Append to the progress log**

Append the gate result, actual numbers, actual cost, and anything surprising to `c:\Users\tempo\Downloads\files\PROGRESS.md`, matching the Phase 1 entry's format.

---

### Task 15: Phases 5 and 6 — constrained extraction and second observer

**Files:**
- Create: `files/extract_pass.py`

**Interfaces:**
- Consumes: the Phase 4 winner and runner-up; `files/out/pages/`, `files/out/skeleton.json`
- Produces: `files/out/extracted/pass1/page_0NN.json`, `files/out/extracted/pass2/page_0NN.json`, `files/out/diff_report.json`; `questions.body`, `question_options`, `questions.extraction_confidence`

Scope is the pilot chapter's **14 pages, 47–60**, not the book's 454. One script with a `--model` and `--pass` flag serves both phases, because Phase 6 is Phase 5 with a different model.

- [ ] **Step 1: Write `extract_pass.py`**

Create `files/extract_pass.py`:

1. `--pages 47-60`, `--model <slug>`, `--pass 1|2`.
2. Per page, build the same skeleton-slice prompt the bake-off used. `temperature = 0`, `response_format = json`, concurrency 8, respect Sarvam's 60 req/min on Starter.
3. Persist every raw response to `out/extracted/pass<N>/page_0NN.json` **before** parsing, so a crash never costs a re-run.
4. **Whitelist enforcement at the parser.** Reject any response containing a `q_no` not in that page's skeleton slice or a `figure_key` not on that page's list, and retry the page with a **different** model. Never write unknown keys to the database. Log every rejection with the offending key.
5. On pass 1, write `questions.body` and `question_options` (upsert on `(question_id, option_index)`), and set `review_status = 'unreviewed'`. Never touch `q_no`, `tier`, `topic_id`, `chapter_id`, `exam_date`, or answers.
6. On pass 2, do not write to Postgres. Normalise LaTeX before diffing — collapse whitespace, `\dfrac` → `\frac`, `\left(` → `(` — then emit `diff_report.json` with `agree | differ` per question and both variants.

- [ ] **Step 2: Run pass 1**

Run from `files`: `C:\Python314\python.exe extract_pass.py --pages 47-60 --model <phase4-winner> --pass 1`

**Gate:** every one of the 14 pages returns valid JSON whose `q_no` set exactly matches the skeleton for that page. Verify:

```sql
SELECT count(*) FROM questions q JOIN chapters c ON c.id = q.chapter_id
  WHERE c.chapter_no = 5 AND q.body IS NOT NULL;
SELECT count(*) FROM question_options qo
  JOIN questions q ON q.id = qo.question_id
  JOIN chapters c ON c.id = q.chapter_id
  WHERE c.chapter_no = 5;
```

Expected: `132` bodies. Options should be `113 × 4 = 452` — the 19 numericals have none. If options exceed 452, the model fabricated options for a numerical; fix the prompt and re-run that page.

- [ ] **Step 3: Run pass 2 with a different model**

Run: `C:\Python314\python.exe extract_pass.py --pages 47-60 --model <phase4-runner-up> --pass 2`

**Gate:** `diff_report.json` covers all 132 questions. `CURSOR_PLAN.md` expects 10–15% disagreement; record the actual rate rather than assuming it.

- [ ] **Step 4: Confirm the skeleton is intact**

```sql
SELECT count(*) FROM v_ingestion_check WHERE delta <> 0;
SELECT min(q_no), max(q_no), count(*) FROM questions q
  JOIN chapters c ON c.id = q.chapter_id WHERE c.chapter_no = 5;
```

Expected: `0`; then `1, 132, 132`. Any other result means a stage added, removed, or renumbered a question — revert it.

- [ ] **Step 5: Append to the progress log**

Append both gate results, the actual disagreement rate, and the actual cost to `PROGRESS.md`.

---

### Task 16: Phase 7 — solve-verify

**Files:**
- Create: `files/solve_verify.py`

**Interfaces:**
- Consumes: extracted stems and options from Postgres; the 52 chapter figures from Storage; `skeleton.json`'s `answer_value`
- Produces: `files/out/solve_verify.json`; `questions.review_status` set to `auto_ok` or `flagged`

- [ ] **Step 1: Write `solve_verify.py`**

Create `files/solve_verify.py`:

1. Select all 132 chapter-5 questions with their options and figure public URLs.
2. Send stem, options, and — for the 52 questions that have them — the figure images to `glm5.3-flash` on Sarvam. Ask for the answer only: an option number, or a numeric value.
3. Compare to `answer_value` from `skeleton.json`. Record `solve_match: true|false` per question.
4. Set `review_status = 'auto_ok'` where `solve_match` is true **and** the Phase 6 diff says `agree`; `flagged` otherwise.
5. Document the blind spot in the output file: this validates the answer path only. It cannot detect corruption in the distractor strings or in stem details that do not affect the calculation.

- [ ] **Step 2: Run it**

Run from `files`: `C:\Python314\python.exe solve_verify.py --chapter 5`

**Gate:** all 132 have a verdict.

```sql
SELECT review_status, count(*) FROM questions q
  JOIN chapters c ON c.id = q.chapter_id WHERE c.chapter_no = 5
  GROUP BY review_status ORDER BY review_status;
```

Expected: `auto_ok` + `flagged` = 132, with no `skeleton_only` and no `unreviewed` left.

- [ ] **Step 3: Confirm students now see the auto_ok rows only**

```sql
SET LOCAL ROLE authenticated;
SELECT count(*) FROM questions;
RESET ROLE;
```

Expected: exactly the `auto_ok` count from step 2. Nothing `flagged` is visible.

- [ ] **Step 4: Append to the progress log**

Append the verdict split, the actual cost, and the blind-spot note to `PROGRESS.md`.

---

### Task 17: Phase 8 — gold sample

**Files:**
- Create: `files/gold_sample.py`

**Interfaces:**
- Consumes: the 132 extracted questions; `files/out/pages/` crops; `files/out/figures/`
- Produces: `files/out/gold_sample.html`, `files/out/gold_corrections.json`, `files/accuracy_report.md`

**~30 of the 132**, not `CURSOR_PLAN.md`'s 200 — sized to the chapter. Stratify by tier (concept_builder / must_do / advanced), figure / no-figure, and MCQ / numerical, so the sample reflects the chapter's real 29/79/24, 52/80, and 113/19 splits.

This produces the **only accuracy number anyone may quote**. `plan.html`'s ~99% answer accuracy, 97–98% option accuracy, and "0 diagrams missed" are unmeasured and must not be repeated.

- [ ] **Step 1: Write `gold_sample.py`**

Create `files/gold_sample.py`:

1. Stratified random sample of ~30 from the 132, seeded so the sample is reproducible. Print the achieved strata counts.
2. Emit `gold_sample.html`: for each question, the page crop from `out/pages/` on the left; the extracted body, options, figures, and answer on the right; a `Correct` / `Wrong` radio pair and a free-text correction box per field.
3. Read the saved corrections back into `gold_corrections.json`.
4. Compute the error rate with a 95% confidence interval, **separately** for answer-affecting content and distractor content. Write `accuracy_report.md`.

- [ ] **Step 2: Run it and review every character**

Run from `files`: `C:\Python314\python.exe gold_sample.py --chapter 5 --n 30`

Then open `files/out/gold_sample.html` and verify every character of all ~30 questions by hand.

- [ ] **Step 3: Check the gate**

`accuracy_report.md` exists and states both error rates with 95% confidence intervals and the sample size. From here on, that file is the only source for any accuracy claim about this import. Anything in `plan.html` stays unquotable.

- [ ] **Step 4: Append to the progress log**

Append the measured error rates, the confidence intervals, and the achieved strata counts to `PROGRESS.md`.

---

### Task 18: Phase 9 — review queue and publish

**Files:**
- Create: `files/review_queue.py`

**Interfaces:**
- Consumes: `files/out/diff_report.json`, `files/out/solve_verify.json`, `questions.extraction_confidence`
- Produces: `files/out/review_queue.json`; `questions.review_status` promoted to `human_ok`

- [ ] **Step 1: Write `review_queue.py`**

Create `files/review_queue.py`:

1. Build the queue from three sources: two-model disagreement in `diff_report.json`, `solve_match = false` in `solve_verify.json`, and low `extraction_confidence`.
2. Rank riskiest first: questions with figures, then match-lists, then by LaTeX token density.
3. Ship a minimal review UI — page crop on the left, editable extraction on the right, approve and fix buttons. On approve, set `review_status = 'human_ok'`.
4. Write `review_queue.json` with the ranked list and each item's reason.

- [ ] **Step 2: Run it and work the queue**

Run from `files`: `C:\Python314\python.exe review_queue.py --chapter 5`

Then work the queue until it is empty or every remaining item is consciously deferred with a recorded reason.

- [ ] **Step 3: Check the publishing gate**

```sql
SELECT review_status, count(*) FROM questions q
  JOIN chapters c ON c.id = q.chapter_id WHERE c.chapter_no = 5
  GROUP BY review_status;

SET LOCAL ROLE authenticated;
SELECT count(*) FROM questions;
RESET ROLE;
```

Expected: the `authenticated` count equals `auto_ok` + `human_ok` and nothing else. Any `flagged` row left is invisible to students by construction.

- [ ] **Step 4: Verify the app end to end on real data**

With `npm run dev:turbo` running, repeat the Task 11 step 5 manual checks against real data rather than the fixture. The **Laws of Motion** card must read the same number as:

```sql
SELECT count(*) FROM questions q JOIN chapters c ON c.id = q.chapter_id
  WHERE c.catalog_slug = 'laws-of-motion' AND q.review_status IN ('auto_ok','human_ok');
```

At full publication that is 132, giving 5 sets of 27/27/26/26/26. Advanced alone gives 1 set of 24.

- [ ] **Step 5: Retire the fixture**

Delete the six fixture questions so they cannot be mistaken for real extractions:

```sql
DELETE FROM public.questions q
  USING public.chapters c
  WHERE c.id = q.chapter_id AND c.chapter_no = 5
    AND q.source_page IN (47, 48, 49)
    AND q.body LIKE '%A body of mass $m$ moves with constant velocity%';
```

Then re-run the count query from step 4 and confirm it still equals the published total. Safer alternative: truncate and re-run Tasks 12 and 15 for the chapter.

- [ ] **Step 6: Append the final progress entry**

Append the queue size, how many items were approved versus deferred, and the final published count to `PROGRESS.md`.

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Pilot scope: Laws of Motion, PDF chapter 5, 132 questions, pages 47–60 | 12, 15 |
| Phase 0 executed; `pymupdf==1.26.3` pin recorded as a requirement | 12 |
| Phase 1 executed; `skeleton.json` immutable | 12 (consumed), 13, 15 (asserted) |
| Known defect: `figure_key` collision on page 420, 11 manifest duplicate groups | 12 |
| Schema correction 1: `questions.body` nullable | 1 |
| Schema correction 2: `skeleton_only` a documented `review_status` | 1 |
| Schema correction 3: `chapters.catalog_slug`, deliberately not unique | 1 |
| Migration in `Web/supabase/migrations/` with the `YYYYMMDDHHMMSS` convention, applied | 1 |
| Physics 28 → 29 via `Communication System` appended, syllabus order kept | 2 |
| All 32 PDF-chapter rows; merges; PDF chapter 17 deferred | 3 |
| Merge rule: no route or chapter page for a PDF chapter that became a topic | 3, 11 |
| Two label levels: `chapters.name` coarse, `topics.name` fine | 4, 9 |
| Phase 2: expected counts, SHA-256 dedupe, idempotent upload, 4,115 skeleton rows | 12 |
| Phase 2 gate: `v_ingestion_check` delta 0 for Laws of Motion | 12 |
| Phase 3: deterministic orphan and date repair, no AI | 13 |
| Phase 4: ~6 pages including one figure-heavy and one math-dense; 90% / 80% gate | 14 |
| Phases 5 and 6: 14 pages, Sarvam, `temperature = 0`, `response_format = json`, second observer, LaTeX normalised before diffing | 15 |
| Whitelist enforcement at the parser; retries escalate to a different model | 15 |
| Phase 7: solve-verify against `answer_value` | 16 |
| Phase 8: gold sample of ~30, the only quotable accuracy number | 17 |
| Phase 9: review queue, then publish | 18 |
| Never base64 an image into Postgres; store the storage path | 1, 12 |
| Never run layout detection on this PDF | 13, 14, 15 (glyph coordinates only) |
| Numeric answer input plus an answer-comparison path; no `buildNumericMcq` behaviour | 4, 7 |
| Shells stay pure-props; mock flow does not regress | 7 (optional props), 11 (step 5 check 9) |
| Tier filter plus per-question badge over the three tiers | 4, 9, 11 |
| Session shape: `max(1, round(total / 25))`, even sizes, no stubs, 2 min per question | 5, 8 |
| `ChapterPyqExamSession` mirrors only the useful parts of `MockPageContent`, imports nothing from it | 8 |
| Supabase Storage images wired into `patchMockHtmlImages` | 6 |
| Chapter card count replaces `CHAPTER_PYQ_QUESTION_COUNT = 0` | 2, 10, 11 |
| `Questions coming soon` replaced, kept for zero-question chapters | 11 |
| Publishing gate: students see only `auto_ok` / `human_ok`; counts match | 1 (RLS), 10 (query), 12/16/18 (verified) |
| App work testable before the model phases | 10 (fixture), 11 (step 5) |
| Non-goals: other 31 chapters, Chemistry/Maths PDFs, solutions, chapter 17, resume, `MockPageContent` rework | omitted everywhere |

## Placeholder scan

No TBD steps. Every code step carries the code. Every verification step carries a real command and a stated expected result.

Three values are deliberately resolved at execution time rather than guessed, and each has an explicit source:

- `<phase4-winner>` and `<phase4-runner-up>` in Task 15 are the model slugs decided by the Task 14 gate. Task 14 step 3 requires both to be recorded in `bakeoff_results.md`.
- The LaTeX-correctness column in `bakeoff_results.md` is a human judgement by design (Task 14 step 3), not a missing step.
- Task 12's `figures` row count is recorded in `phase2_report.json` rather than asserted, because only the pilot chapter's 63 figures are uploaded. `CURSOR_PLAN.md`'s `count(*) from figures = 1,325` is a full-book gate and is stated as out of pilot scope.

Contradiction check across tasks and constraints:

- `ChapterPyqTier` is declared once in `tiers.ts` (Task 4) and imported by Tasks 4, 9, and 11. No competing definition.
- `ChapterPyqQuestion` is declared once in `pyqQuestionMap.ts` (Task 4) and consumed by Tasks 8, 10, and 11 under that exact name.
- `figures.storage_path` is `pyq/physics/figures/<figure_key>` in Task 1's comment, Task 6's regex, Task 10's fixture, and Task 12's upload. `figure_key` is `p{page:03d}_x{xref}` — zero-padded page — in all four.
- The page count is **14** (pages 47–60 inclusive) in Tasks 12, 13, and 15. `CURSOR_PLAN.md`'s `20 pages` for Phase 4 is explicitly narrowed to 6 named pages in Task 14.
- `CHAPTER_PYQ_QUESTION_COUNT` is deleted in Task 2 and never referenced afterwards; Task 11 supplies live counts.
- Task 2 leaves `ChapterPyqListView` rendering `Practice` and Task 11 replaces it. No other task touches that line.
- Commit steps appear only on the Web tasks, are always the last step, and are always gated on explicit user request. The ingestion tasks (12–18) have no commit steps at all, since they write outside the repo.
- No task writes to EduDeca or EduBite. No task quotes an accuracy number; Task 17 is the only task that produces one.
