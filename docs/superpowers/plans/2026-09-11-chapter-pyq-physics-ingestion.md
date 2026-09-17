# Chapter PYQ Physics Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 132 Laws of Motion questions from the MathonGo JEE Main Physics PYQ book into the Web Supabase project with bodies, options, figures, and a review verdict, so that publishable rows exist for the app to read.

**Architecture:** The immutable `skeleton.json` from Phase 1 is the spine. A migration lands the question-bank schema in the Web Supabase project under a `pyq_` table prefix, then a sequence of Python scripts in `c:\Users\tempo\Downloads\files\` walk the skeleton: seed taxonomy, upload figures and insert skeleton rows, repair page-boundary artifacts deterministically, pick an extraction model by bake-off, extract bodies twice with two different models, solve-verify the answers, measure accuracy on a gold sample, then promote or queue each question for review. Every model stage writes raw JSON to `out/` first so a crash never costs a re-run, and every stage appends its result to `PROGRESS.md`.

**Tech Stack:** Python 3.14.7 at `C:\Python314\python.exe` (no virtualenv), `pymupdf==1.26.3`, `supabase`, `httpx`, `pydantic`, `tenacity`; Supabase Postgres + Supabase Storage; Sarvam `/v1/chat/completions` as the extraction engine with Gemini as the second observer; PowerShell as the shell.

## Global Constraints

- Web only. Do not touch EduDeca or EduBite.
- JEE Main Physics only. Pilot chapter is Laws of Motion — PDF chapter 5, pages 47–60, 132 questions.
- `skeleton.json` is immutable. No stage may add, remove, renumber, or re-link questions. Models fill `body` and `options` only.
- Whitelist enforcement at the parser: reject any model response containing an unknown `q_no` or `figure_key`, and retry the page.
- Never run layout-detection models (Docling, Surya, LayoutParser) on this PDF; glyph coordinates are already available.
- Never base64 images into Postgres. Store the storage path only.
- Retries escalate to a different model. Re-running the same model on a failed page reproduces systematic misreads.
- Quote no accuracy number that was not measured against the Phase 8 gold sample. `plan.html`'s ~99% / 97–98% / "0 diagrams missed" are not spec.
- `pymupdf==1.26.3` is pinned — Windows Smart App Control blocks 1.28.2's `_mupdf.pyd` on this machine (CodeIntegrity events 3077 / 3118).
- Students see only `review_status in ('auto_ok','human_ok')`.
- Commit only when the user explicitly asks (repo rule). Skip commit steps until then.
- The shell is PowerShell. `&&` is **not** a valid separator — use `;` or separate lines.
- Set `$env:PYTHONUTF8 = "1"` before any script that prints extracted text. The console is cp1252 and `U+2212` (minus sign, common in this book) raises `UnicodeEncodeError` otherwise.
- Scope ends when reviewed questions sit in Supabase, publishable. The Web app UI (routes, player, numeric input, tier filter, image proxy) is a **sibling plan** — do not build app code here.

## Starting state — Phase 0 and Phase 1 are already executed and passed

Do not re-run them. Their outputs are the inputs to Task 1.

| Artifact in `c:\Users\tempo\Downloads\files\out\` | Content |
|---|---|
| `skeleton.json` | 4,115 records — the spine. `body` and `options` null, `review_status` `skeleton_only` |
| `answer_key.json` | 32 chapters, 4,115 answers, book's own ground truth |
| `figures.json` | 1,336 manifest rows / 1,335 distinct `figure_key`s |
| `figures/` | 1,335 PNGs, 19.0 MB |
| `pages/` | 454 page rasters at 200 dpi, 343.4 MB |
| `orphan_figures.json` | 88 unassigned figures |
| `analysis.json` | Phase 1 read-only analysis |

Phase 1's gate printed `chapters mismatching : 0 []`. Existing scripts, not to be modified: `extract_assets.py`, `build_skeleton.py`, `analyze_skeleton.py`.

Laws of Motion, as measured by Phase 1 and re-verified while writing this plan:

| Field | Value |
|---|---|
| Questions | 132 (expected 132, Δ 0) |
| Pages carrying questions | 14 — pages 47 to 60 inclusive |
| MCQ / numerical | 113 / 19 |
| Questions with ≥1 figure | 52 |
| Distinct figure keys | 63 (all 63 PNGs present on disk) |
| Duplicate checksums inside the chapter | 0 |
| Orphan figures on pages 47–60 | 0 |
| Tiers | `must_do` 79, `concept_builder` 29, `advanced` 24 |
| Topics | 5 |
| Questions with null `exam_date` | 5 |

## Decisions this plan makes, and why

These are gaps or defects in `schema.sql` / `CURSOR_PLAN.md` that had to be resolved to make the plan executable. They are recorded here so no task has to re-litigate them.

| # | Decision | Reason |
|---|---|---|
| D1 | Tables get a `pyq_` prefix in `public`, not bare names | The Web `public` schema already holds 150+ tables including `mock_questions`, `play_questions`, `past_paper_questions`, `edubite_content_questions`. A bare `public.questions` / `public.chapters` / `public.topics` would collide conceptually with `curriculum_chapters` and `curriculum_topics`. Every existing family is prefixed (`curriculum_`, `mock_`, `edubite_`, `edudeca_`, `past_paper_`). The spec's column-level requirements map 1:1: `pyq_questions.body`, `pyq_chapters.catalog_slug`, `v_pyq_ingestion_check` |
| D2 | One `pyq_units` row, `JEE Main Physics (MathonGo PYQ)`, holding all 32 chapters | `chapters.unit_id` is `not null` but `skeleton.json` carries no unit data. Inventing an NCERT unit grouping is not in the spec, and nothing reads `pyq_units` |
| D3 | `pyq_topics.name` stores the **verbatim** PDF heading | Phase 1 flagged inconsistent capitalisation ("Newton's laws of motion" vs "Equilibrium of Forces") and left the decision open. The spec says topics capture "the PDF's own in-chapter topic heading", so verbatim is faithful; `unique (chapter_id, name)` still dedupes |
| D4 | `pyq_figure_links` gets a surrogate `id` plus a unique **expression index** | `schema.sql`'s `primary key (figure_id, question_id, coalesce(option_id, …))` is invalid SQL — Postgres `PRIMARY KEY` does not accept expressions. A unique index does |
| D5 | `review_status` becomes a real `CHECK` constraint, not a comment | `schema.sql` only documented the values in a trailing comment, which is why Phase 2's `skeleton_only` write was never caught at design time |
| D6 | RLS on all nine tables; `pyq_questions` read policy is `review_status in ('auto_ok','human_ok')` | Every other table in this project has RLS on. Enforcing the publishing gate in the database is stronger than enforcing it in app code, and the ingestion scripts use the service-role key, which bypasses RLS |
| D7 | `pyq_figures` rows exist only for figures actually uploaded — 63 in the pilot | `storage_path` is `not null`; a row for an un-uploaded figure would name an object that does not exist. Book-wide dedupe numbers are still computed and reported to `out/figure_dedupe.json` so `CURSOR_PLAN.md`'s figure gate stays observable |
| D8 | `format` is derived from `answer_type` only; models never set it | Invariant 1 restricts models to `body` and `options`. Consequence: the `match_list`, `assertion_reason`, `statement` enum values and `figure_role = 'match_list_item'` go unused in the pilot |
| D9 | `extraction_confidence` is defined as 1.0 (two passes agree), 0.5 (differ), 0.0 (pass 2 missing) | Sarvam returns no confidence score. An invented number would breach the "no unmeasured accuracy claims" constraint. "Low confidence" in Task 9 therefore means `< 1.0` |
| D10 | `solve_match` lives in `out/solve_verify.json`, not in a new column | The spec authorises exactly three schema changes. Task 9 reads the artifact |
| D11 | The Phase 9 review surface is a generated local HTML file plus a decisions JSON, not a Web app route | `CURSOR_PLAN.md` asks for a "minimal review UI", but app work belongs to the sibling plan. Same technique as `gold_sample.html` |

## Where the spec and `CURSOR_PLAN.md` disagree

| Point | `CURSOR_PLAN.md` | Spec | Resolution |
|---|---|---|---|
| Phase 2 scope | Whole book, figures included | 4,115 skeleton rows book-wide, figure upload narrowed to Laws of Motion | Spec wins — Task 2 |
| Figure gate | `count(*) from figures = 1,325` | Silent; lists only the `v_ingestion_check` delta | Restated as a dedupe-manifest assertion (1,335 distinct keys / 1,325 unique checksums / 10 duplicate groups) plus `count(*) = 63` for the pilot — Task 2 |
| Phase 3 gate | Book-wide: orphans < 15, undated < 40 | Chapter pages only | Chapter-scoped: orphans on pages 47–60 must be 0, undated chapter questions must reach 0 or be listed in `manual_review.json`. Book-wide counts stay at 88 / 228 and are explicitly out of scope — Task 3 |
| Bake-off size | 20 pages | ~6 pages, must include one figure-heavy and one math-dense Laws of Motion page | Spec wins — 6 named pages in Task 4 |
| Extraction page count | 454 pages | 14 pages | 14. The spec, `PROGRESS.md`'s chapter table and the skeleton itself all agree: chapter 5 spans pages 47–60 inclusive, and all 132 questions sit on those 14 pages. Page 46 and page 61 are chapter dividers carrying no `Q` anchor, so a "15 pages" reading that includes a divider has nothing to extract from it |
| Sarvam endpoint | `/v2/chat/completions` | Silent | Default to `/v1/chat/completions`, which is what `Web/lib/sarvamGyanClient.ts` uses in production against `sarvam-m`. Task 4 Step 1 probes the live model list and switches to `/v2` only if the probe confirms it |
| Phase 8 sample | 200 questions, stratified by chapter | ~30 of the 132, stratified by tier / figure / format | Spec wins — Task 8 |
| Gold-sample strata | Chapter, figure, MCQ-vs-numerical | Tier, figure, MCQ-vs-numerical | Spec wins; chapter is a constant in a single-chapter pilot |
| `auto_ok` promotion | Never defined | Never defined | Defined in Task 9 Step 1, otherwise nothing is ever publishable |

## Schema name map

`schema.sql` name → migration name. The sibling app plan reads these.

| `schema.sql` | Migration |
|---|---|
| `subjects` | `pyq_subjects` |
| `units` | `pyq_units` |
| `chapters` | `pyq_chapters` |
| `topics` | `pyq_topics` |
| `questions` | `pyq_questions` |
| `question_options` | `pyq_question_options` |
| `figures` | `pyq_figures` |
| `figure_links` | `pyq_figure_links` |
| `ingestion_runs` | `pyq_ingestion_runs` |
| `v_ingestion_check` | `v_pyq_ingestion_check` |
| `question_tier` / `question_format` / `exam_shift` / `figure_role` | `pyq_question_tier` / `pyq_question_format` / `pyq_exam_shift` / `pyq_figure_role` |

## File map

| File | Responsibility |
|------|----------------|
| `Web/supabase/migrations/20261019120000_pyq_question_bank.sql` | Question-bank schema, three spec corrections, RLS, `pyq` storage bucket |
| `files/pyq_common.py` | Env + Supabase client, skeleton loader, LaTeX normaliser, whitelist validator, Sarvam/Gemini callers, rate limiter |
| `files/seed_taxonomy.py` | Subject, unit, 32 chapters (`expected_question_count`, `catalog_slug`), 164 topics |
| `files/upload_figures.py` | SHA-256 dedupe manifest; upload Laws of Motion figures; insert `pyq_figures` |
| `files/load_questions.py` | Insert all 4,115 skeleton rows; `pyq_figure_links` for the pilot chapter |
| `files/resolve_boundaries.py` | Deterministic orphan and missing-date repair on pages 47–60 |
| `files/bakeoff.py` | Run candidates over 6 pages, score against the skeleton, write `bakeoff_results.md` |
| `files/extract_pass.py` | Constrained extraction, used for both pass 1 and pass 2 |
| `files/diff_passes.py` | Normalise, diff, write bodies and options to Postgres, set `extraction_confidence` |
| `files/solve_verify.py` | Reasoning-model answer check, writes `solve_match` |
| `files/gold_sample.py` | Stratified 30-question sample, `gold_sample.html`, `accuracy_report.md` |
| `files/review_queue.py` | Promotion rule, `review_queue.json`, `review_queue.html` |
| `files/apply_review.py` | Consume `review_decisions.json`, set `review_status = 'human_ok'` |
| `files/PROGRESS.md` | Append-only execution log — every task appends |

All Python scripts live in `c:\Users\tempo\Downloads\files\`, beside the existing `extract_assets.py` and `build_skeleton.py`.

## Credentials

One-time setup before Task 1. Copies three values from the Web app's env into a local file the scripts read; do not paste secrets into any document.

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$web = Get-Content "c:\Users\tempo\Downloads\EduBlast\Web\.env"
$url = ($web | Select-String "^NEXT_PUBLIC_SUPABASE_URL=").Line -replace "^NEXT_PUBLIC_SUPABASE_URL=", ""
$svc = ($web | Select-String "^SUPABASE_SERVICE_ROLE_KEY=").Line -replace "^SUPABASE_SERVICE_ROLE_KEY=", ""
$sar = ($web | Select-String "^SARVAM_API_KEY=").Line -replace "^SARVAM_API_KEY=", ""
$gem = ($web | Select-String "^GEMINI_API_KEY=").Line -replace "^GEMINI_API_KEY=", ""
Set-Content .env @(
  "SUPABASE_URL=$url",
  "SUPABASE_SERVICE_KEY=$svc",
  "SARVAM_API_KEY=$sar",
  "GEMINI_API_KEY=$gem"
)
```

Expected: `.env` has four non-empty values. The Supabase project is `bytsiknhtcnlxwzgqkrd` (`NEXT_PUBLIC_SUPABASE_URL=https://bytsiknhtcnlxwzgqkrd.supabase.co`). Verified while writing this plan: `pgcrypto` 1.3 and `vector` 0.8.0 are already installed, no `pyq` bucket exists, and none of the nine tables exist yet — so the migration creates the schema rather than altering it.

## Cost

Rates derived from `CURSOR_PLAN.md`'s own budget: ₹127 for 454 pages is ₹0.28 per page; ₹500 for 4,115 questions is ₹0.12 per question. These are estimates. Actual spend goes into `pyq_ingestion_runs.cost_usd` and `PROGRESS.md`.

| Task | Phase | Estimated cost |
|---|---|---|
| 1 | Schema + taxonomy | ₹0 |
| 2 | Storage | **₹0** |
| 3 | Orphans and dates | **₹0** |
| 4 | Bake-off — 6 pages × 3 candidates = 18 page-calls | ~₹5 |
| 5 | Extraction — 14 pages | ~₹4 |
| 6 | Second observer — 14 pages | ~₹4 |
| 7 | Solve-verify — 132 questions | ~₹16 |
| 8 | Gold sample — human review, no model calls | ₹0 |
| 9 | Review queue | ₹0 |
| | **Total** | **~₹29**, inside the spec's ₹25–30 |

---

### Task 1: Schema migration and taxonomy

**Files:**
- Create: `Web/supabase/migrations/20261019120000_pyq_question_bank.sql`
- Create: `files/pyq_common.py`
- Create: `files/seed_taxonomy.py`
- Modify: `files/PROGRESS.md` (append)

**Interfaces:**
- Consumes: `out/skeleton.json`, `out/answer_key.json`, `.env`
- Produces:
  - Tables per the schema name map, in `public`, on project `bytsiknhtcnlxwzgqkrd`
  - `pyq_common.load_skeleton() -> list[dict]`
  - `pyq_common.supabase_client() -> supabase.Client` (service role)
  - `pyq_common.CHAPTER_5 = 5`, `pyq_common.CHAPTER_5_PAGES = range(47, 61)`
  - `pyq_common.CATALOG_SLUG: dict[int, str | None]` — 32 entries, PDF chapter number → app chapter slug
  - Rows: 1 `pyq_subjects`, 1 `pyq_units`, 32 `pyq_chapters`, 164 `pyq_topics`

