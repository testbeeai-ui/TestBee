# Chapter PYQ — Physics question import (pilot)

**Status:** Approved  
**Product:** EduBlast Web  
**Date:** 2026-09-11  
**Branch:** `edudeca`  
**Predecessor spec:** [`2026-09-11-chapter-pyq-design.md`](./2026-09-11-chapter-pyq-design.md)  
**Implementation plans:** [`2026-09-11-chapter-pyq-physics-ingestion.md`](../plans/2026-09-11-chapter-pyq-physics-ingestion.md) — database and Phases 2–9 · [`2026-09-11-chapter-pyq-physics-app.md`](../plans/2026-09-11-chapter-pyq-physics-app.md) — routes, player, numeric input, tier filter, figures

The two plans were written in parallel and split the work cleanly: the ingestion plan is the authority on database shape, the app plan on app shape. Where this spec and a plan disagree on a name, the plan wins and this spec is the thing that is out of date.

The predecessor shipped the UI shell: entry point, routes, catalog, and a *Questions coming soon* empty state. This spec covers importing real questions into that shell.

## Goal

Import real JEE Main previous-year Physics questions from the MathonGo PYQ book into `/chapter-pyq`, proven end-to-end on one complete chapter, with students able to sit a real-exam-style set and be scored.

## Source material

| Item | Value |
|------|-------|
| PDF | `C:\Users\tempo\Downloads\MathonGo PYQ Book (JEE Main 2025 - 2019) - Physics.pdf` |
| Size | 463 pages · 32 chapters · 4,115 questions · 1,337 figures |
| Nature | Digital-born, full text layer with glyph coordinates |
| Answers | Answer key only, pages 455–463 |
| Solutions | **None.** MathonGo keeps worked solutions in their own app |
| Provenance format | Short date tags, e.g. `30 Jan 2024 (E)` = 30 January 2024, evening shift |
| Question tiers | `CONCEPT BUILDER`, `MUST DO`, `ADVANCED` |

Ingestion plan and scripts live in `c:\Users\tempo\Downloads\files`:

| File | Role |
|------|------|
| `CURSOR_PLAN.md` | 9-phase ingestion plan with per-phase acceptance gates |
| `schema.sql` | Postgres schema for the question bank |
| `extract_assets.py` | Phase 1 — figure and page-raster extraction |
| `build_skeleton.py` | Phase 1 — skeleton and answer-key build |
| `plan.html` | Presentation of the plan (see Risks) |
| `PROGRESS.md` | Execution log; holds the Phase 1 report including the full per-chapter question count table |

## Pilot scope

One complete chapter: **Laws of Motion** — PDF chapter 5, pages 47–60, 132 questions.

Pages 47 to 60 inclusive is **14** pages, and all 132 questions sit on them. Pages 46 and 61 are chapter dividers carrying no `Q` anchor, so there is no fifteenth page to extract from — every per-page count in this spec is 14, not 15.

Chosen for two reasons. It maps 1:1 onto the existing catalog chapter, so no taxonomy decision blocks it. It is dense with free-body diagrams, so the figure pipeline is exercised rather than avoided.

Phase 1 measured the chapter:

| Laws of Motion | Count |
|---|---|
| Questions | 132 |
| MCQ | 113 |
| Numerical | 19 |
| With at least one figure | 52 (63 figure links) |
| Must Do | 79 |
| Concept Builder | 29 |
| Advanced | 24 |
| Topics | 5 |
| Missing `exam_date` | 5 |

The pilot choice was validated by those numbers: 39% of this chapter's questions carry figures against a book-wide average of 23%, so the figure pipeline is genuinely exercised rather than nominally touched.

Deliverable: a signed-in student opens `/chapter-pyq/physics/laws-of-motion`, filters by tier if they want, sits a timed set, and is scored.

## Phase plan

Phases 0 and 1 have been executed. `skeleton.json`, `answer_key.json`, and the extracted assets had gone missing from disk despite `CURSOR_PLAN.md` marking Phase 1 done, which is why the phase ran; they are now regenerated.

Phase 1 ran against the whole book — the full 4,115-question skeleton is useful ground truth and costs nothing. Phases 4 onward are scoped to the Laws of Motion pages.

