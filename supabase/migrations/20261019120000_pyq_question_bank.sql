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
-- security_invoker so the view does not bypass RLS on pyq_questions.

create or replace view v_pyq_ingestion_check
with (security_invoker = true) as
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
