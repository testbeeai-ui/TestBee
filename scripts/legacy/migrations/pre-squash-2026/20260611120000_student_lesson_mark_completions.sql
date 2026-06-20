-- Durable Lessons/Progress "Mark as complete" for rollups (advanced level synced from API).
-- Complements profiles.subtopic_engagement JSON (which is capped to 300 keys).

CREATE TABLE public.student_lesson_mark_completions (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  board text NOT NULL,
  subject text NOT NULL CHECK (lower(trim(subject)) = ANY (ARRAY['physics', 'chemistry', 'math'])),
  class_level smallint NOT NULL CHECK (class_level IN (11, 12)),
  topic text NOT NULL,
  subtopic text NOT NULL,
  level text NOT NULL CHECK (level = ANY (ARRAY['basics', 'intermediate', 'advanced'])),
  marked_complete_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, board, subject, class_level, topic, subtopic, level)
);

CREATE INDEX student_lesson_mark_completions_user_subject_class_idx
  ON public.student_lesson_mark_completions (user_id, subject, class_level);

CREATE INDEX student_lesson_mark_completions_user_board_subject_class_idx
  ON public.student_lesson_mark_completions (user_id, board, subject, class_level);

COMMENT ON TABLE public.student_lesson_mark_completions IS
  'Per-user lesson checklist completion (lessonChecklistMarkedCompleteAt). Advanced rows are written from /api/user/subtopic-engagement; used for chapter/topic rollups and UI ticks.';

ALTER TABLE public.student_lesson_mark_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_lesson_mark_completions_select_own"
  ON public.student_lesson_mark_completions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "student_lesson_mark_completions_insert_own"
  ON public.student_lesson_mark_completions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "student_lesson_mark_completions_update_own"
  ON public.student_lesson_mark_completions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "student_lesson_mark_completions_delete_own"
  ON public.student_lesson_mark_completions
  FOR DELETE
  USING (auth.uid() = user_id);