| Phase | Pilot scope | Change from `CURSOR_PLAN.md` |
|-------|-------------|------------------------------|
| 0 Environment | Local Python setup | **New phase** — executed, passed |
| 1 Skeleton | Whole book | Re-run — executed, passed |
| 2 Storage | Schema + Laws of Motion figures | Three schema defects fixed first |
| 3 Orphans and dates | Chapter pages only | Unchanged |
| 4 Bake-off | ~6 pages, not 20 | Shrunk; must still include one figure-heavy and one math-dense page |
| 5 Extraction | 14 pages | Unchanged |
| 6 Second observer | Same 14 pages | Unchanged |
| 7 Solve-verify | 132 questions | Unchanged |
| 8 Gold sample | ~30 of the 132, not 200 | Sized to the chapter |
| 9 Review queue | Whatever falls out | Gate unchanged: publish only `auto_ok` / `human_ok`; promotion rule now defined |

To be precise about Phase 2: it inserts all 4,115 skeleton rows (`body = null`, `review_status = 'skeleton_only'`), because the rows are free and `v_pyq_ingestion_check` reconciles per chapter. Only the figure upload narrows to Laws of Motion. Phase 3 narrows to the chapter pages. Everything from Phase 4 on costs money per page, which is the reason it narrows.

Estimated cost ~₹25–30, against the plan's ~₹800 for the full book. Extraction engine is **Sarvam**, per the original plan; the user has the key.

### The `auto_ok` promotion rule

Neither `CURSOR_PLAN.md` nor the first draft of this spec said when a question becomes `auto_ok`. The ingestion plan defines it: **both extraction passes agree (`extraction_confidence = 1.0`) and solve-verify matched the answer key** promotes to `auto_ok`; anything else — passes differ, `solve_match` false, confidence below 1.0 — becomes `flagged` and enters the review queue.

That gap mattered more than it looks. Phase 6 leaves every extracted question at `unreviewed`, and students see only `auto_ok` / `human_ok`. Without a promotion rule nothing ever crosses the publishing gate, so the chapter page renders empty and the chapter card reads zero no matter how good extraction was — the whole pipeline would pass its own gates and still ship nothing.

### Phase 0 — environment setup (executed, passed)

Python 3.14.7 at `C:\Python314\python.exe`, no virtualenv. The anticipated risk — no `pymupdf` wheel for Python 3.14 — did not occur. A different problem did: Windows Smart App Control blocked PyMuPDF 1.28.2's `_mupdf.pyd` on reputation grounds, logging CodeIntegrity events 3077 and 3118, so the import failed even though the wheel installed. Pinning **`pymupdf==1.26.3`** produces a binary that loads.

Treat that pin as a requirement, not a workaround: anyone re-running Phase 1 on this machine needs `pymupdf==1.26.3`. `supabase`, `httpx`, `pydantic`, and `tenacity` installed clean.

### Phase 1 — skeleton and assets (executed, passed)

The reconciliation gate printed `chapters mismatching : 0` — all 32 chapters reconcile against the answer key.

| Measure | Value |
|---|---|
| Questions | 4,115 (expected 4,115) |
| Answers | 4,115 |
| Questions with figures | 947 |
| Orphan figures | 88 — matches the plan's prediction |
| Questions with null `exam_date` | 228 |
| Page rasters | 454 |
| `./out` on disk | 365 MB |
| Runtime | 9 min 39 s |
| Cost | ₹0 |

Neither `extract_assets.py` nor `build_skeleton.py` needed modification.

### Known defect — `figure_key` collision on page 420

Phase 1 emitted **1,336 figure rows, not the expected 1,337**, and only 1,335 PNGs are on disk. `figure_key` is `p{page:03d}_x{xref}`, and page 420 places the same image object at two different bounding boxes, so both rows resolve to `p420_x3821`: the key collides and one save overwrote the other. Both writes are byte-identical (6,859 bytes) and no reference dangles.

Consequence for Phase 2, stated precisely because the two dedupe domains differ. Deduping the 1,335 **files** yields the ten page-spanning duplicate groups `CURSOR_PLAN.md` predicts and 1,325 unique checksums. Deduping the 1,336 **manifest rows** in `figures.json` yields an **eleventh** group, the repeated `p420_x3821`, so any Phase 2 loop that walks the manifest must tolerate the repeat rather than treat it as a parse error. Page 420 is in Semiconductors, so the pilot chapter is unaffected either way.

Do not "fix" the key scheme. `skeleton.json` is immutable per the plan's first invariant.

## Schema corrections

