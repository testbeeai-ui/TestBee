-- Harden student_learning_dwell_events as the single public write/read surface.
-- Monthly child partitions remain an internal storage detail for scale.
-- Adds tags/meta + filter indexes; prunes empty out-of-window partition shells.

-- Flexible filter tags (GIN) + structured meta for analytics.
ALTER TABLE public.student_learning_dwell_events
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.student_learning_dwell_events
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.student_learning_dwell_events.tags IS
  'Searchable tags for filtering at scale, e.g. subject:physics, class:12, panel:theory.';

COMMENT ON COLUMN public.student_learning_dwell_events.meta IS
  'Optional structured analytics payload (session hints, client flags).';

COMMENT ON TABLE public.student_learning_dwell_events IS
  'Active learning dwell samples (one logical table). Filtered by user/time/content/tags. Monthly RANGE partitions are internal storage only — always query this parent.';

-- Content + time filter path (admin insights, subject dashboards).
CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_content_time
  ON public.student_learning_dwell_events (subject, topic, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_occurred_at
  ON public.student_learning_dwell_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_panel_time
  ON public.student_learning_dwell_events (panel, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_tags_gin
  ON public.student_learning_dwell_events USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_meta_gin
  ON public.student_learning_dwell_events USING gin (meta jsonb_path_ops);

-- Backfill tags for existing rows (idempotent).
UPDATE public.student_learning_dwell_events
SET tags = ARRAY[
  lower(board),
  lower(subject),
  'class-' || class_level::text,
  lower(level),
  lower(panel),
  'topic:' || left(lower(topic), 80),
  'subtopic:' || left(lower(subtopic_name), 80)
]
WHERE tags = '{}'::text[] OR cardinality(tags) = 0;

-- Keep current/next month partitions; drop empty shells outside a tight rolling window.
-- Non-empty historical months (e.g. May–Jul) are never dropped.
SELECT public.prune_empty_dwell_partitions(1, 2);
