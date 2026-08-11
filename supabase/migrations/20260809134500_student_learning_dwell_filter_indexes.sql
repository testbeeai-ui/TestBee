-- Restore filter indexes on the single student_learning_dwell table for multi-user scale.

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_user_occurred
  ON public.student_learning_dwell (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_user_scope
  ON public.student_learning_dwell (user_id, board, subject, class_level, topic, subtopic_name, level);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_content_time
  ON public.student_learning_dwell (subject, topic, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_occurred_at
  ON public.student_learning_dwell (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_panel_time
  ON public.student_learning_dwell (panel, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_tags_gin
  ON public.student_learning_dwell USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_meta_gin
  ON public.student_learning_dwell USING gin (meta jsonb_path_ops);

ANALYZE public.student_learning_dwell;