Blocking Phase 2. `schema.sql` has **three** defects, not one, and all three are fixed at migration time.

1. **`questions.body text not null`** contradicts Phase 2's own skeleton insert, which writes `body = null`. `pyq_questions.body` becomes nullable.
2. **`skeleton_only` is missing from the documented `review_status` values.** The full list is `unreviewed`, `skeleton_only`, `auto_ok`, `flagged`, `human_ok`, and it becomes a real `CHECK` constraint rather than a trailing comment — a comment is why the `skeleton_only` write was never caught at design time.
3. **`primary key (figure_id, question_id, coalesce(option_id, …))`** on line 129 is invalid SQL. Postgres does not permit expressions in a primary key constraint. `pyq_figure_links` gets a surrogate `id` plus a unique **expression index** over the same three terms, which does accept the `coalesce`.

Defects 1 and 2 both fail on Phase 2's first insert; defect 3 fails earlier still, when the schema is applied at all.

One addition on top of the fixes:

4. New column `pyq_chapters.catalog_slug text` — the app chapter page a row belongs to.

**Table names.** The migration lands every table under a `pyq_` prefix: `pyq_subjects`, `pyq_units`, `pyq_chapters`, `pyq_topics`, `pyq_questions`, `pyq_question_options`, `pyq_figures`, `pyq_figure_links`, `pyq_ingestion_runs`, and the view `v_pyq_ingestion_check`. The enums follow — `pyq_question_tier`, `pyq_question_format`, `pyq_exam_shift`, `pyq_figure_role`. The bare names were free, so this is a clarity decision rather than a forced one: `public` already holds `mock_questions`, `past_paper_questions`, `play_questions`, `learning_outcomes_questions` and `saved_questions`, and a bare `public.questions` holding only JEE Physics previous-year rows would mislead anyone who found it later. Read every unprefixed name in this spec as its prefixed migration equivalent.

**Row-level security.** The migration enables RLS on all nine tables and enforces the publishing gate in the database: `pyq_questions` is readable only where `review_status in ('auto_ok','human_ok')`, and the `pyq_question_options` / `pyq_figure_links` policies inherit that through their parent question. Ingestion writes with the service-role key, which bypasses RLS. So do the app's two read routes, which use the service-role client — RLS is therefore not an obstacle on the app path, and the app keeps its own publishable filter rather than depending on which client it holds.

The schema lands as a migration in the Web Supabase project, following the existing convention in `Web/supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`).

## Chapter taxonomy

The app catalog stays the student-facing source of truth. Physics grows from 28 to 29 chapters by adding **Communication System** — the only genuinely new chapter. Mathematics in Physics and Experimental Physics become topics under **Units and Measurements** instead: Experimental Physics is vernier/screw-gauge error analysis and Mathematics in Physics is the vectors-and-calculus primer, both measurement and maths groundwork rather than standalone syllabus chapters.

`PHYSICS_NAMES` in `Web/lib/chapter-pyq/catalog.ts` is **syllabus-ordered, not alphabetical** (it runs Units and Measurements → Semiconductor Electronics in NCERT order). Follow that ordering: `Communication System` goes last, after `Semiconductor Electronics`. This also matches the PDF's own chapter order. Do not alphabetise the array. Slugs are derived by `slugify`, so no manual slug entry is needed.

### Merge rule

A PDF chapter mapped to a topic gets **no chapter page of its own**. There is no route for it and it never appears in the chapter list. Its questions load into the **parent catalog chapter's** page, alongside questions from any other PDF chapter that maps there.

Several PDF chapters can collapse into one catalog chapter. PDF chapters 7 (Center of Mass Momentum and Collision) and 8 (Rotational Motion) both surface on the single catalog chapter "System of Particles and Rotational Motion".

Routing is by `pyq_chapters.catalog_slug`. **That column is deliberately not unique** — several `pyq_chapters` rows share one slug when they merge, and that non-uniqueness *is* the merge rule, so it must survive any later tidying of the schema. `pyq_chapters` rows stay distinct via the existing `unique(chapter_no)`, and the slug carries a plain index, never a unique one.

**Two label levels, no new column needed.** A question already links to its PDF chapter row via `chapter_id`, which carries both `name` (the PDF chapter title) and `catalog_slug` (the app chapter it renders under). The PDF's own in-chapter topic heading is separately captured in the existing `pyq_topics` table via `pyq_questions.topic_id`. So on a merged chapter page, `pyq_chapters.name` is the coarse grouping label ("Rotational Motion") and `pyq_topics.name` is the finer one ("Moment of Inertia").