**Migration timestamp:** the newest existing migration is `20261018140000_teacher_welcome_rdm_just_stamped_rows.sql`. Migrations apply in filename order, so this one must sort after it — hence `20261019120000`, not a September stamp.

- [ ] **Step 1: Write the migration**

Create `Web/supabase/migrations/20261019120000_pyq_question_bank.sql`:

```sql
-- JEE Main Physics PYQ question bank (MathonGo book).
-- Shape follows c:\Users\tempo\Downloads\files\schema.sql with the three
-- corrections required by docs/superpowers/specs/2026-09-11-chapter-pyq-physics-import-design.md:
--   1. questions.body is nullable    (Phase 2 inserts skeleton rows with body = null)
--   2. 'skeleton_only' is an allowed review_status
--   3. chapters.catalog_slug, deliberately NOT unique (several PDF chapters merge into one app chapter)
-- Tables are prefixed pyq_ because public already holds mock_questions,
-- play_questions, past_paper_questions, curriculum_chapters and curriculum_topics.

create extension if not exists "pgcrypto";
create extension if not exists vector;

do $$ begin
  create type pyq_question_tier as enum ('concept_builder', 'must_do', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pyq_question_format as enum ('mcq', 'numerical', 'match_list', 'assertion_reason', 'statement');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pyq_exam_shift as enum ('morning', 'evening');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pyq_figure_role as enum ('question_body', 'option', 'match_list_item');
exception when duplicate_object then null; end $$;

-- ---------- taxonomy ----------

create table if not exists pyq_subjects (
  id    smallserial primary key,
  name  text not null unique
);

create table if not exists pyq_units (
  id          smallserial primary key,
  subject_id  smallint not null references pyq_subjects(id),
  name        text not null,
  sort_order  smallint not null,
  unique (subject_id, name)
);

create table if not exists pyq_chapters (
  id          smallserial primary key,
  unit_id     smallint not null references pyq_units(id),
  chapter_no  smallint not null,
  name        text not null,
  expected_question_count smallint,
  -- CHANGE 3: app chapter page this row renders under. NOT unique: PDF chapters
  -- 7 and 8 both map to system-of-particles-and-rotational-motion, and 1, 2, 32
  -- all map to units-and-measurements. Null means "not routed yet" (chapter 17).
  catalog_slug text,
  unique (chapter_no)
);

create index if not exists pyq_chapters_catalog_slug_idx on pyq_chapters (catalog_slug);

create table if not exists pyq_topics (
  id          serial primary key,
  chapter_id  smallint not null references pyq_chapters(id),
  name        text not null,
  sort_order  smallint,
  unique (chapter_id, name)
);

-- ---------- questions ----------

create table if not exists pyq_questions (
  id              uuid primary key default gen_random_uuid(),
  chapter_id      smallint not null references pyq_chapters(id),
  topic_id        int references pyq_topics(id),

  q_no            smallint not null,
  tier            pyq_question_tier not null,
  format          pyq_question_format not null,

  -- CHANGE 1: nullable. Markdown with inline LaTeX; figures as [[fig:p047_x549]].
  body            text,

  correct_option  smallint check (correct_option between 1 and 4),
  numerical_answer text,

  exam_date       date,
  exam_shift      pyq_exam_shift,
  exam_year       smallint generated always as (extract(year from exam_date)::smallint) stored,

  out_of_syllabus boolean not null default false,
  good_to_solve   boolean not null default false,

  source_page     smallint not null,
  source_bbox     jsonb,

  extraction_confidence real,
  -- CHANGE 2: 'skeleton_only' is allowed, and the list is enforced rather than
  -- merely documented in a comment.
  review_status   text not null default 'unreviewed',

  embedding       vector(768),
  created_at      timestamptz not null default now(),

  unique (chapter_id, q_no),
  constraint pyq_questions_review_status_check check (
    review_status in ('unreviewed', 'skeleton_only', 'auto_ok', 'flagged', 'human_ok')
  )
);

create index if not exists pyq_questions_chapter_tier_idx on pyq_questions (chapter_id, tier);
create index if not exists pyq_questions_year_shift_idx   on pyq_questions (exam_year, exam_shift);
create index if not exists pyq_questions_topic_idx        on pyq_questions (topic_id);
create index if not exists pyq_questions_unreviewed_idx   on pyq_questions (review_status)
  where review_status <> 'human_ok';

-- ---------- options ----------
-- Separate table because an option can itself be an image.

create table if not exists pyq_question_options (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references pyq_questions(id) on delete cascade,
  option_index  smallint not null check (option_index between 1 and 4),
  body          text,
  unique (question_id, option_index)
);

-- ---------- figures ----------

create table if not exists pyq_figures (
  id            uuid primary key default gen_random_uuid(),
  figure_key    text not null unique,
  storage_path  text not null,
  public_url    text,
  px_width      int,
  px_height     int,
  bytes         int,
  checksum      text,
  source_page   smallint not null,
  source_bbox   jsonb not null,
  alt_text      text
);

create index if not exists pyq_figures_checksum_idx on pyq_figures (checksum);

create table if not exists pyq_figure_links (
  id            uuid primary key default gen_random_uuid(),
  figure_id     uuid not null references pyq_figures(id) on delete cascade,
  question_id   uuid not null references pyq_questions(id) on delete cascade,
  option_id     uuid references pyq_question_options(id) on delete cascade,
  role          pyq_figure_role not null,
  sort_order    smallint default 0
);

-- schema.sql declared this as a composite PRIMARY KEY over a coalesce()
-- expression, which Postgres rejects. A unique index accepts expressions.
create unique index if not exists pyq_figure_links_uniq
  on pyq_figure_links (
    figure_id,
    question_id,
    coalesce(option_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- ---------- ingestion audit ----------

create table if not exists pyq_ingestion_runs (
  id              uuid primary key default gen_random_uuid(),
  source_file     text not null,
  model_used      text,
  pages_processed int,
  questions_written int,
  figures_written int,
  cost_usd        numeric(10,4),
  started_at      timestamptz default now(),
  finished_at     timestamptz,
  notes           jsonb
);

-- ---------- validation view ----------

create or replace view v_pyq_ingestion_check as
select
  c.chapter_no,
  c.name,
  c.catalog_slug,
  c.expected_question_count as expected,
  count(q.id)               as actual,
  count(q.id) filter (where q.correct_option is null
                        and q.numerical_answer is null) as missing_answer,
  count(q.id) filter (where q.review_status = 'flagged')      as flagged,
  count(q.id) filter (where q.review_status = 'skeleton_only') as skeleton_only,
  count(q.id) filter (where q.review_status in ('auto_ok', 'human_ok')) as publishable,
  c.expected_question_count - count(q.id) as delta
from pyq_chapters c
left join pyq_questions q on q.chapter_id = c.id
group by c.id, c.chapter_no, c.name, c.catalog_slug, c.expected_question_count
order by c.chapter_no;

-- ---------- RLS ----------
-- Every table in this project has RLS on. Ingestion uses the service-role key,
-- which bypasses RLS, so no write policies are needed. The publishing gate is
-- enforced here rather than only in app code.

alter table pyq_subjects         enable row level security;
alter table pyq_units            enable row level security;
alter table pyq_chapters         enable row level security;
alter table pyq_topics           enable row level security;
alter table pyq_questions        enable row level security;
alter table pyq_question_options enable row level security;
alter table pyq_figures          enable row level security;
alter table pyq_figure_links     enable row level security;
alter table pyq_ingestion_runs   enable row level security;

drop policy if exists pyq_subjects_read on pyq_subjects;
create policy pyq_subjects_read on pyq_subjects
  for select to authenticated using (true);

drop policy if exists pyq_units_read on pyq_units;
create policy pyq_units_read on pyq_units
  for select to authenticated using (true);

drop policy if exists pyq_chapters_read on pyq_chapters;
create policy pyq_chapters_read on pyq_chapters
  for select to authenticated using (true);

drop policy if exists pyq_topics_read on pyq_topics;
create policy pyq_topics_read on pyq_topics
  for select to authenticated using (true);

drop policy if exists pyq_figures_read on pyq_figures;
create policy pyq_figures_read on pyq_figures
  for select to authenticated using (true);

-- Only published questions are visible, and only their options and figure links.
drop policy if exists pyq_questions_read_published on pyq_questions;
create policy pyq_questions_read_published on pyq_questions
  for select to authenticated
  using (review_status in ('auto_ok', 'human_ok'));

drop policy if exists pyq_question_options_read_published on pyq_question_options;
create policy pyq_question_options_read_published on pyq_question_options
  for select to authenticated
  using (exists (
    select 1 from pyq_questions q
    where q.id = pyq_question_options.question_id
      and q.review_status in ('auto_ok', 'human_ok')
  ));

drop policy if exists pyq_figure_links_read_published on pyq_figure_links;
create policy pyq_figure_links_read_published on pyq_figure_links
  for select to authenticated
  using (exists (
    select 1 from pyq_questions q
    where q.id = pyq_figure_links.question_id
      and q.review_status in ('auto_ok', 'human_ok')
  ));

-- pyq_ingestion_runs has RLS on and no policies: service role only.

-- ---------- storage ----------
-- Bucket 'pyq'; objects at physics/figures/<figure_key>.png.
-- Public read, matching the existing past-paper-images bucket. Writes are
-- service-role only, since no storage.objects policy is granted here.

insert into storage.buckets (id, name, public)
values ('pyq', 'pyq', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: Apply the migration**

Apply with the Supabase MCP `apply_migration` tool against project `bytsiknhtcnlxwzgqkrd`, name `pyq_question_bank`, passing the file's contents as the query.

If MCP is unavailable, from `c:\Users\tempo\Downloads\EduBlast\Web`:

```powershell
npx supabase link --project-ref bytsiknhtcnlxwzgqkrd
npx supabase db push
```

- [ ] **Step 3: Verify the schema landed**

Run this SQL (MCP `execute_sql`, project `bytsiknhtcnlxwzgqkrd`):

```sql
select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name like 'pyq_%')          as tables,
  (select is_nullable from information_schema.columns
     where table_name = 'pyq_questions' and column_name = 'body')        as body_nullable,
  (select count(*) from information_schema.columns
     where table_name = 'pyq_chapters' and column_name = 'catalog_slug') as has_catalog_slug,
  (select count(*) from pg_indexes
     where indexname = 'pyq_chapters_catalog_slug_idx')                  as slug_index,
  (select count(*) from pg_constraint
     where conname = 'pyq_questions_review_status_check')                as status_check,
  (select count(*) from storage.buckets where id = 'pyq')                as bucket;
```

Expected: `tables = 9`, `body_nullable = YES`, `has_catalog_slug = 1`, `slug_index = 1`, `status_check = 1`, `bucket = 1`.

Then prove `catalog_slug` is *not* unique and `skeleton_only` is accepted:

```sql
select count(*) from pg_constraint
where conrelid = 'pyq_chapters'::regclass and contype = 'u';
```

Expected: `1` — the `unique (chapter_no)` constraint only.

- [ ] **Step 4: Write `pyq_common.py`**

Create `files/pyq_common.py`. This is imported by every later script; keep it dependency-light.

```python
#!/usr/bin/env python3
"""Shared helpers for the PYQ ingestion pipeline (Phases 2-9)."""
import hashlib
import json
import os
import re
import threading
import time
from pathlib import Path

import httpx
from supabase import create_client

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
PDF_PATH = r"C:\Users\tempo\Downloads\MathonGo PYQ Book (JEE Main 2025 - 2019) - Physics.pdf"

CHAPTER_5 = 5
CHAPTER_5_PAGES = range(47, 61)          # 14 pages that carry Laws of Motion questions
BUCKET = "pyq"
FIGURE_PREFIX = "physics/figures"

SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"
GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# PDF chapter number -> app catalog chapter slug (slugify() of the catalog name).
# Chapter 17 (Electrostatics) straddles two catalog chapters and is deferred.
CATALOG_SLUG = {
    1: "units-and-measurements",
    2: "units-and-measurements",
    3: "motion-in-a-straight-line",
    4: "motion-in-a-plane",
    5: "laws-of-motion",
    6: "work-energy-and-power",
    7: "system-of-particles-and-rotational-motion",
    8: "system-of-particles-and-rotational-motion",
    9: "gravitation",
    10: "mechanical-properties-of-solids",
    11: "mechanical-properties-of-fluids",
    12: "oscillations",
    13: "waves",
    14: "thermal-properties-of-matter",
    15: "thermodynamics",
    16: "kinetic-theory-of-gases",
    17: None,
    18: "electrostatic-potential-and-capacitance",
    19: "current-electricity",
    20: "magnetism-and-matter",
    21: "moving-charges-and-magnetism",
    22: "electromagnetic-induction",
    23: "alternating-current",
    24: "ray-optics",
    25: "wave-optics",
    26: "dual-nature-of-radiation-and-matter",
    27: "atoms",
    28: "nuclei",
    29: "electromagnetic-waves",
    30: "semiconductor-electronics",
    31: "communication-system",
    32: "units-and-measurements",
}


def load_env() -> dict:
    env = {}
    path = ROOT / ".env"
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    os.environ.update(env)
    return env