### PDF chapter → app catalog chapter

| PDF # | PDF chapter title | App catalog chapter | Note |
|-------|-------------------|---------------------|------|
| 1 | Mathematics in Physics | Units and Measurements | Becomes a topic |
| 2 | Units and Dimensions | Units and Measurements | Rename |
| 3 | Motion In One Dimension | Motion in a Straight Line | Rename |
| 4 | Motion In Two Dimensions | Motion in a Plane | Rename |
| 5 | Laws of Motion | Laws of Motion | 1:1 — pilot chapter |
| 6 | Work Power Energy | Work, Energy and Power | Rename |
| 7 | Center of Mass Momentum and Collision | System of Particles and Rotational Motion | Becomes a topic |
| 8 | Rotational Motion | System of Particles and Rotational Motion | Becomes a topic |
| 9 | Gravitation | Gravitation | 1:1 |
| 10 | Mechanical Properties of Solids | Mechanical Properties of Solids | 1:1 |
| 11 | Mechanical Properties of Fluids | Mechanical Properties of Fluids | 1:1 |
| 12 | Oscillations | Oscillations | 1:1 |
| 13 | Waves and Sound | Waves | Rename |
| 14 | Thermal Properties of Matter | Thermal Properties of Matter | 1:1 |
| 15 | Thermodynamics | Thermodynamics | 1:1 |
| 16 | Kinetic Theory of Gases | Kinetic Theory of Gases | 1:1 |
| 17 | Electrostatics | Electric Charges and Fields + Electrostatic Potential and Capacitance | **Deferred** — straddles two catalog chapters |
| 18 | Capacitance | Electrostatic Potential and Capacitance | Becomes a topic |
| 19 | Current Electricity | Current Electricity | 1:1 |
| 20 | Magnetic Properties of Matter | Magnetism and Matter | Rename |
| 21 | Magnetic Effects of Current | Moving Charges and Magnetism | Rename |
| 22 | Electromagnetic Induction | Electromagnetic Induction | 1:1 |
| 23 | Alternating Current | Alternating Current | 1:1 |
| 24 | Ray Optics | Ray Optics | 1:1 |
| 25 | Wave Optics | Wave Optics | 1:1 |
| 26 | Dual Nature of Matter | Dual Nature of Radiation and Matter | Rename |
| 27 | Atomic Physics | Atoms | Rename |
| 28 | Nuclear Physics | Nuclei | Rename |
| 29 | Electromagnetic Waves | Electromagnetic Waves | 1:1 |
| 30 | Semiconductors | Semiconductor Electronics | Rename |
| 31 | Communication System | Communication System | New catalog chapter |
| 32 | Experimental Physics | Units and Measurements | Becomes a topic |

PDF chapter 17 (Electrostatics) is **out of pilot scope**. Its questions span two catalog chapters and cannot be routed without per-question classification, which is better solved with real extracted data in hand. Consequence: "Electric Charges and Fields" has no question source until that is resolved.

Units and Measurements aggregates three PDF chapters — 1 (Mathematics in Physics), 2 (Units and Dimensions), and 32 (Experimental Physics). It will be the largest chapter in the catalog by question count.

## App integration

Reuse the existing NTA real-exam player.

### Reused

| Piece | Location |
|-------|----------|
| `NtaExamShell`, `NtaExamShellMobile` | `Web/components/prep-mock/nta/` — additive numeric mode only |
| `NtaQuestionStem`, `NtaOptionBody`, `NtaRichTextBlock` | `Web/components/prep-mock/nta/ntaExamParts.tsx` |
| `NtaMockTokens`, `NtaGeneralInstructions`, `NtaSubmitModal`, `NtaProceedWarningDialog`, palette shapes | `Web/components/prep-mock/nta/` |
| KaTeX pipeline — `sanitizeMockHtml`, `mockRichTextKatex`, `useKatexAutoRender` | `Web/lib/mock/`, `Web/hooks/` |

The two shells are pure props: they take `Question[]`, an answers map, and callbacks. That contract stays. The one change they need is the numeric answer mode in addition 1 below, and it must be additive — optional props whose defaults reproduce today's MCQ-only rendering, so the mock flow does not regress.

### Not reused

`MockPageContent` (1,926 lines) is welded to the mock domain — paper catalogs, quota gating, RDM bonuses, community sharing, attempt recording. Chapter PYQ gets a new thin orchestrator, **`ChapterPyqExamSession`**, that owns timer and answer state and mirrors only the useful parts of it: answer handlers, timer effect, shell wiring.

### Four additions

1. **Numeric answer input.** The shell today renders four radio buttons and stores an answer as an option index. The existing mock importer works around numericals by fabricating three wrong integers (`buildNumericMcq` in `Web/scripts/import-mock-paper-json.ts`), which is not real exam behaviour — actual JEE Main gives a numeric keypad, and fabricated distractors make the question easier than it is. **19 of the pilot chapter's 132 questions (14%) are numerical**, which is too many to hide behind fabricated options, so genuine numeric input plus an answer-comparison path is a hard requirement for the pilot rather than a nice-to-have. It benefits the mock product too.
2. **Tier filter** on the chapter page — a filter plus a per-question badge over `concept_builder` / `must_do` / `advanced`. No precedent exists in Web for these values; the closest patterns are the Lessons `[level]` route segment and the mock library's pre-start filter chips. Filter the question array before it reaches the shell.
3. **Session shape.** A fixed 25 per set leaves stubs once the real counts are in: 132 gives five sets of 25 plus a 7-question tail, and the tier-filtered Advanced list has only 24 questions in total. The rule instead:

   > Set count is `max(1, round(total / 25))`. Sizes are distributed as evenly as possible and differ by at most one. No stub sets. Timer is 2 minutes per question in the set.

   Worked examples: unfiltered 132 → 5 sets of 27/27/26/26/26; Must Do 79 → 3 sets of 27/26/26; Concept Builder 29 → 1 set of 29; Advanced 24 → 1 set of 24. Sets stay sequential within the tier-filtered list.
4. **Images from Supabase Storage.** Today `patchMockHtmlImages` (`Web/lib/mock/mockRichTextKatex.ts`) only proxies Testbee URLs through `/api/mock/question-image`; every other `src` passes through untouched. Figures live at `pyq/physics/figures/` and need wiring into that pipeline.

Also: the chapter card's question count replaces the hardcoded `CHAPTER_PYQ_QUESTION_COUNT = 0` in `Web/lib/chapter-pyq/catalog.ts` with a live count of publishable questions.

**Publishing gate.** Students see only questions with `review_status in ('auto_ok','human_ok')`. Counts reflect the same filter.

## Non-goals

- The other 31 PDF chapters
- The Chemistry and Mathematics PDFs
- Worked solutions
- The Electrostatics split (PDF chapter 17)
- Mid-session resume
- Reworking `MockPageContent`
- Mapping the existing 137 full JEE papers onto chapters

## Risks

- **PyMuPDF version pin.** Retired as a risk by Phase 0, but load-bearing: Smart App Control blocks 1.28.2's `_mupdf.pyd` on this machine, so `pymupdf==1.26.3` must stay pinned.
- **Licensing.** The MathonGo book is copyrighted. Moving 4,115 questions and 1,337 figures into Supabase Storage is a licensing question the plan does not address.
- **No worked solutions.** Students see right/wrong and the correct answer, never an explanation. This is a product gap, not a pipeline gap.
- **Unmeasured accuracy claims.** `plan.html` states ~99% answer accuracy, 97–98% option accuracy, and "0 diagrams missed". Those numbers are unmeasured and contradict `CURSOR_PLAN.md`'s own figures (88 orphan figures, 94.5% dates resolved). Do not treat them as spec. Phase 8's gold sample is the only accuracy figure anyone may quote.

## Testing

| Check | Passes when |
|-------|-------------|
| Phase 1 reconciliation | Mismatching chapters = 0 |
| Phase 2 storage | `v_pyq_ingestion_check` delta is 0 for Laws of Motion |
| Extraction fidelity | Every extracted page's question numbers match the skeleton exactly |
| Chapter card count | Equals the count of publishable questions |
| Scoring | One MCQ and one numerical question each score correctly |
| Figures | A question with a figure renders its image |
| Tier filter | Changing the tier changes the set size |
| Publishing gate | Unreviewed questions never appear to a student |
| Merged chapter | A merged catalog chapter shows questions from every PDF chapter that maps to it, each carrying the right coarse topic label |
| No orphan routes | No chapter page or route exists for a PDF chapter that maps to a topic |