def supabase_client():
    env = load_env()
    url = env.get("SUPABASE_URL") or env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env.get("SUPABASE_SERVICE_KEY") or env["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def load_skeleton() -> list:
    return json.loads((OUT / "skeleton.json").read_text(encoding="utf-8"))


def load_figures_manifest() -> list:
    return json.loads((OUT / "figures.json").read_text(encoding="utf-8"))


def load_answer_key() -> dict:
    return json.loads((OUT / "answer_key.json").read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


_NORM = [
    (re.compile(r"\\dfrac"), r"\\frac"),
    (re.compile(r"\\tfrac"), r"\\frac"),
    (re.compile(r"\\left\("), "("),
    (re.compile(r"\\right\)"), ")"),
    (re.compile(r"\\left\["), "["),
    (re.compile(r"\\right\]"), "]"),
    (re.compile(r"\\,|\\;|\\!|\\quad|\\qquad"), " "),
    (re.compile(r"\u2212"), "-"),
    (re.compile(r"\s+"), " "),
]


def normalise_latex(text) -> str:
    """Collapse cosmetic LaTeX differences so a diff only shows real ones."""
    if text is None:
        return ""
    s = str(text)
    for pattern, repl in _NORM:
        s = pattern.sub(repl, s)
    return s.strip()


class RateLimiter:
    """Sarvam Starter allows 60 requests per minute."""

    def __init__(self, per_minute: int = 60):
        self.interval = 60.0 / per_minute
        self.lock = threading.Lock()
        self.next_at = 0.0

    def wait(self):
        with self.lock:
            now = time.monotonic()
            if now < self.next_at:
                time.sleep(self.next_at - now)
                now = time.monotonic()
            self.next_at = now + self.interval


class WhitelistError(Exception):
    """Invariant 2: the model returned a q_no or figure_key we did not supply."""


def validate_page_response(payload: dict, allowed_q_nos: set, allowed_fig_keys: set) -> list:
    """Reject unknown q_no or figure_key. Return the validated question list."""
    questions = payload.get("questions")
    if not isinstance(questions, list):
        raise WhitelistError("response has no 'questions' list")

    got = set()
    for q in questions:
        q_no = q.get("q_no")
        if q_no not in allowed_q_nos:
            raise WhitelistError(f"unknown q_no {q_no!r}")
        got.add(q_no)
        blob = json.dumps(q, ensure_ascii=False)
        for key in re.findall(r"\[\[fig:([^\]]+)\]\]", blob):
            if key not in allowed_fig_keys:
                raise WhitelistError(f"unknown figure_key {key!r} on q_no {q_no}")

    if got != allowed_q_nos:
        missing = sorted(allowed_q_nos - got)
        extra = sorted(got - allowed_q_nos)
        raise WhitelistError(f"q_no set mismatch; missing={missing} extra={extra}")
    return questions


def call_sarvam(model: str, messages: list, api_key: str, limiter: RateLimiter,
                timeout: float = 180.0) -> dict:
    limiter.wait()
    r = httpx.post(
        SARVAM_CHAT_URL,
        headers={"api-subscription-key": api_key, "Content-Type": "application/json"},
        json={"model": model, "messages": messages, "temperature": 0,
              "response_format": {"type": "json_object"}},
        timeout=timeout,
    )
    r.raise_for_status()
    return r.json()


def call_gemini(model: str, parts: list, api_key: str, timeout: float = 180.0) -> dict:
    r = httpx.post(
        f"{GEMINI_CHAT_URL}/{model}:generateContent?key={api_key}",
        json={"contents": [{"parts": parts}],
              "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}},
        timeout=timeout,
    )
    r.raise_for_status()
    return r.json()
```

- [ ] **Step 5: Verify `pyq_common.py` connects**

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe -c "import pyq_common as p; c=p.supabase_client(); print(len(p.load_skeleton())); print(len(p.CATALOG_SLUG)); print(c.table('pyq_chapters').select('chapter_no').execute().data)"
```

Expected: `4115`, then `32`, then `[]`.

- [ ] **Step 6: Write `seed_taxonomy.py`**

Create `files/seed_taxonomy.py`. Idempotent: safe to re-run.

```python
#!/usr/bin/env python3
"""Phase 2a - seed subject, unit, 32 chapters and their topics. No cost."""
import pyq_common as p


def main():
    sb = p.supabase_client()
    skeleton = p.load_skeleton()
    key = p.load_answer_key()

    subject = sb.table("pyq_subjects").upsert(
        {"name": "Physics"}, on_conflict="name").execute().data[0]

    unit = sb.table("pyq_units").upsert(
        {"subject_id": subject["id"],
         "name": "JEE Main Physics (MathonGo PYQ)",
         "sort_order": 1},
        on_conflict="subject_id,name").execute().data[0]

    # chapters: expected_question_count from the book's own answer key
    chapter_rows = []
    for chapter_no_str, entry in key.items():
        chapter_no = int(chapter_no_str)
        chapter_rows.append({
            "unit_id": unit["id"],
            "chapter_no": chapter_no,
            "name": entry["title"],
            "expected_question_count": len(entry["answers"]),
            "catalog_slug": p.CATALOG_SLUG[chapter_no],
        })
    chapter_rows.sort(key=lambda r: r["chapter_no"])
    sb.table("pyq_chapters").upsert(chapter_rows, on_conflict="chapter_no").execute()

    chapters = {c["chapter_no"]: c["id"] for c in
                sb.table("pyq_chapters").select("id,chapter_no").execute().data}

    # topics: verbatim PDF headings, sort_order by first appearance in the skeleton
    seen = {}
    for rec in skeleton:
        pair = (rec["chapter_no"], rec["topic"])
        if rec["topic"] and pair not in seen:
            seen[pair] = len(seen)
    topic_rows = []
    per_chapter = {}
    for (chapter_no, name) in seen:
        order = per_chapter.get(chapter_no, 0)
        per_chapter[chapter_no] = order + 1
        topic_rows.append({"chapter_id": chapters[chapter_no], "name": name,
                           "sort_order": order})
    sb.table("pyq_topics").upsert(topic_rows, on_conflict="chapter_id,name").execute()

    print(f"subjects : 1")
    print(f"units    : 1")
    print(f"chapters : {len(chapter_rows)}")
    print(f"topics   : {len(topic_rows)}")
    print(f"expected total : {sum(r['expected_question_count'] for r in chapter_rows)}")
    print(f"null catalog_slug : "
          f"{[r['chapter_no'] for r in chapter_rows if r['catalog_slug'] is None]}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 7: Run the seed**

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe seed_taxonomy.py
```

Expected stdout:

```
subjects : 1
units    : 1
chapters : 32
topics   : 164
expected total : 4115
null catalog_slug : [17]
```

- [ ] **Step 8: Acceptance gate**

Run:

```sql
select count(*) as chapters,
       sum(expected_question_count) as expected_total,
       count(*) filter (where catalog_slug is not null) as routed,
       count(distinct catalog_slug) as distinct_slugs
from pyq_chapters;

select catalog_slug, count(*) as pdf_chapters
from pyq_chapters where catalog_slug is not null
group by catalog_slug having count(*) > 1 order by catalog_slug;

select expected_question_count, catalog_slug from pyq_chapters where chapter_no = 5;
```

Expected: 32 chapters, `expected_total = 4115`, `routed = 31`, `distinct_slugs = 28`. The merge query returns exactly two rows — `system-of-particles-and-rotational-motion` with 2 and `units-and-measurements` with 3. Chapter 5 shows `132` / `laws-of-motion`.

Re-run `seed_taxonomy.py` once more; row counts must not change. That proves idempotence.

Gate fails if any count differs. Stop and report — do not proceed to Task 2.

- [ ] **Step 9: Append to `PROGRESS.md`**

Append a `## Phase 2a — Schema and taxonomy · PASS|FAIL` section with: migration filename, the Step 3 and Step 8 query output, the 32-row `catalog_slug` mapping as applied, the topics count, `Cost: ₹0`, and anything that surprised you. `CURSOR_PLAN.md` § Reporting requires this.

- [ ] **Step 10: Commit (only if the user asked)**

```powershell
git add Web/supabase/migrations/20261019120000_pyq_question_bank.sql
git commit -m "Add JEE PYQ question-bank schema with nullable body, skeleton_only status and chapter catalog_slug."
```

---

### Task 2: Phase 2 — figures and skeleton rows

**Files:**
- Create: `files/upload_figures.py`
- Create: `files/load_questions.py`
- Modify: `files/PROGRESS.md` (append)

**Interfaces:**
- Consumes: `pyq_common` helpers from Task 1, `pyq_chapters` / `pyq_topics` rows from Task 1
- Produces:
  - `out/figure_dedupe.json` — `{"groups": [[key, …], …], "distinct_keys": int, "unique_checksums": int, "manifest_rows": int}`
  - 63 objects at `pyq/physics/figures/<figure_key>.png`
  - 63 `pyq_figures` rows, 63 `pyq_figure_links` rows (role `question_body`)
  - 4,115 `pyq_questions` rows, `body = null`, `review_status = 'skeleton_only'`

**Cost: ₹0.** Deterministic file work plus Postgres and Storage writes. No models, no API keys beyond Supabase.

**The two dedupe domains, stated precisely.** Deduping the 1,335 **files** on disk gives **ten** duplicate groups and **1,325 unique checksums** — exactly the page-spanning pairs `CURSOR_PLAN.md` predicts. Walking the **1,336 manifest rows** in `figures.json` gives an **eleventh** group, because `p420_x3821` appears twice: page 420 places one image object at two bounding boxes and `figure_key` is `p{page:03d}_x{xref}`, so both rows resolve to one key and one file. The loop must **tolerate that repeat rather than error**. Page 420 is in Semiconductors, so the pilot chapter is unaffected. Do not "fix" the key scheme — the skeleton is immutable.

The ten file-level groups, measured:

```
p032_x4765 p033_x4765
p146_x6103 p147_x6103
p152_x6104 p153_x6104
p182_x6536 p183_x6536
p198_x6686 p199_x6686
p228_x6886 p229_x6886
p236_x7014 p237_x7014
p244_x7015 p245_x7015
p244_x7016 p245_x7016
p375_x8220 p376_x8220
```

None of them touch pages 47–60, and the 63 Laws of Motion figures have 63 distinct checksums, so the pilot upload is one object per key.

- [ ] **Step 1: Write `upload_figures.py`**

Create `files/upload_figures.py`:

```python
#!/usr/bin/env python3
"""Phase 2 - SHA-256 dedupe, upload Laws of Motion figures, insert pyq_figures.

Idempotent: re-running overwrites the same object names and upserts the same
figure_key rows. It never duplicates.
"""
import collections
import json
import mimetypes

import pyq_common as p


def build_dedupe(manifest):
    """Group distinct figure_keys by file checksum. Tolerates repeated keys."""
    by_key = {}
    repeats = collections.Counter()
    for row in manifest:
        key = row["figure_key"]
        repeats[key] += 1
        by_key.setdefault(key, row)      # first placement wins; do not raise

    by_checksum = collections.defaultdict(list)
    missing = []
    for key in sorted(by_key):
        path = p.OUT / "figures" / f"{key}.png"
        if not path.exists():
            missing.append(key)
            continue
        by_checksum[p.sha256_file(path)].append(key)

    return by_key, by_checksum, missing, [k for k, n in repeats.items() if n > 1]


def main():
    sb = p.supabase_client()
    manifest = p.load_figures_manifest()
    skeleton = p.load_skeleton()

    by_key, by_checksum, missing, repeated = build_dedupe(manifest)
    groups = [keys for keys in by_checksum.values() if len(keys) > 1]

    (p.OUT / "figure_dedupe.json").write_text(json.dumps({
        "manifest_rows": len(manifest),
        "distinct_keys": len(by_key),
        "unique_checksums": len(by_checksum),
        "duplicate_groups": sorted(groups),
        "repeated_manifest_keys": sorted(repeated),
        "missing_files": sorted(missing),
        # canonical = lexicographically first key of the checksum group
        "canonical": {k: sorted(keys)[0] for keys in by_checksum.values() for k in keys},
    }, indent=2), encoding="utf-8")

    print(f"manifest rows     : {len(manifest)}")
    print(f"distinct keys     : {len(by_key)}")
    print(f"unique checksums  : {len(by_checksum)}")
    print(f"duplicate groups  : {len(groups)}")
    print(f"repeated keys     : {repeated}")
    print(f"missing files     : {len(missing)}")

    # --- pilot chapter only ---
    wanted = sorted({k for r in skeleton if r["chapter_no"] == p.CHAPTER_5
                     for k in r["figure_keys"]})
    canonical = {k: sorted(keys)[0] for keys in by_checksum.values() for k in keys}

    uploaded, rows = set(), []
    for key in wanted:
        canon = canonical[key]
        object_name = f"{p.FIGURE_PREFIX}/{canon}.png"
        local = p.OUT / "figures" / f"{canon}.png"
        if canon not in uploaded:
            sb.storage.from_(p.BUCKET).upload(
                object_name,
                local.read_bytes(),
                {"content-type": mimetypes.guess_type(local.name)[0] or "image/png",
                 "upsert": "true"},
            )
            uploaded.add(canon)
        meta = by_key[key]
        rows.append({
            "figure_key": key,
            "storage_path": f"{p.BUCKET}/{object_name}",
            "public_url": sb.storage.from_(p.BUCKET).get_public_url(object_name),
            "px_width": meta["px_width"],
            "px_height": meta["px_height"],
            "bytes": meta["bytes"],
            "checksum": p.sha256_file(local),
            "source_page": meta["page"],
            "source_bbox": meta["bbox"],
        })

    sb.table("pyq_figures").upsert(rows, on_conflict="figure_key").execute()
    print(f"chapter 5 keys    : {len(wanted)}")
    print(f"objects uploaded  : {len(uploaded)}")
    print(f"pyq_figures rows  : {len(rows)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the figure upload**

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe upload_figures.py
```

Expected stdout:

```
manifest rows     : 1336
distinct keys     : 1335
unique checksums  : 1325
duplicate groups  : 10
repeated keys     : ['p420_x3821']
missing files     : 0
chapter 5 keys    : 63
objects uploaded  : 63
pyq_figures rows  : 63
```

- [ ] **Step 3: Prove the upload is idempotent**

Re-run the exact same command. Stdout must be byte-identical, and:

```sql
select count(*) as figures, count(distinct storage_path) as paths from pyq_figures;
```

Expected: `figures = 63`, `paths = 63`. If `figures` is 126, the upsert `on_conflict` is wrong — fix before proceeding.

- [ ] **Step 4: Write `load_questions.py`**

Create `files/load_questions.py`:

```python
#!/usr/bin/env python3
"""Phase 2 - insert all 4,115 skeleton rows (body = null, skeleton_only)
plus figure links for the pilot chapter. Idempotent on (chapter_id, q_no)."""
import pyq_common as p

BATCH = 500


def main():
    sb = p.supabase_client()
    skeleton = p.load_skeleton()

    chapters = {c["chapter_no"]: c["id"] for c in
                sb.table("pyq_chapters").select("id,chapter_no").execute().data}
    topics = {(t["chapter_id"], t["name"]): t["id"] for t in
              sb.table("pyq_topics").select("id,chapter_id,name").execute().data}

    rows = []
    for rec in skeleton:
        chapter_id = chapters[rec["chapter_no"]]
        mcq = rec["answer_type"] == "mcq"
        rows.append({
            "chapter_id": chapter_id,
            "topic_id": topics.get((chapter_id, rec["topic"])),
            "q_no": rec["q_no"],
            "tier": rec["tier"],
            # D8: format is derived from the answer key only. Models never set it.
            "format": "mcq" if mcq else "numerical",
            "body": None,
            "correct_option": int(rec["answer_value"]) if mcq else None,
            "numerical_answer": None if mcq else rec["answer_value"],
            "exam_date": rec["exam_date"],
            "exam_shift": rec["exam_shift"],
            "out_of_syllabus": rec["out_of_syllabus"],
            "good_to_solve": rec["good_to_solve"],
            "source_page": rec["page"],
            "source_bbox": rec["bbox"],
            "review_status": "skeleton_only",
        })

    for i in range(0, len(rows), BATCH):
        sb.table("pyq_questions").upsert(
            rows[i:i + BATCH], on_conflict="chapter_id,q_no").execute()
    print(f"questions upserted : {len(rows)}")

    # figure links for the pilot chapter
    ch5_id = chapters[p.CHAPTER_5]
    q_ids = {q["q_no"]: q["id"] for q in sb.table("pyq_questions")
             .select("id,q_no").eq("chapter_id", ch5_id).execute().data}
    fig_ids = {f["figure_key"]: f["id"] for f in
               sb.table("pyq_figures").select("id,figure_key").execute().data}

    links = []
    for rec in skeleton:
        if rec["chapter_no"] != p.CHAPTER_5:
            continue
        for order, key in enumerate(rec["figure_keys"]):
            links.append({"figure_id": fig_ids[key],
                          "question_id": q_ids[rec["q_no"]],
                          "option_id": None,
                          "role": "question_body",
                          "sort_order": order})

    existing = {(l["figure_id"], l["question_id"]) for l in sb.table("pyq_figure_links")
                .select("figure_id,question_id").execute().data}
    fresh = [l for l in links
             if (l["figure_id"], l["question_id"]) not in existing]
    if fresh:
        sb.table("pyq_figure_links").insert(fresh).execute()
    print(f"figure links total : {len(links)}  inserted now: {len(fresh)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run the skeleton load**

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe load_questions.py
```

Expected stdout:

```
questions upserted : 4115
figure links total : 63  inserted now: 63
```

Re-run it. Expected on the second run: `questions upserted : 4115`, `figure links total : 63  inserted now: 0`.

- [ ] **Step 6: Acceptance gate — `v_pyq_ingestion_check` delta is 0**

`CURSOR_PLAN.md`'s Phase 2 gate, chapter-scoped per the spec and then widened to all 32:

```sql
select count(*) as chapters_with_delta
from v_pyq_ingestion_check where delta <> 0;

select chapter_no, name, expected, actual, delta, skeleton_only, missing_answer
from v_pyq_ingestion_check where chapter_no = 5;

select count(*) as figures, count(distinct checksum) as checksums from pyq_figures;
select count(*) as links from pyq_figure_links;
select count(*) as body_not_null from pyq_questions where body is not null;
```

Expected: `chapters_with_delta = 0`; chapter 5 shows `expected 132, actual 132, delta 0, skeleton_only 132, missing_answer 0`; `figures = 63`, `checksums = 63`; `links = 63`; `body_not_null = 0`.

The dedupe half of `CURSOR_PLAN.md`'s gate is asserted against `out/figure_dedupe.json` instead of `count(*) from figures`, because only the pilot chapter uploads: `distinct_keys = 1335`, `unique_checksums = 1325`, `duplicate_groups` has 10 entries, `repeated_manifest_keys = ["p420_x3821"]`.

Any mismatch: stop and report. Do not proceed to Task 3.

- [ ] **Step 7: Verify a figure is actually fetchable**

```powershell
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe -c "import httpx, pyq_common as p; sb=p.supabase_client(); row=sb.table('pyq_figures').select('figure_key,public_url,bytes').eq('figure_key','p047_x549').execute().data[0]; r=httpx.get(row['public_url']); print(row['figure_key'], r.status_code, len(r.content), row['bytes'])"
```

Expected: `p047_x549 200` followed by a byte count above zero. `p047_x549` is the figure on Laws of Motion Q1, page 47.

- [ ] **Step 8: Append to `PROGRESS.md`**

Append `## Phase 2 — Storage · PASS|FAIL` with: both scripts' stdout, the gate query output, the eleven-vs-ten dedupe reconciliation, the idempotence re-run result, `Cost: ₹0`, and any surprise.

- [ ] **Step 9: Commit (only if the user asked)** — `upload_figures.py` and `load_questions.py` live outside the repo, so there is nothing to commit for this task unless the user asks for the scripts to be vendored into `Web/`.

---

### Task 3: Phase 3 — orphan figures and missing dates

**Files:**
- Create: `files/resolve_boundaries.py`
- Modify: `files/PROGRESS.md` (append)

**Interfaces:**
- Consumes: `pyq_common` helpers; `out/orphan_figures.json`; the PDF at `pyq_common.PDF_PATH`
- Produces:
  - `out/boundary_fixes.json` — `{"dates": [{"q_no": int, "page": int, "column": "L"|"R", "exam_date": "YYYY-MM-DD", "exam_shift": str, "found_on_page": int, "rule": str}], "orphans": [...]}`
  - `out/manual_review.json` — anything unresolved, with page numbers
  - Updated `exam_date` / `exam_shift` on the affected `pyq_questions` rows

**Cost: ₹0.** Deterministic geometry and text-layer work. **No AI** — Invariant 3 and `CURSOR_PLAN.md` Phase 3 both forbid a model here.

**Scope: chapter pages only**, per the spec. Book-wide there are 88 orphan figures and 228 undated questions; those stay untouched and out of scope. On pages 47–60 there are **0 orphan figures** (measured) and **5 undated questions**:

| q_no | page | column |
|---|---|---|
| 30 | 50 | L |
| 52 | 52 | L |
| 53 | 52 | L |
| 70 | 54 | L |
| 79 | 54 | R |

The two rules, from `CURSOR_PLAN.md`:

1. **Orphan figure.** An orphan sitting at the top of a column (`y < 60`) belongs to the last question of that same column on the **previous** page.
2. **Missing date.** The date tag is on the continuation page — search the top of the **next** page's matching column.

Rule 2 gets one documented extension. In a two-column layout, reading order runs the whole left column then the whole right column, so a question at the bottom of the left column continues into the **right column of the same page**, not onto the next page. Four of the five undated questions are in column L. The script therefore probes in this order, stopping at the first hit, and records which probe fired:

- `next_page_same_column` — `CURSOR_PLAN.md`'s literal rule
- `same_page_next_column` — L → R on the same page
- `next_page_left_column` — for a question in column R

All three probes are deterministic text-layer searches of the top 60 pt of a column. Nothing is guessed; a question with no hit goes to `manual_review.json`.

- [ ] **Step 1: Write `resolve_boundaries.py`**

Create `files/resolve_boundaries.py`:

```python
#!/usr/bin/env python3
"""Phase 3 - resolve page-boundary artifacts on the Laws of Motion pages.
Deterministic. No AI, no cost."""
import json
import re

import pymupdf

import pyq_common as p

DATE_RE = re.compile(r"(\d{1,2})\s+([A-Z][a-z]{2})\s+(20\d{2})\s*\(([ME])\)")
MONTHS = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}
TOP_BAND_PT = 60.0
ORPHAN_TOP_PT = 60.0


def column_top_text(doc, page_no, column):
    """Text in the top 60 pt of one column of a 1-indexed page."""
    if page_no < 1 or page_no > len(doc):
        return ""
    page = doc[page_no - 1]
    width = page.rect.width
    mid = width / 2
    x0, x1 = (38.0, mid) if column == "L" else (mid, width - 18.0)
    return page.get_textbox(pymupdf.Rect(x0, 0.0, x1, TOP_BAND_PT))


def parse_date(text):
    m = DATE_RE.search(text or "")
    if not m:
        return None
    d, mon, y, shift = m.groups()
    if mon not in MONTHS:
        return None
    return (f"{y}-{MONTHS[mon]:02d}-{int(d):02d}",
            "morning" if shift == "M" else "evening")


def main():
    sb = p.supabase_client()
    doc = pymupdf.open(p.PDF_PATH)
    skeleton = p.load_skeleton()
    orphans = json.loads((p.OUT / "orphan_figures.json").read_text(encoding="utf-8"))

    ch5 = [r for r in skeleton if r["chapter_no"] == p.CHAPTER_5]
    undated = [r for r in ch5 if not r["exam_date"]]
    print(f"chapter 5 undated : {len(undated)}")

    fixes, unresolved = [], []
    for rec in undated:
        page, col = rec["page"], rec["column"]
        probes = [("next_page_same_column", page + 1, col)]
        if col == "L":
            probes.append(("same_page_next_column", page, "R"))
        else:
            probes.append(("next_page_left_column", page + 1, "L"))

        hit = None
        for rule, probe_page, probe_col in probes:
            parsed = parse_date(column_top_text(doc, probe_page, probe_col))
            if parsed:
                hit = (rule, probe_page, parsed)
                break

        if hit is None:
            unresolved.append({"kind": "date", "q_no": rec["q_no"],
                               "page": page, "column": col})
            continue

        rule, found_page, (date, shift) = hit
        fixes.append({"q_no": rec["q_no"], "page": page, "column": col,
                      "exam_date": date, "exam_shift": shift,
                      "found_on_page": found_page, "rule": rule})

    # orphan figures on chapter pages: last question of the same column, previous page
    orphan_fixes = []
    for orph in orphans:
        if orph["page"] not in p.CHAPTER_5_PAGES:
            continue
        if orph["bbox"][1] >= ORPHAN_TOP_PT:
            unresolved.append({"kind": "orphan", **orph, "why": "not at column top"})
            continue
        page_width = doc[orph["page"] - 1].rect.width
        col = "L" if orph["bbox"][0] < page_width / 2 else "R"
        prev = [r for r in ch5 if r["page"] == orph["page"] - 1 and r["column"] == col]
        if not prev:
            unresolved.append({"kind": "orphan", **orph,
                               "why": "no question in that column on the previous page"})
            continue
        owner = max(prev, key=lambda r: r["bbox"][1])
        orphan_fixes.append({"figure_key": orph["figure_key"], "page": orph["page"],
                             "owner_q_no": owner["q_no"], "owner_page": owner["page"],
                             "column": col, "rule": "orphan_top_of_column"})

    (p.OUT / "boundary_fixes.json").write_text(json.dumps(
        {"dates": fixes, "orphans": orphan_fixes}, indent=2), encoding="utf-8")
    (p.OUT / "manual_review.json").write_text(json.dumps(
        unresolved, indent=2), encoding="utf-8")

    ch5_id = sb.table("pyq_chapters").select("id").eq(
        "chapter_no", p.CHAPTER_5).execute().data[0]["id"]
    for fix in fixes:
        sb.table("pyq_questions").update(
            {"exam_date": fix["exam_date"], "exam_shift": fix["exam_shift"]}
        ).eq("chapter_id", ch5_id).eq("q_no", fix["q_no"]).execute()

    print(f"dates resolved    : {len(fixes)}")
    for fix in fixes:
        print(f"  Q{fix['q_no']} p{fix['page']}{fix['column']} -> "
              f"{fix['exam_date']} {fix['exam_shift']} via {fix['rule']}")
    print(f"orphans on 47-60  : "
          f"{len([o for o in orphans if o['page'] in p.CHAPTER_5_PAGES])}")
    print(f"orphans resolved  : {len(orphan_fixes)}")
    print(f"manual review     : {len(unresolved)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe resolve_boundaries.py
```

Expected shape of stdout — `dates resolved` is what the run measures, so do not pre-assume 5:

```
chapter 5 undated : 5
dates resolved    : <0..5>
  Q30 p50L -> ... via ...
orphans on 47-60  : 0
orphans resolved  : 0
manual review     : <5 minus dates resolved>
```

- [ ] **Step 3: Acceptance gate**

`CURSOR_PLAN.md`'s Phase 3 gate is book-wide (orphans < 15, undated < 40). Scoped to the pilot chapter it becomes:

```sql
select count(*) as undated from pyq_questions q
join pyq_chapters c on c.id = q.chapter_id
where c.chapter_no = 5 and q.exam_date is null;
```

Passes when **either** `undated = 0`, **or** every remaining undated question appears in `out/manual_review.json` with its page number. Orphans on pages 47–60 must read `0` — that is already true from Phase 1 and the script asserts it rather than discovering it.

Book-wide totals stay at 88 orphans and 228 undated; that is expected and is not a gate failure.

- [ ] **Step 4: Spot-check one fix against the PDF**

For the first entry in `out/boundary_fixes.json`, open `out/pages/page_0NN.png` for its `found_on_page` and confirm by eye that the date tag really sits at the top of the named column. If it does not, the probe order is wrong — fix the script, do not hand-edit the JSON.

- [ ] **Step 5: Append to `PROGRESS.md`**

Append `## Phase 3 — Orphans and dates · PASS|FAIL` with: stdout, which probe rule fired for each of the five questions, the contents of `manual_review.json`, the explicit note that orphan resolution was a no-op because the pilot chapter has none, `Cost: ₹0`.

---

### Task 4: Phase 4 — extraction model bake-off

**Files:**
- Create: `files/bakeoff.py`
- Create: `files/out/bakeoff_results.md`
- Modify: `files/PROGRESS.md` (append)

**Interfaces:**
- Consumes: `pyq_common.call_sarvam`, `pyq_common.call_gemini`, `pyq_common.validate_page_response`, `pyq_common.RateLimiter`, `out/pages/page_NNN.png`
- Produces:
  - `out/bakeoff/<candidate>/page_NNN.json` — raw responses
  - `out/bakeoff_results.md` — scoring table and a recommendation
  - The chosen model id, recorded in `PROGRESS.md`, consumed by Task 5

**Cost: ~₹5** — 6 pages × 3 candidates = 18 page-calls at `CURSOR_PLAN.md`'s ₹0.28/page. This is the first task that spends money, and it is a decision gate: **do not skip it.**

**The 6 pages**, down from `CURSOR_PLAN.md`'s 20, and including one figure-heavy and one math-dense Laws of Motion page as the spec requires. Figure counts and math-glyph density were measured from the PDF while writing this plan:

| Page | Chapter | Questions | Figures | Why |
|---|---|---|---|---|
| 21 | 2 Units and Dimensions | 13 | 0 | Easy control — `CURSOR_PLAN.md`'s pick, verified to have no figures |
| 8 | 1 Mathematics in Physics | 6 | 6 | Hard control — match-list with option images, `CURSOR_PLAN.md`'s pick |
| 103 | 8 Rotational Motion | 7 | 3 | Densest math in Rotational Motion, 41.6 math glyphs per question |
| 57 | **5 Laws of Motion** | 8 | **9** | **Figure-heavy pilot page** — most figures in the chapter |
| 58 | **5 Laws of Motion** | 9 | 2 | **Math-dense pilot page** — 36.8 math glyphs per question, chapter high |
| 50 | 5 Laws of Motion | 13 | 5 | Most questions on any pilot page |

56 questions in total — enough to eyeball LaTeX without a large spend.

**Candidates**, per `CURSOR_PLAN.md`:

| Candidate | Route |
|---|---|
| `gemma4` via Sarvam, image input | `pyq_common.call_sarvam` |
| Sarvam Vision via the Doc Agents dashboard | Manual, ~15 min, results pasted into `out/bakeoff/sarvam_vision/` by hand |
| `gemini-flash-lite` | External control, `pyq_common.call_gemini` |

- [ ] **Step 1: Confirm endpoint and model ids before spending anything**

`CURSOR_PLAN.md` names `/v2/chat/completions`; `Web/lib/sarvamGyanClient.ts` uses `/v1/chat/completions` in production with `sarvam-m`. Model slugs move. Probe first:

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe -c "import httpx, pyq_common as p; e=p.load_env(); r=httpx.get('https://api.sarvam.ai/v1/models', headers={'api-subscription-key': e['SARVAM_API_KEY']}, timeout=60); print(r.status_code); print(r.text[:2000])"
```

Record the exact vision-capable model ids the response lists. If a slug in the candidate table is absent, substitute the nearest listed vision model and write both the intended and the substituted id into `bakeoff_results.md`. If `/v1/models` 404s, retry the same call against `https://api.sarvam.ai/v2/models` and switch `pyq_common.SARVAM_CHAT_URL` to `/v2/chat/completions` only if that one answers.

- [ ] **Step 2: Write `bakeoff.py`**

Create `files/bakeoff.py`. The prompt builder here is the same one Task 5 uses, so define it once and import it there.

```python
#!/usr/bin/env python3
"""Phase 4 - bake-off across 6 pages. Scores structure automatically;
LaTeX correctness is scored by human eye on these pages only."""
import base64
import json
import re
import sys

import pyq_common as p

BAKEOFF_PAGES = [21, 8, 103, 57, 58, 50]
FIG_RE = re.compile(r"\[\[fig:([^\]]+)\]\]")

SYSTEM_PROMPT = """You transcribe questions from a printed JEE Main physics book page.
You are given the page image and the exact list of questions on that page.
Your ONLY job is to transcribe. Never invent, merge, split, renumber or drop a question.

Rules:
- Return JSON: {"questions": [{"q_no": int, "body": str, "options": [str, str, str, str] | null}]}
- Return exactly the q_no values supplied, no others, and every one of them.
- body is Markdown with inline LaTeX between single dollar signs.
- For an MCQ, options is exactly four strings in printed order (1,2,3,4).
- For a numerical question, options is null.
- Where a figure belongs, place the placeholder [[fig:KEY]] using ONLY the figure keys
  supplied for that question. Never invent a key.
- Do not include the date tag, the tier heading, the topic heading or the page number.
- Do not solve anything. Do not add explanation."""


def page_slice(skeleton, page_no):
    recs = sorted((r for r in skeleton if r["page"] == page_no),
                  key=lambda r: (r["column"] == "R", r["bbox"][1]))
    return [{"q_no": r["q_no"], "figure_keys": r["figure_keys"], "tier": r["tier"],
             "topic": r["topic"], "exam_date": r["exam_date"],
             "answer_type": r["answer_type"]} for r in recs]


def user_prompt(page_no, slice_):
    return (f"Page {page_no}. Questions on this page, in reading order "
            f"(left column top to bottom, then right column):\n"
            f"{json.dumps(slice_, ensure_ascii=False, indent=1)}\n"
            f"Transcribe every one of them.")


def page_image_b64(page_no):
    return base64.b64encode(
        (p.OUT / "pages" / f"page_{page_no:03d}.png").read_bytes()).decode()


def run_sarvam(model, pages, skeleton, api_key, limiter, out_dir):
    for page_no in pages:
        slice_ = page_slice(skeleton, page_no)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": user_prompt(page_no, slice_)},
                {"type": "image_url",
                 "image_url": {"url": f"data:image/png;base64,{page_image_b64(page_no)}"}},
            ]},
        ]
        raw = p.call_sarvam(model, messages, api_key, limiter)
        (out_dir / f"page_{page_no:03d}.json").write_text(
            json.dumps(raw, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  sarvam {model} page {page_no} ok")


def run_gemini(model, pages, skeleton, api_key, out_dir):
    for page_no in pages:
        slice_ = page_slice(skeleton, page_no)
        parts = [
            {"text": SYSTEM_PROMPT + "\n\n" + user_prompt(page_no, slice_)},
            {"inline_data": {"mime_type": "image/png", "data": page_image_b64(page_no)}},
        ]
        raw = p.call_gemini(model, parts, api_key)
        (out_dir / f"page_{page_no:03d}.json").write_text(
            json.dumps(raw, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  gemini {model} page {page_no} ok")


def content_of(raw):
    if "choices" in raw:
        return raw["choices"][0]["message"]["content"]
    return raw["candidates"][0]["content"]["parts"][0]["text"]


def score(candidate, pages, skeleton):
    out_dir = p.OUT / "bakeoff" / candidate
    rows = []
    for page_no in pages:
        slice_ = page_slice(skeleton, page_no)
        allowed_q = {s["q_no"] for s in slice_}
        allowed_f = {k for s in slice_ for k in s["figure_keys"]}
        path = out_dir / f"page_{page_no:03d}.json"
        if not path.exists():
            rows.append({"page": page_no, "valid_json": False, "q_no_exact": False,
                         "figures_placed": 0, "figures_expected": len(allowed_f),
                         "error": "no response file"})
            continue
        try:
            payload = json.loads(content_of(json.loads(path.read_text(encoding="utf-8"))))
            questions = p.validate_page_response(payload, allowed_q, allowed_f)
            placed = len(FIG_RE.findall(json.dumps(questions, ensure_ascii=False)))
            rows.append({"page": page_no, "valid_json": True, "q_no_exact": True,
                         "figures_placed": placed, "figures_expected": len(allowed_f),
                         "error": ""})
        except Exception as exc:
            rows.append({"page": page_no, "valid_json": False, "q_no_exact": False,
                         "figures_placed": 0, "figures_expected": len(allowed_f),
                         "error": f"{type(exc).__name__}: {exc}"})
    return rows


def main():
    env = p.load_env()
    skeleton = p.load_skeleton()
    limiter = p.RateLimiter(60)
    candidate = sys.argv[1]          # gemma4 | sarvam_vision | gemini-flash-lite
    out_dir = p.OUT / "bakeoff" / candidate
    out_dir.mkdir(parents=True, exist_ok=True)

    if candidate == "sarvam_vision":
        print("manual candidate - paste dashboard JSON into", out_dir)
    elif candidate.startswith("gemini"):
        run_gemini(candidate, BAKEOFF_PAGES, skeleton, env["GEMINI_API_KEY"], out_dir)
    else:
        run_sarvam(candidate, BAKEOFF_PAGES, skeleton, env["SARVAM_API_KEY"],
                   limiter, out_dir)

    rows = score(candidate, BAKEOFF_PAGES, skeleton)
    (p.OUT / "bakeoff" / f"{candidate}_score.json").write_text(
        json.dumps(rows, indent=2), encoding="utf-8")
    ok = sum(1 for r in rows if r["q_no_exact"])
    print(f"{candidate}: {ok}/{len(rows)} pages with an exact q_no match")
    for r in rows:
        print("  ", r)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run all three candidates**

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe bakeoff.py gemma4
C:\Python314\python.exe bakeoff.py gemini-flash-lite
C:\Python314\python.exe bakeoff.py sarvam_vision
```

Substitute the model ids Step 1 confirmed. `sarvam_vision` is the manual candidate: run the 6 page images through the Sarvam Doc Agents dashboard, save each response as `out/bakeoff/sarvam_vision/page_NNN.json` in the same `{"choices":[{"message":{"content":"…"}}]}` envelope, then re-run the command to score them.

- [ ] **Step 4: Score LaTeX correctness by eye**

Structure scoring is automatic. LaTeX is not. For each candidate, open the 56 transcribed bodies beside `out/pages/page_NNN.png` and count questions whose LaTeX renders the same mathematics as the print. Correctness is `correct / 56`. Score only these 6 pages — that is the whole point of a bake-off.

```powershell
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe -c "import json,sys,pathlib,pyq_common as p; from bakeoff import BAKEOFF_PAGES, content_of; c=sys.argv[1]; [print('='*20,'page',n) or [print(q['q_no'],'|',q['body'][:300]) for q in json.loads(content_of(json.loads((p.OUT/'bakeoff'/c/f'page_{n:03d}.json').read_text(encoding='utf-8'))))['questions']] for n in BAKEOFF_PAGES]" gemma4
```

- [ ] **Step 5: Write `bakeoff_results.md`**

Create `files/out/bakeoff_results.md` with this exact table, filled from the measured runs:

```markdown
# Phase 4 — Bake-off results

Pages: 21 (easy, 0 figures) · 8 (match-list, 6 figures) · 103 (Rotational Motion, math-dense)
· 57 (Laws of Motion, 9 figures) · 58 (Laws of Motion, math-dense) · 50 (Laws of Motion, 13 questions)
56 questions total. Endpoint used: <from Step 1>. Model ids used: <from Step 1>.

| Candidate | Pages valid JSON | Pages with exact q_no set | Figure placeholders placed / expected | LaTeX correct (human, /56) | Cost |
|---|---|---|---|---|---|
| gemma4 (Sarvam) | | | | | |
| Sarvam Vision (dashboard) | | | | | |
| gemini-flash-lite | | | | | |

## Recommendation

<model id>, because <reason>. Runner-up: <model id>.

## Failures worth knowing about

<per-candidate notes: dropped questions, invented figure keys, LaTeX habits>
```

- [ ] **Step 6: Acceptance gate — the decision gate**

From `CURSOR_PLAN.md`: the leader must reach **≥ 90% LaTeX correctness** to proceed with that model. **If nothing clears 80%, STOP and report. Do not spend the extraction budget.**

At 56 questions, 90% is ≥ 51 correct and 80% is ≥ 45. Note in `bakeoff_results.md` that a 56-question eyeball has a wide confidence interval — it selects a model, it is not an accuracy claim. Only Task 8 produces a quotable accuracy number.

- [ ] **Step 7: Append to `PROGRESS.md`**

Append `## Phase 4 — Bake-off · PASS|FAIL` with the results table, the chosen model id and endpoint, the actual number of API calls, actual cost, and the runner-up (Task 5 and Task 6 both need it — Task 6 must use a *different* model).

---

### Task 5: Phase 5 — constrained extraction, pass 1

**Files:**
- Create: `files/extract_pass.py`
- Modify: `files/PROGRESS.md` (append)

**Interfaces:**
- Consumes: the winning model id from Task 4; `SYSTEM_PROMPT`, `page_slice`, `user_prompt`, `page_image_b64` imported from `bakeoff.py`; `pyq_common.validate_page_response`, `pyq_common.RateLimiter`
- Produces:
  - `out/extracted/pass1/page_NNN.json` — raw model response per page
  - `out/extracted/pass1/parsed.json` — `{"<q_no>": {"body": str, "options": list|null, "page": int}}`
  - `out/extracted/pass1/failures.json` — pages that never validated

**Cost: ~₹4** — 14 pages at ₹0.28. Re-runs are free for pages whose raw JSON already exists on disk.

**Settings, from `CURSOR_PLAN.md`:** `temperature = 0`, `response_format = json`, concurrency 8, respecting Sarvam's 60 requests/minute on Starter. Raw responses persist per page so a crash never costs a re-run.

The prompt carries that page's skeleton slice: `q_no` in reading order, which question owns which `figure_keys`, tier, topic, and exam dates. The model transcribes the stem as Markdown with inline LaTeX, splits four options or marks the question numerical, and places `[[fig:KEY]]` placeholders using only the supplied keys.

**Whitelist enforcement, and escalation.** A response containing an unknown `q_no` or `figure_key`, or whose `q_no` set does not exactly match the skeleton slice, is rejected and the page is retried. Retries escalate to a **different** model — attempt 1 uses the Task 4 winner, attempt 2 the runner-up, attempt 3 the third candidate. Re-running the same model reproduces systematic misreads, so it is not a retry.

- [ ] **Step 1: Write `extract_pass.py`**

Create `files/extract_pass.py`. It serves both Task 5 and Task 6 — one script, two invocations.

```python
#!/usr/bin/env python3
"""Phase 5 / 6 - constrained extraction of the Laws of Motion pages.

    python extract_pass.py --pass 1 --models gemma4,gemini-flash-lite
    python extract_pass.py --pass 2 --models gemini-flash-lite,gemma4
"""
import argparse
import json
from concurrent.futures import ThreadPoolExecutor

import pyq_common as p
from bakeoff import (SYSTEM_PROMPT, content_of, page_image_b64, page_slice,
                     user_prompt)


def call_model(model, page_no, slice_, env, limiter):
    if model.startswith("gemini"):
        parts = [{"text": SYSTEM_PROMPT + "\n\n" + user_prompt(page_no, slice_)},
                 {"inline_data": {"mime_type": "image/png",
                                  "data": page_image_b64(page_no)}}]
        return p.call_gemini(model, parts, env["GEMINI_API_KEY"])
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": [
            {"type": "text", "text": user_prompt(page_no, slice_)},
            {"type": "image_url",
             "image_url": {"url": f"data:image/png;base64,{page_image_b64(page_no)}"}},
        ]},
    ]
    return p.call_sarvam(model, messages, env["SARVAM_API_KEY"], limiter)


def extract_page(page_no, skeleton, models, env, limiter, out_dir):
    slice_ = page_slice(skeleton, page_no)
    allowed_q = {s["q_no"] for s in slice_}
    allowed_f = {k for s in slice_ for k in s["figure_keys"]}
    raw_path = out_dir / f"page_{page_no:03d}.json"

    # A page already on disk is never re-billed.
    if raw_path.exists():
        try:
            payload = json.loads(content_of(json.loads(
                raw_path.read_text(encoding="utf-8"))))
            return page_no, p.validate_page_response(payload, allowed_q, allowed_f), None
        except Exception:
            pass

    last = None
    for attempt, model in enumerate(models, start=1):
        try:
            raw = call_model(model, page_no, slice_, env, limiter)
            payload = json.loads(content_of(raw))
            questions = p.validate_page_response(payload, allowed_q, allowed_f)
            raw_path.write_text(json.dumps(raw, ensure_ascii=False, indent=1),
                                encoding="utf-8")
            print(f"page {page_no} ok via {model} (attempt {attempt})")
            return page_no, questions, None
        except Exception as exc:
            last = f"{model}: {type(exc).__name__}: {exc}"
            print(f"page {page_no} attempt {attempt} with {model} failed - {last}")
    return page_no, None, last


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pass", dest="pass_no", required=True, choices=["1", "2"])
    ap.add_argument("--models", required=True,
                    help="comma-separated, in escalation order; index 0 is the primary")
    ap.add_argument("--concurrency", type=int, default=8)
    args = ap.parse_args()

    env = p.load_env()
    skeleton = p.load_skeleton()
    limiter = p.RateLimiter(60)
    models = [m.strip() for m in args.models.split(",") if m.strip()]
    out_dir = p.OUT / "extracted" / f"pass{args.pass_no}"
    out_dir.mkdir(parents=True, exist_ok=True)

    pages = sorted({r["page"] for r in skeleton if r["chapter_no"] == p.CHAPTER_5})
    print(f"pages to extract : {len(pages)} -> {pages}")

    parsed, failures = {}, {}
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [pool.submit(extract_page, n, skeleton, models, env, limiter, out_dir)
                   for n in pages]
        for fut in futures:
            page_no, questions, err = fut.result()
            if questions is None:
                failures[str(page_no)] = err
                continue
            for q in questions:
                parsed[str(q["q_no"])] = {"body": q["body"],
                                          "options": q.get("options"),
                                          "page": page_no}

    (out_dir / "parsed.json").write_text(
        json.dumps(parsed, ensure_ascii=False, indent=1), encoding="utf-8")
    (out_dir / "failures.json").write_text(json.dumps(failures, indent=2),
                                           encoding="utf-8")

    expected = {str(r["q_no"]) for r in skeleton if r["chapter_no"] == p.CHAPTER_5}
    print(f"pages ok     : {len(pages) - len(failures)}/{len(pages)}")
    print(f"questions    : {len(parsed)}/{len(expected)}")
    print(f"missing q_no : {sorted(int(x) for x in expected - set(parsed))}")
    print(f"failed pages : {sorted(int(x) for x in failures)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run pass 1**

Primary is the Task 4 winner; the rest are the escalation ladder, most-preferred first.

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe extract_pass.py --pass 1 --models gemma4,gemini-flash-lite --concurrency 8
```

Expected stdout tail:

```
pages to extract : 14 -> [47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60]
pages ok     : 14/14
questions    : 132/132
missing q_no : []
failed pages : []
```

- [ ] **Step 3: Acceptance gate**

From `CURSOR_PLAN.md`: **every page returns valid JSON whose `q_no` set exactly matches the skeleton for that page.** `validate_page_response` enforces it, so the gate reduces to `failures.json == {}` and `len(parsed) == 132`.

```powershell
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe -c "import json,pyq_common as p; d=p.OUT/'extracted'/'pass1'; f=json.loads((d/'failures.json').read_text()); q=json.loads((d/'parsed.json').read_text(encoding='utf-8')); print('failures',f); print('questions',len(q)); print('null bodies',[k for k,v in q.items() if not v['body']]); print('mcq with != 4 options',[k for k,v in q.items() if v['options'] is not None and len(v['options'])!=4])"
```

Expected: `failures {}`, `questions 132`, `null bodies []`, `mcq with != 4 options []`.

If any page still fails after the full escalation ladder, stop and report which page and which model said what. Do not hand-write a body — that would break Invariant 1's spirit even though it technically only touches `body`.

- [ ] **Step 4: Cross-check option shape against the answer key**

Every question the answer key calls `mcq` must have four options; every `numerical` must have `options: null`.

```powershell
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe -c "import json,pyq_common as p; sk={str(r['q_no']):r for r in p.load_skeleton() if r['chapter_no']==5}; q=json.loads((p.OUT/'extracted'/'pass1'/'parsed.json').read_text(encoding='utf-8')); bad=[(k,sk[k]['answer_type'],None if q[k]['options'] is None else len(q[k]['options'])) for k in q if (sk[k]['answer_type']=='mcq')!=(q[k]['options'] is not None)]; print('shape mismatches',bad)"
```

Expected: `shape mismatches []`. A mismatch means the model misread an MCQ as numerical or vice versa; re-extract that page with the next model in the ladder by deleting its raw JSON first.

- [ ] **Step 5: Append to `PROGRESS.md`**

Append `## Phase 5 — Extraction pass 1 · PASS|FAIL` with: model and endpoint used, 14 page list, pages needing escalation and to which model, `questions 132/132`, wall clock, actual cost, and any prompt weakness you noticed.

---

### Task 6: Phase 6 — second observer, diff, and the database write

**Files:**
- Create: `files/diff_passes.py`
- Modify: `files/PROGRESS.md` (append)

**Interfaces:**
- Consumes: `out/extracted/pass1/parsed.json`; `extract_pass.py` from Task 5; `pyq_common.normalise_latex`
- Produces:
  - `out/extracted/pass2/parsed.json`
  - `out/diff_report.json` — `{"<q_no>": {"verdict": "agree"|"differ", "pass1": {...}, "pass2": {...}, "fields": [str]}}`
  - `pyq_questions.body`, `pyq_question_options` rows, `pyq_questions.extraction_confidence`, `review_status = 'unreviewed'`
  - Re-roled `pyq_figure_links` where a figure key appears only inside an option body

**Cost: ~₹4** — the same 14 pages through a different model.

The second observer must be a **different** model from pass 1 (Invariant 5). Normalise LaTeX before diffing so cosmetic differences do not create false flags: `\dfrac`→`\frac`, `\left(`→`(`, whitespace collapsed, `U+2212`→`-`. `pyq_common.normalise_latex` already does this. **Expect 10–15% disagreement** — 13 to 20 of the 132.

This task also performs the only write of `body` and `options` to Postgres. Confidence follows D9: 1.0 when the passes agree, 0.5 when they differ, 0.0 when pass 2 has no entry.

- [ ] **Step 1: Run pass 2 with the runner-up model**

Swap the ladder so a different model is primary.

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe extract_pass.py --pass 2 --models gemini-flash-lite,gemma4 --concurrency 8
```

Expected: `pages ok : 14/14`, `questions : 132/132`, `failed pages : []`. If pass 2's primary is the same model as pass 1's, stop — that is not a second observer.

- [ ] **Step 2: Write `diff_passes.py`**

Create `files/diff_passes.py`:

```python
#!/usr/bin/env python3
"""Phase 6 - diff the two passes, then write bodies and options to Postgres."""
import collections
import json
import re

import pyq_common as p

FIG_RE = re.compile(r"\[\[fig:([^\]]+)\]\]")


def load_pass(n):
    path = p.OUT / "extracted" / f"pass{n}" / "parsed.json"
    return json.loads(path.read_text(encoding="utf-8"))


def compare(a, b):
    """Return the list of fields that differ after normalisation."""
    fields = []
    if p.normalise_latex(a["body"]) != p.normalise_latex(b["body"]):
        fields.append("body")
    oa, ob = a.get("options"), b.get("options")
    if (oa is None) != (ob is None):
        fields.append("options_shape")
    elif oa is not None:
        if len(oa) != len(ob):
            fields.append("options_shape")
        else:
            for i, (x, y) in enumerate(zip(oa, ob)):
                if p.normalise_latex(x) != p.normalise_latex(y):
                    fields.append(f"option_{i + 1}")
    if set(FIG_RE.findall(json.dumps(a, ensure_ascii=False))) != \
       set(FIG_RE.findall(json.dumps(b, ensure_ascii=False))):
        fields.append("figure_placeholders")
    return fields


def main():
    sb = p.supabase_client()
    p1, p2 = load_pass(1), load_pass(2)

    report = {}
    for q_no, a in p1.items():
        b = p2.get(q_no)
        if b is None:
            report[q_no] = {"verdict": "differ", "fields": ["missing_in_pass2"],
                            "pass1": a, "pass2": None}
            continue
        fields = compare(a, b)
        report[q_no] = {"verdict": "agree" if not fields else "differ",
                        "fields": fields, "pass1": a, "pass2": b}

    (p.OUT / "diff_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")

    agree = sum(1 for r in report.values() if r["verdict"] == "agree")
    differ = len(report) - agree
    tally = collections.Counter(f for r in report.values() for f in r["fields"])
    print(f"questions   : {len(report)}")
    print(f"agree       : {agree}")
    print(f"differ      : {differ}  ({differ / max(1, len(report)):.1%})")
    print(f"field tally : {dict(sorted(tally.items()))}")

    # --- write pass 1 into Postgres ---
    ch5_id = sb.table("pyq_chapters").select("id").eq(
        "chapter_no", p.CHAPTER_5).execute().data[0]["id"]
    rows = sb.table("pyq_questions").select("id,q_no").eq(
        "chapter_id", ch5_id).execute().data
    q_ids = {str(r["q_no"]): r["id"] for r in rows}

    option_rows, written = [], 0
    for q_no, entry in report.items():
        body = entry["pass1"]["body"]
        if entry["pass2"] is None:
            confidence = 0.0
        else:
            confidence = 1.0 if entry["verdict"] == "agree" else 0.5
        sb.table("pyq_questions").update({
            "body": body,
            "extraction_confidence": confidence,
            "review_status": "unreviewed",
        }).eq("id", q_ids[q_no]).execute()
        written += 1
        for i, text in enumerate(entry["pass1"].get("options") or [], start=1):
            option_rows.append({"question_id": q_ids[q_no], "option_index": i,
                                "body": text})

    if option_rows:
        sb.table("pyq_question_options").upsert(
            option_rows, on_conflict="question_id,option_index").execute()
    print(f"bodies written : {written}")
    print(f"options written: {len(option_rows)}")

    # re-role links whose figure key appears only inside an option body
    opt_only = {}
    for q_no, entry in report.items():
        in_body = set(FIG_RE.findall(entry["pass1"]["body"] or ""))
        in_opts = set(FIG_RE.findall(
            json.dumps(entry["pass1"].get("options") or [], ensure_ascii=False)))
        for key in in_opts - in_body:
            opt_only.setdefault(q_no, []).append(key)
    if opt_only:
        fig_ids = {f["figure_key"]: f["id"] for f in
                   sb.table("pyq_figures").select("id,figure_key").execute().data}
        for q_no, keys in opt_only.items():
            for key in keys:
                sb.table("pyq_figure_links").update({"role": "option"}) \
                    .eq("question_id", q_ids[q_no]).eq("figure_id", fig_ids[key]).execute()
    print(f"links re-roled to option : {sum(len(v) for v in opt_only.values())}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the diff and the write**

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe diff_passes.py
```

Expected shape:

```
questions   : 132
agree       : <112..119>
differ      : <13..20>  (10%..15%)
field tally : {'body': ..., 'option_2': ..., ...}
bodies written : 132
options written: 452
```

452 is 113 MCQs × 4. If `differ` lands far outside 10–15%, say why in `PROGRESS.md`: below ~5% usually means the normaliser is over-collapsing real differences; above ~25% usually means the two models were given different prompts or one is mis-splitting options.

- [ ] **Step 4: Acceptance gate**

From `CURSOR_PLAN.md`: **the diff report covers every question in scope** — 132 of 132 here, not 4,115, because the pilot narrows from Phase 4 on.

```sql
select count(*) as total,
       count(body) as with_body,
       count(*) filter (where review_status = 'unreviewed')   as unreviewed,
       count(*) filter (where review_status = 'skeleton_only') as still_skeleton,
       count(*) filter (where extraction_confidence = 1.0)     as confident,
       count(*) filter (where extraction_confidence = 0.5)     as differing
from pyq_questions q join pyq_chapters c on c.id = q.chapter_id
where c.chapter_no = 5;

select count(*) as options from pyq_question_options o
join pyq_questions q on q.id = o.question_id
join pyq_chapters c on c.id = q.chapter_id where c.chapter_no = 5;

select delta from v_pyq_ingestion_check where chapter_no = 5;
```

Expected: `total 132`, `with_body 132`, `unreviewed 132`, `still_skeleton 0`, `confident + differing = 132`, `options 452`, `delta 0`. `delta` must still be 0 — this task must not have created or destroyed a question.

- [ ] **Step 5: Eyeball three questions end to end**

Pick one `agree`, one `differ`, and one with a figure. For each, print the stored body and options and compare against the page raster.

```powershell
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe -c "import json,pyq_common as p; sb=p.supabase_client(); c=sb.table('pyq_chapters').select('id').eq('chapter_no',5).execute().data[0]['id']; rows=sb.table('pyq_questions').select('q_no,body,source_page,extraction_confidence').eq('chapter_id',c).in_('q_no',[1,2,3]).execute().data; [print(r['q_no'], r['source_page'], r['extraction_confidence'], '\n', r['body'], '\n') for r in rows]"
```

Confirm that `[[fig:…]]` placeholders sit where the printed figure sits, and that no date tag, tier heading or page number leaked into the body.

- [ ] **Step 6: Append to `PROGRESS.md`**

Append `## Phase 6 — Second observer · PASS|FAIL` with: pass-2 model, the agree/differ split and whether it landed in the expected 10–15%, the field tally, the `confident`/`differing` counts, actual cost, and the three hand-checked questions.

---

### Task 7: Phase 7 — solve-verify

**Files:**
- Create: `files/solve_verify.py`
- Modify: `files/PROGRESS.md` (append)

**Interfaces:**
- Consumes: `pyq_questions.body` and `pyq_question_options` written by Task 6; `pyq_figures.public_url`; `out/skeleton.json` for `answer_value`
- Produces: `out/solve_verify.json` — `{"<q_no>": {"model_answer": str, "expected": str, "solve_match": bool, "answer_type": str, "has_figure": bool}}`

**Cost: ~₹16** — 132 questions at `CURSOR_PLAN.md`'s ₹0.12/question.

A reasoning model gets the extracted stem, the options, and the figure images for the questions that have them, and is asked for **the answer only** — an option number or a numeric value. `CURSOR_PLAN.md` names `glm5.3-flash` on Sarvam; confirm the slug against the Step 1 model list from Task 4 and substitute if it is absent. Compare against `answer_value` from the skeleton to set `solve_match`.

**Known blind spot — record this in the output and in `PROGRESS.md`.** This validates the answer path only. It cannot detect corruption in a distractor string, or in stem detail that does not change the calculation. For the pilot that is 113 × 3 = **339 distractor strings** that solve-verify says nothing about. Only Task 8's gold sample looks at them.

Numeric comparison is not string comparison: `10`, `10.0` and `1.0e1` are the same answer. Compare numerically with a tolerance, and fall back to exact string match when the value will not parse as a float.

- [ ] **Step 1: Write `solve_verify.py`**

Create `files/solve_verify.py`:

```python
#!/usr/bin/env python3
"""Phase 7 - ask a reasoning model for the answer only, compare to the key."""
import argparse
import json
import re
from concurrent.futures import ThreadPoolExecutor

import httpx

import pyq_common as p

SYSTEM = """You are given one JEE Main physics question, its options if it has any,
and any figures it refers to. Answer it.

Return JSON only: {"answer": "<value>"}
- For a multiple-choice question, answer with the option number as a string: "1", "2", "3" or "4".
- For a numerical question, answer with the number only, no unit and no working.
Do not explain. Do not restate the question."""

FIG_RE = re.compile(r"\[\[fig:([^\]]+)\]\]")


def numbers_match(got, expected, rel=1e-2):
    try:
        a, b = float(got), float(expected)
    except (TypeError, ValueError):
        return str(got).strip() == str(expected).strip()
    if b == 0:
        return abs(a) <= rel
    return abs(a - b) / abs(b) <= rel


def build_messages(body, options, figure_urls):
    lines = [f"Question: {body}"]
    if options:
        for i, text in enumerate(options, start=1):
            lines.append(f"Option {i}: {text}")
        lines.append("This is a multiple-choice question. Give the option number.")
    else:
        lines.append("This is a numerical question. Give the number.")
    content = [{"type": "text", "text": "\n".join(lines)}]
    for url in figure_urls:
        content.append({"type": "image_url", "image_url": {"url": url}})
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": content}]


def verify_one(record, body, options, figure_urls, model, api_key, limiter):
    q_no = str(record["q_no"])
    try:
        raw = p.call_sarvam(model, build_messages(body, options, figure_urls),
                            api_key, limiter)
        answer = json.loads(raw["choices"][0]["message"]["content"])["answer"]
    except (httpx.HTTPError, KeyError, ValueError, json.JSONDecodeError) as exc:
        return q_no, {"model_answer": None, "expected": record["answer_value"],
                      "solve_match": False, "answer_type": record["answer_type"],
                      "has_figure": bool(figure_urls),
                      "error": f"{type(exc).__name__}: {exc}"}
    expected = record["answer_value"]
    match = (str(answer).strip() == str(expected).strip()
             if record["answer_type"] == "mcq"
             else numbers_match(answer, expected))
    return q_no, {"model_answer": str(answer), "expected": expected,
                  "solve_match": bool(match), "answer_type": record["answer_type"],
                  "has_figure": bool(figure_urls), "error": ""}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="glm5.3-flash")
    ap.add_argument("--concurrency", type=int, default=8)
    args = ap.parse_args()

    env = p.load_env()
    sb = p.supabase_client()
    limiter = p.RateLimiter(60)
    skeleton = {str(r["q_no"]): r for r in p.load_skeleton()
                if r["chapter_no"] == p.CHAPTER_5}

    ch5_id = sb.table("pyq_chapters").select("id").eq(
        "chapter_no", p.CHAPTER_5).execute().data[0]["id"]
    questions = sb.table("pyq_questions").select("id,q_no,body").eq(
        "chapter_id", ch5_id).execute().data
    opts = sb.table("pyq_question_options").select(
        "question_id,option_index,body").execute().data
    figs = {f["figure_key"]: f["public_url"] for f in
            sb.table("pyq_figures").select("figure_key,public_url").execute().data}

    by_q = {}
    for o in opts:
        by_q.setdefault(o["question_id"], []).append(o)

    jobs = []
    for q in questions:
        options = [o["body"] for o in
                   sorted(by_q.get(q["id"], []), key=lambda o: o["option_index"])]
        urls = [figs[k] for k in FIG_RE.findall(q["body"] or "") if k in figs]
        jobs.append((skeleton[str(q["q_no"])], q["body"], options or None, urls))

    results = {}
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [pool.submit(verify_one, rec, body, options, urls,
                               args.model, env["SARVAM_API_KEY"], limiter)
                   for rec, body, options, urls in jobs]
        for fut in futures:
            q_no, verdict = fut.result()
            results[q_no] = verdict

    (p.OUT / "solve_verify.json").write_text(json.dumps({
        "model": args.model,
        "blind_spot": ("Validates the answer path only. Cannot detect corruption in "
                       "the 339 distractor strings, or in stem detail that does not "
                       "change the calculation."),
        "verdicts": results,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    total = len(results)
    matched = sum(1 for v in results.values() if v["solve_match"])
    errored = sum(1 for v in results.values() if v.get("error"))
    print(f"verdicts     : {total}")
    print(f"solve_match  : {matched}  ({matched / max(1, total):.1%})")
    print(f"mismatched   : {total - matched}")
    print(f"api errors   : {errored}")
    print(f"mismatched with figure    : "
          f"{sum(1 for v in results.values() if not v['solve_match'] and v['has_figure'])}")
    print(f"mismatched numerical      : "
          f"{sum(1 for v in results.values() if not v['solve_match'] and v['answer_type'] == 'numerical')}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe solve_verify.py --model glm5.3-flash --concurrency 8
```

Expected shape:

```
verdicts     : 132
solve_match  : <n>  (<pct>)
mismatched   : <132 - n>
api errors   : 0
mismatched with figure    : <n>
mismatched numerical      : <n>
```

Do not set a pass threshold on the match rate. A mismatch can mean a bad extraction, a bad answer key entry, or a model that simply cannot solve the question — Task 9 triages, Task 8 measures.

- [ ] **Step 3: Acceptance gate**

From `CURSOR_PLAN.md`: **every question in scope has a verdict** — 132 of 132, with `api errors : 0`.

```powershell
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe -c "import json,pyq_common as p; d=json.loads((p.OUT/'solve_verify.json').read_text(encoding='utf-8')); v=d['verdicts']; print('verdicts',len(v)); print('missing',[q for q in map(str,range(1,133)) if q not in v]); print('errors',[q for q,x in v.items() if x.get('error')])"
```

Expected: `verdicts 132`, `missing []`, `errors []`. Any question with an API error must be re-run before the gate passes; a persistent error escalates to a different reasoning model.

- [ ] **Step 4: Append to `PROGRESS.md`**

Append `## Phase 7 — Solve-verify · PASS|FAIL` with: model used, the match rate, the mismatch breakdown by figure and by format, actual cost, and the blind-spot paragraph copied verbatim so the number is never read as an accuracy figure.

---

### Task 8: Phase 8 — gold sample and the one quotable accuracy number

**Files:**
- Create: `files/gold_sample.py`
- Create: `files/out/gold_sample.html` (generated)
- Create: `files/out/accuracy_report.md`
- Modify: `files/PROGRESS.md` (append)

**Interfaces:**
- Consumes: `pyq_questions` / `pyq_question_options` / `pyq_figures` from Task 6; `out/pages/page_NNN.png`; `out/solve_verify.json`
- Produces:
  - `out/gold_sample.json` — the drawn sample with its strata
  - `out/gold_sample.html` — human-verifiable artifact, page crop beside the extraction
  - `out/gold_corrections.json` — filled in by the human
  - `out/accuracy_report.md` — error rates with 95% confidence intervals

**Cost: ₹0** in API spend. The cost is a person reading 30 questions character by character.

**~30 of the 132**, stratified by tier (3 levels), figure presence (2), and MCQ versus numerical (2) — up to 12 cells. Proportional allocation with a floor of one per non-empty cell, drawn with a fixed seed (`random.Random(20260911)`) so the sample is reproducible. The script prints the realised strata table; do not pre-assume per-cell counts.

**This is the only accuracy figure anyone may quote.** Report two rates separately, as `CURSOR_PLAN.md` requires: **answer-affecting content** (stem and the correct option) and **distractor content** (the three wrong options) — because Task 7 is blind to the second. Use a Wilson score interval at 95%, which behaves properly at n=30 where the normal approximation does not.

- [ ] **Step 1: Write `gold_sample.py`**

Create `files/gold_sample.py`:

```python
#!/usr/bin/env python3
"""Phase 8 - draw a stratified gold sample, emit a review page, score it."""
import argparse
import base64
import collections
import html
import json
import math
import random

import pyq_common as p

SEED = 20260911
TARGET = 30


def wilson(successes, n, z=1.96):
    """95% Wilson score interval. Correct at n=30 where the normal approx is not."""
    if n == 0:
        return (0.0, 0.0, 0.0)
    phat = successes / n
    denom = 1 + z * z / n
    centre = (phat + z * z / (2 * n)) / denom
    margin = z * math.sqrt(phat * (1 - phat) / n + z * z / (4 * n * n)) / denom
    return (phat, max(0.0, centre - margin), min(1.0, centre + margin))


def draw(rows):
    strata = collections.defaultdict(list)
    for r in rows:
        strata[(r["tier"], bool(r["figure_keys"]), r["format"])].append(r)

    rng = random.Random(SEED)
    total = len(rows)
    picked, plan = [], {}
    for cell, members in sorted(strata.items(), key=lambda kv: str(kv[0])):
        want = max(1, round(TARGET * len(members) / total))
        want = min(want, len(members))
        plan[str(cell)] = {"in_chapter": len(members), "sampled": want}
        picked.extend(rng.sample(sorted(members, key=lambda r: r["q_no"]), want))

    picked.sort(key=lambda r: r["q_no"])
    return picked, plan


def render_html(picked, solve):
    parts = ["<!doctype html><meta charset='utf-8'>",
             "<title>Phase 8 gold sample</title>",
             "<style>body{font:14px/1.5 system-ui;margin:24px;max-width:1400px}"
             "section{border-top:2px solid #999;padding:18px 0;display:grid;"
             "grid-template-columns:1fr 1fr;gap:24px}"
             "img.crop{width:100%;border:1px solid #ccc}"
             "pre{white-space:pre-wrap;background:#f6f6f6;padding:10px}"
             "ol{margin:6px 0} .meta{color:#555;font-size:12px}</style>",
             "<h1>Phase 8 gold sample</h1>",
             "<p>Check every character against the page image on the left. "
             "Record each error in <code>out/gold_corrections.json</code> as "
             "<code>{\"q_no\": {\"answer_affecting\": true|false, \"note\": \"...\"}}</code>. "
             "A question with no entry counts as correct.</p>"]
    for r in picked:
        raster = p.OUT / "pages" / f"page_{r['source_page']:03d}.png"
        b64 = base64.b64encode(raster.read_bytes()).decode()
        opts = "".join(f"<li>{html.escape(o or '')}</li>" for o in (r["options"] or []))
        verdict = solve.get(str(r["q_no"]), {})
        parts.append(
            f"<section id='q{r['q_no']}'>"
            f"<div><h2>Q{r['q_no']} — page {r['source_page']}</h2>"
            f"<img class='crop' src='data:image/png;base64,{b64}'></div>"
            f"<div><p class='meta'>tier {html.escape(r['tier'])} · "
            f"format {html.escape(r['format'])} · figures "
            f"{html.escape(', '.join(r['figure_keys']) or 'none')} · "
            f"confidence {r['extraction_confidence']} · "
            f"solve_match {verdict.get('solve_match')}</p>"
            f"<pre>{html.escape(r['body'] or '')}</pre>"
            f"<ol>{opts}</ol>"
            f"<p class='meta'>answer key: {html.escape(str(r['answer_value']))}</p></div>"
            f"</section>")
    return "\n".join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--score", action="store_true",
                    help="score out/gold_corrections.json instead of drawing")
    args = ap.parse_args()

    sb = p.supabase_client()
    skeleton = {str(r["q_no"]): r for r in p.load_skeleton()
                if r["chapter_no"] == p.CHAPTER_5}
    solve = json.loads((p.OUT / "solve_verify.json").read_text(
        encoding="utf-8"))["verdicts"]

    ch5_id = sb.table("pyq_chapters").select("id").eq(
        "chapter_no", p.CHAPTER_5).execute().data[0]["id"]
    qrows = sb.table("pyq_questions").select(
        "id,q_no,body,tier,format,source_page,extraction_confidence").eq(
        "chapter_id", ch5_id).execute().data
    opts = sb.table("pyq_question_options").select(
        "question_id,option_index,body").execute().data
    by_q = {}
    for o in opts:
        by_q.setdefault(o["question_id"], []).append(o)

    rows = []
    for q in qrows:
        rec = skeleton[str(q["q_no"])]
        rows.append({**q,
                     "options": [o["body"] for o in sorted(
                         by_q.get(q["id"], []), key=lambda o: o["option_index"])] or None,
                     "figure_keys": rec["figure_keys"],
                     "answer_value": rec["answer_value"]})

    if not args.score:
        picked, plan = draw(rows)
        (p.OUT / "gold_sample.json").write_text(json.dumps(
            {"seed": SEED, "target": TARGET, "drawn": len(picked), "strata": plan,
             "q_nos": [r["q_no"] for r in picked]}, indent=2), encoding="utf-8")
        (p.OUT / "gold_sample.html").write_text(render_html(picked, solve),
                                                encoding="utf-8")
        if not (p.OUT / "gold_corrections.json").exists():
            (p.OUT / "gold_corrections.json").write_text("{}", encoding="utf-8")
        print(f"drawn : {len(picked)} of {len(rows)}")
        print("strata (tier, has_figure, format) -> in_chapter / sampled")
        for cell, v in plan.items():
            print(f"  {cell} -> {v['in_chapter']} / {v['sampled']}")
        print("open out/gold_sample.html, then re-run with --score")
        return

    drawn = json.loads((p.OUT / "gold_sample.json").read_text(encoding="utf-8"))
    corrections = json.loads((p.OUT / "gold_corrections.json").read_text(
        encoding="utf-8"))
    sampled = drawn["q_nos"]
    n = len(sampled)
    ans_bad = sum(1 for q in sampled
                  if corrections.get(str(q), {}).get("answer_affecting") is True)
    dis_bad = sum(1 for q in sampled
                  if str(q) in corrections
                  and corrections[str(q)].get("answer_affecting") is False)

    a_rate, a_lo, a_hi = wilson(n - ans_bad, n)
    d_rate, d_lo, d_hi = wilson(n - dis_bad, n)

    report = [
        "# Phase 8 — accuracy report",
        "",
        f"Sample: {n} of 132 Laws of Motion questions, stratified by tier, figure "
        f"presence and format. Seed {drawn['seed']}. Every character of every sampled "
        "question was checked against the page image by a human.",
        "",
        "**This is the only accuracy number anyone may quote.** It covers one chapter "
        "of one subject, extracted by one model pair. It does not generalise to the "
        "other 31 chapters.",
        "",
        "| Measure | Correct | n | Rate | 95% CI (Wilson) |",
        "|---|---:|---:|---:|---|",
        f"| Answer-affecting content (stem + correct option) | {n - ans_bad} | {n} | "
        f"{a_rate:.1%} | {a_lo:.1%} – {a_hi:.1%} |",
        f"| Distractor content (the three wrong options) | {n - dis_bad} | {n} | "
        f"{d_rate:.1%} | {d_lo:.1%} – {d_hi:.1%} |",
        "",
        "## Corrections recorded",
        "",
    ]
    if corrections:
        report.append("| q_no | answer-affecting | note |")
        report.append("|---:|---|---|")
        for q_no, c in sorted(corrections.items(), key=lambda kv: int(kv[0])):
            report.append(f"| {q_no} | {c.get('answer_affecting')} | "
                          f"{c.get('note', '').replace('|', '/')} |")
    else:
        report.append("None. Every sampled question matched the print exactly.")
    report += [
        "",
        "## Why two rates",
        "",
        "Phase 7 solve-verify only exercises the answer path, so it is blind to the "
        "339 distractor strings in this chapter. The distractor rate is the only "
        "evidence about them.",
        "",
    ]
    (p.OUT / "accuracy_report.md").write_text("\n".join(report), encoding="utf-8")
    print(f"n {n} · answer-affecting errors {ans_bad} · distractor-only errors {dis_bad}")
    print(f"answer-affecting {a_rate:.1%} (95% CI {a_lo:.1%}-{a_hi:.1%})")
    print(f"distractor       {d_rate:.1%} (95% CI {d_lo:.1%}-{d_hi:.1%})")
    print("written out/accuracy_report.md")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Draw the sample**

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe gold_sample.py
```

Expected: `drawn : ~30 of 132`, then the realised strata table, then the instruction to open the HTML. The floor-of-one rule can push the total slightly above 30; that is fine and the report states the realised `n`.

- [ ] **Step 3: Human verification**

Open `out/gold_sample.html` in a browser. For each question, compare the rendered body, all four options, the figure placeholders and the answer-key value against the page image on the left, character by character. Record every error in `out/gold_corrections.json`:

```json
{
  "42": { "answer_affecting": true,  "note": "stem reads 5 kg, print says 5 g" },
  "77": { "answer_affecting": false, "note": "option 3 lost a square root" }
}
```

`answer_affecting: true` means the error is in the stem or the correct option — it could change what a student answers. `false` means it is only in a distractor. A question with no entry counts as correct. Do not skip a question because it "looks fine"; the point of this task is that someone actually looked.

- [ ] **Step 4: Score it**

```powershell
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe gold_sample.py --score
```

Expected: two rates with Wilson 95% intervals, and `out/accuracy_report.md` written.

- [ ] **Step 5: Acceptance gate**

From `CURSOR_PLAN.md`: the gate is not a threshold — it is that **this number exists and is the only one anyone may quote**. It passes when:

- `out/gold_sample.html` exists and every sampled question was reviewed by a human
- `out/accuracy_report.md` reports both rates with 95% Wilson intervals and the realised `n`
- The report says in as many words that it covers one chapter and does not generalise
- `plan.html`'s ~99% / 97–98% / "0 diagrams missed" appear nowhere in it

- [ ] **Step 6: Append to `PROGRESS.md`**

Append `## Phase 8 — Gold sample · PASS|FAIL` with: realised `n` and the strata table, both rates with their intervals, the full corrections list, who did the verification and roughly how long it took, and `Cost: ₹0 (human time only)`.

---

### Task 9: Phase 9 — review queue, promotion, and publish

**Files:**
- Create: `files/review_queue.py`
- Create: `files/apply_review.py`
- Create: `files/out/review_queue.html` (generated)
- Modify: `files/PROGRESS.md` (append)

**Interfaces:**
- Consumes: `out/diff_report.json` (Task 6), `out/solve_verify.json` (Task 7), `pyq_questions.extraction_confidence` (Task 6)
- Produces:
  - `out/review_queue.json` — ranked, riskiest first
  - `out/review_queue.html` — page crop left, extraction right, one editable block per question
  - `out/review_decisions.json` — filled in by the human
  - Final `review_status`: `auto_ok`, `flagged`, or `human_ok`

**Cost: ₹0.**

**The promotion rule.** Neither `CURSOR_PLAN.md` nor the spec defines when a question becomes `auto_ok`, and without it nothing is ever publishable. Defined here:

| Condition | `review_status` |
|---|---|
| Both passes agree (`extraction_confidence = 1.0`) **and** `solve_match = true` | `auto_ok` |
| Anything else — passes differ, `solve_match = false`, or confidence `< 1.0` | `flagged`, and into the queue |

Queue membership is therefore exactly `CURSOR_PLAN.md`'s three sources: two-model disagreement, `solve_match = false`, low confidence.

**Ranking, riskiest first**, per `CURSOR_PLAN.md`: figures first, then match-lists, then LaTeX token density. Match-list detection is a ranking heuristic on the extracted body (`List I` / `List II` / `Column I`), never a database write — `format` stays derived from the answer key per D8.

`CURSOR_PLAN.md` asks for a "minimal review UI". Per D11 that is a generated local HTML file plus a decisions JSON, not a Web app route — app work belongs to the sibling plan.

- [ ] **Step 1: Write `review_queue.py`**

Create `files/review_queue.py`:

```python
#!/usr/bin/env python3
"""Phase 9 - promote the clean questions, queue the rest, riskiest first."""
import base64
import html
import json
import re

import pyq_common as p

MATCH_LIST_RE = re.compile(r"List\s*[-–]?\s*I\b|Column\s*[-–]?\s*I\b", re.I)
LATEX_TOKEN_RE = re.compile(r"\\[a-zA-Z]+|[\^_{}]|\$")
FIG_RE = re.compile(r"\[\[fig:([^\]]+)\]\]")


def risk_key(row):
    """Sort key: figures first, then match-lists, then LaTeX density. Descending."""
    blob = json.dumps([row["body"], row["options"]], ensure_ascii=False)
    return (
        -len(FIG_RE.findall(blob)),
        0 if MATCH_LIST_RE.search(blob) else 1,
        -len(LATEX_TOKEN_RE.findall(blob)),
        row["q_no"],
    )


def render_html(queue):
    parts = ["<!doctype html><meta charset='utf-8'>",
             "<title>Phase 9 review queue</title>",
             "<style>body{font:14px/1.5 system-ui;margin:24px;max-width:1400px}"
             "section{border-top:2px solid #999;padding:18px 0;display:grid;"
             "grid-template-columns:1fr 1fr;gap:24px}"
             "img.crop{width:100%;border:1px solid #ccc}"
             "textarea{width:100%;min-height:120px;font:13px ui-monospace}"
             ".why{color:#a00;font-size:12px}</style>",
             "<h1>Phase 9 review queue</h1>",
             "<p>Riskiest first. For each question either approve it as transcribed or "
             "paste a corrected body and options into "
             "<code>out/review_decisions.json</code>:</p>"
             "<pre>{\"12\": {\"action\": \"approve\"},\n"
             " \"47\": {\"action\": \"fix\", \"body\": \"...\", "
             "\"options\": [\"...\",\"...\",\"...\",\"...\"]}}</pre>"]
    for row in queue:
        raster = p.OUT / "pages" / f"page_{row['source_page']:03d}.png"
        b64 = base64.b64encode(raster.read_bytes()).decode()
        opts = "".join(f"<li>{html.escape(o or '')}</li>" for o in (row["options"] or []))
        parts.append(
            f"<section id='q{row['q_no']}'>"
            f"<div><h2>Q{row['q_no']} — page {row['source_page']}</h2>"
            f"<img class='crop' src='data:image/png;base64,{b64}'></div>"
            f"<div><p class='why'>{html.escape(', '.join(row['reasons']))}</p>"
            f"<textarea>{html.escape(row['body'] or '')}</textarea>"
            f"<ol>{opts}</ol>"
            f"<p>answer key: {html.escape(str(row['expected']))} · "
            f"model said: {html.escape(str(row['model_answer']))}</p></div>"
            f"</section>")
    return "\n".join(parts)


def main():
    sb = p.supabase_client()
    diff = json.loads((p.OUT / "diff_report.json").read_text(encoding="utf-8"))
    solve = json.loads((p.OUT / "solve_verify.json").read_text(
        encoding="utf-8"))["verdicts"]

    ch5_id = sb.table("pyq_chapters").select("id").eq(
        "chapter_no", p.CHAPTER_5).execute().data[0]["id"]
    qrows = sb.table("pyq_questions").select(
        "id,q_no,body,source_page,extraction_confidence").eq(
        "chapter_id", ch5_id).execute().data
    opts = sb.table("pyq_question_options").select(
        "question_id,option_index,body").execute().data
    by_q = {}
    for o in opts:
        by_q.setdefault(o["question_id"], []).append(o)

    queue, auto_ok = [], []
    for q in qrows:
        q_no = str(q["q_no"])
        reasons = []
        if diff.get(q_no, {}).get("verdict") == "differ":
            reasons.append("two-model disagreement: "
                           + ", ".join(diff[q_no]["fields"]))
        if not solve.get(q_no, {}).get("solve_match", False):
            reasons.append("solve_match false")
        if (q["extraction_confidence"] or 0.0) < 1.0:
            reasons.append(f"confidence {q['extraction_confidence']}")

        if not reasons:
            auto_ok.append(q["id"])
            continue
        queue.append({
            "q_no": q["q_no"], "id": q["id"], "source_page": q["source_page"],
            "body": q["body"],
            "options": [o["body"] for o in sorted(
                by_q.get(q["id"], []), key=lambda o: o["option_index"])] or None,
            "reasons": reasons,
            "expected": solve.get(q_no, {}).get("expected"),
            "model_answer": solve.get(q_no, {}).get("model_answer"),
        })

    queue.sort(key=risk_key)

    for i in range(0, len(auto_ok), 100):
        for qid in auto_ok[i:i + 100]:
            sb.table("pyq_questions").update(
                {"review_status": "auto_ok"}).eq("id", qid).execute()
    for row in queue:
        sb.table("pyq_questions").update(
            {"review_status": "flagged"}).eq("id", row["id"]).execute()

    (p.OUT / "review_queue.json").write_text(
        json.dumps(queue, ensure_ascii=False, indent=1), encoding="utf-8")
    (p.OUT / "review_queue.html").write_text(render_html(queue), encoding="utf-8")
    if not (p.OUT / "review_decisions.json").exists():
        (p.OUT / "review_decisions.json").write_text("{}", encoding="utf-8")

    print(f"auto_ok : {len(auto_ok)}")
    print(f"flagged : {len(queue)}")
    print(f"top of queue : {[r['q_no'] for r in queue[:10]]}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Build the queue**

```powershell
Set-Location "c:\Users\tempo\Downloads\files"
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe review_queue.py
```

Expected: `auto_ok` plus `flagged` sums to 132, and the top of the queue is dominated by questions with figures. The spec expects 10–15% two-model disagreement, so a queue of roughly 20–45 is normal once `solve_match` failures are folded in. `CURSOR_PLAN.md`'s "300–1,200 items" was sized for 4,115 questions.

- [ ] **Step 3: Write `apply_review.py`**

Create `files/apply_review.py`:

```python
#!/usr/bin/env python3
"""Phase 9 - apply human review decisions and set review_status = 'human_ok'."""
import json

import pyq_common as p


def main():
    sb = p.supabase_client()
    queue = {str(r["q_no"]): r for r in json.loads(
        (p.OUT / "review_queue.json").read_text(encoding="utf-8"))}
    decisions = json.loads((p.OUT / "review_decisions.json").read_text(
        encoding="utf-8"))

    unknown = [q for q in decisions if q not in queue]
    if unknown:
        raise SystemExit(f"decisions reference questions not in the queue: {unknown}")

    approved, fixed = 0, 0
    for q_no, decision in decisions.items():
        row = queue[q_no]
        action = decision.get("action")
        if action == "fix":
            if "body" in decision:
                sb.table("pyq_questions").update(
                    {"body": decision["body"]}).eq("id", row["id"]).execute()
            for i, text in enumerate(decision.get("options") or [], start=1):
                sb.table("pyq_question_options").upsert(
                    {"question_id": row["id"], "option_index": i, "body": text},
                    on_conflict="question_id,option_index").execute()
            fixed += 1
        elif action == "approve":
            approved += 1
        else:
            raise SystemExit(f"q_no {q_no}: action must be 'approve' or 'fix'")
        sb.table("pyq_questions").update(
            {"review_status": "human_ok"}).eq("id", row["id"]).execute()

    remaining = [q for q in queue if q not in decisions]
    print(f"approved : {approved}")
    print(f"fixed    : {fixed}")
    print(f"human_ok : {approved + fixed}")
    print(f"still flagged : {len(remaining)} -> {sorted(int(x) for x in remaining)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Human review, then apply**

Open `out/review_queue.html`, work top to bottom, and fill `out/review_decisions.json`. Then:

```powershell
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe apply_review.py
```

Expected: `human_ok` equals the number of decisions recorded, and `still flagged` lists whatever was consciously deferred.

- [ ] **Step 5: Acceptance gate — publish only `auto_ok` / `human_ok`**

From `CURSOR_PLAN.md`: the queue must be **empty or consciously deferred**, and only `auto_ok` / `human_ok` rows publish.

```sql
select review_status, count(*) from pyq_questions q
join pyq_chapters c on c.id = q.chapter_id
where c.chapter_no = 5 group by review_status order by review_status;

select count(*) as publishable, count(body) as with_body
from pyq_questions q join pyq_chapters c on c.id = q.chapter_id
where c.chapter_no = 5 and q.review_status in ('auto_ok', 'human_ok');

select count(*) as publishable_without_body
from pyq_questions q join pyq_chapters c on c.id = q.chapter_id
where c.chapter_no = 5 and q.review_status in ('auto_ok', 'human_ok')
  and (q.body is null or length(trim(q.body)) = 0);

select count(*) as publishable_mcq_missing_options
from pyq_questions q join pyq_chapters c on c.id = q.chapter_id
where c.chapter_no = 5 and q.review_status in ('auto_ok', 'human_ok')
  and q.format = 'mcq'
  and (select count(*) from pyq_question_options o where o.question_id = q.id) <> 4;

select delta, publishable, skeleton_only from v_pyq_ingestion_check where chapter_no = 5;
```

Expected: no `skeleton_only` and no `unreviewed` rows remain for chapter 5; every `flagged` row is listed as consciously deferred in `PROGRESS.md`; `publishable_without_body = 0`; `publishable_mcq_missing_options = 0`; `delta = 0`.

- [ ] **Step 6: Verify the publishing gate actually holds for a student**

The RLS policy from Task 1 is the gate. Prove it with the anon key rather than trusting it:

```powershell
$env:PYTHONUTF8 = "1"
C:\Python314\python.exe -c "import httpx, pyq_common as p; w=[l for l in open(r'c:\Users\tempo\Downloads\EduBlast\Web\.env',encoding='utf-8')]; url=[l for l in w if l.startswith('NEXT_PUBLIC_SUPABASE_URL=')][0].split('=',1)[1].strip(); anon=[l for l in w if l.startswith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')][0].split('=',1)[1].strip(); r=httpx.get(url+'/rest/v1/pyq_questions', params={'select':'q_no,review_status','limit':'500'}, headers={'apikey':anon,'Authorization':'Bearer '+anon}, timeout=60); print(r.status_code); rows=r.json() if r.status_code==200 else r.text; print(len(rows) if isinstance(rows,list) else rows); print(sorted({x['review_status'] for x in rows}) if isinstance(rows,list) else '')"
```

Expected: an empty list or a permission error — the anon role is not `authenticated`, so it should see nothing. Any row returned with `review_status` outside `auto_ok` / `human_ok` is a gate failure: fix the policy before publishing.

- [ ] **Step 7: Record the count the app will show**

The sibling app plan replaces `CHAPTER_PYQ_QUESTION_COUNT = 0` in `Web/lib/chapter-pyq/catalog.ts` with a live count. Give it the number and the query:

```sql
select c.catalog_slug, count(*) as publishable
from pyq_questions q join pyq_chapters c on c.id = q.chapter_id
where q.review_status in ('auto_ok', 'human_ok')
group by c.catalog_slug order by c.catalog_slug;
```

Expected: one row, `laws-of-motion`, with the publishable count. Write that number into `PROGRESS.md` so the app task can assert against it.

- [ ] **Step 8: Append to `PROGRESS.md`**

Append `## Phase 9 — Review queue and publish · PASS|FAIL` with: the promotion rule as applied, the auto_ok / flagged / human_ok split, the queue's top ten and why each was ranked there, every consciously deferred question with its reason, the anon-key gate result, the final publishable count per `catalog_slug`, and `Cost: ₹0`.

- [ ] **Step 9: Commit (only if the user asked)** — the only repo file this plan creates is the Task 1 migration. The Python scripts live in `c:\Users\tempo\Downloads\files\`, outside the repo.

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| `pyq_questions.body` becomes nullable | 1 |
| `skeleton_only` joins the documented `review_status` values | 1 |
| `pyq_chapters.catalog_slug`, deliberately not unique | 1 |
| `schema.sql`'s invalid `primary key (… coalesce(option_id, …))` replaced by a unique expression index | 1 (D4) |
| Migration in `Web/supabase/migrations/`, `YYYYMMDDHHMMSS_description.sql` | 1 |
| Applied to the Web Supabase project | 1 |
| Seed `subjects` / `units` / `chapters` / `topics` from `skeleton.json` | 1 |
| `chapters.expected_question_count` from `answer_key.json` | 1 |
| `catalog_slug` per the spec's 32-row mapping table | 1 |
| Chapter 17 deferred, no routing | 1 (`catalog_slug` null) |
| Merge rule — several PDF chapters share one slug | 1 (gate asserts 2 and 3) |
| SHA-256 figure dedupe | 2 |
| Ten file groups vs an eleventh manifest-row group; loop tolerates the repeat | 2 |
| Upload to `pyq/physics/figures/`, object name = `figure_key`, idempotent | 2 |
| All 4,115 skeleton rows, `body = null`, `review_status = 'skeleton_only'` | 2 |
| `v_pyq_ingestion_check` delta 0 for Laws of Motion and every chapter | 2 |
| Never base64 an image into Postgres | 2 (storage path only) |
| Orphans and dates, chapter pages only, deterministic, no AI | 3 |
| Orphan rule `y < 60`, previous page, same column | 3 |
| Missing-date rule, top of the next page's matching column | 3 |
| 5 questions with null `exam_date` in the pilot chapter | 3 |
| `manual_review.json` for anything unresolved | 3 |
| Bake-off on ~6 pages, not 20 | 4 |
| One figure-heavy and one math-dense Laws of Motion page | 4 (pages 57 and 58) |
| Candidates per the original plan | 4 |
| `bakeoff_results.md` | 4 |
| Gate: leader ≥ 90% LaTeX; stop if nothing clears 80% | 4 |
| Never run layout detection on this PDF | 4–6 (page rasters + skeleton slice only) |
| 14 Laws of Motion pages via Sarvam, `temperature = 0`, `response_format = json` | 5 |
| Concurrency 8, 60 requests/minute | 5 (`RateLimiter`, `ThreadPoolExecutor`) |
| Prompt carries the skeleton slice: `q_no`, `figure_keys`, tier, topic, dates | 5 |
| Markdown + inline LaTeX, four options or numerical, `[[fig:KEY]]` | 5 |
| Output to `out/extracted/pass1/` | 5 |
| Gate: every page's `q_no` set matches the skeleton exactly | 5 |
| Whitelist enforcement at the parser, retry the page | 5 (`validate_page_response`) |
| Retries escalate to a different model | 5 (`--models` ladder), 6 |
| Second observer, different model, `out/extracted/pass2/` | 6 |
| LaTeX normalised before diffing (`\dfrac`→`\frac`, `\left(`→`(`) | 6 (`normalise_latex`) |
| `diff_report.json` marking agree or differ | 6 |
| Expect 10–15% disagreement | 6 |
| Skeleton immutable — models fill `body` and `options` only | 2, 6 (`format`, answers and links come from the skeleton) |
| Solve-verify: stem, options, figure images; answer only | 7 |
| Compare to `answer_value`, set `solve_match` | 7 |
| Blind spot documented: answer path only, not distractor corruption | 7 |
| Gold sample, ~30 of 132, stratified by tier / figure / format | 8 |
| Human-verifiable artifact | 8 (`gold_sample.html`) |
| `accuracy_report.md` with a 95% confidence interval | 8 (Wilson) |
| The only accuracy number anyone may quote | 8 |
| Review queue from disagreement, `solve_match = false`, low confidence | 9 |
| Rank figures, then match-lists, then LaTeX density | 9 (`risk_key`) |
| On approval set `review_status = 'human_ok'` | 9 (`apply_review.py`) |
| Publish only `auto_ok` / `human_ok` | 9 (gate + RLS policy from Task 1) |
| Students see only `auto_ok` / `human_ok` | 1 (RLS), 9 (anon-key proof) |
| Every task appends to `PROGRESS.md` | 1–9, final step of each |
| Cost note where a phase spends money | Cost table; Tasks 4–7 |
| Phases 2 and 3 are ₹0; pilot total near ₹25–30 | Cost table (~₹29) |
| Scripts live in `c:\Users\tempo\Downloads\files\` with exact invocations | Every task |
| PowerShell — `&&` is not a separator | Global Constraints; every command block |
| `pymupdf==1.26.3` pinned | Global Constraints; Task 3 is the only task that opens the PDF |
| Web only; app UI is the sibling plan | Global Constraints; Task 9 Step 7 hands over the count |

## Placeholder scan

No TBD steps, no "add error handling", no "similar to Task N". Every code step carries its complete code and every command carries its expected output.

Four values are deliberately measured rather than asserted, and each one has a command that produces it plus a stated pass condition — they are outputs, not placeholders:

- The Task 4 model ids and endpoint, which Step 1 probes from Sarvam's live model list before any spend.
- The bake-off LaTeX correctness scores, which a human counts over the 6 pages, gated at ≥ 90% with a hard stop below 80%.
- The Task 6 agree / differ split, gated on full coverage of 132 questions with 10–15% as the expected range.
- The Task 7 match rate, the Task 8 accuracy rates and the Task 9 queue size, which are the findings the pipeline exists to produce. Task 8's is the only one quotable.

Cross-checks run: the schema name map matches every table reference in Tasks 1–9; `pyq_common` helper names match their call sites (`load_skeleton`, `supabase_client`, `normalise_latex`, `validate_page_response`, `RateLimiter`, `call_sarvam`, `call_gemini`, `CATALOG_SLUG`, `CHAPTER_5`, `CHAPTER_5_PAGES`, `FIGURE_PREFIX`, `BUCKET`, `PDF_PATH`, `OUT`, `sha256_file`, `load_env`, `load_answer_key`, `load_figures_manifest`); `SYSTEM_PROMPT`, `page_slice`, `user_prompt`, `page_image_b64` and `content_of` are defined once in `bakeoff.py` and imported by `extract_pass.py`; the 14-page figure is consistent in the Task 5 heading, `CHAPTER_5_PAGES`, and the expected stdout; the 63-figure count is consistent across Tasks 2, 6 and 9; and no task contradicts a Global Constraint — Task 3 is the only task that opens the PDF and it is the only one that needs the `pymupdf` pin, no task writes an image into Postgres, no task re-runs the same model as its own retry, and the only accuracy claim in the whole plan is Task 8's.
