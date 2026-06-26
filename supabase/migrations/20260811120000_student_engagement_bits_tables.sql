-- Normalized per-row storage for subtopic engagement and bits attempts (Phase 2).
-- Routes read table first; profiles JSONB remains fallback until backfill.

CREATE TABLE IF NOT EXISTS public.student_subtopic_engagement (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, storage_key)
);

CREATE INDEX IF NOT EXISTS idx_student_subtopic_engagement_user_updated
  ON public.student_subtopic_engagement (user_id, updated_at DESC);

ALTER TABLE public.student_subtopic_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own subtopic engagement rows"
  ON public.student_subtopic_engagement FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subtopic engagement rows"
  ON public.student_subtopic_engagement FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own subtopic engagement rows"
  ON public.student_subtopic_engagement FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own subtopic engagement rows"
  ON public.student_subtopic_engagement FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.student_bits_attempts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_key text NOT NULL,
  attempt jsonb NOT NULL,
  submitted_at timestamptz,
  PRIMARY KEY (user_id, attempt_key)
);

CREATE INDEX IF NOT EXISTS idx_student_bits_attempts_user_submitted
  ON public.student_bits_attempts (user_id, submitted_at DESC NULLS LAST);

ALTER TABLE public.student_bits_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own bits attempt rows"
  ON public.student_bits_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own bits attempt rows"
  ON public.student_bits_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own bits attempt rows"
  ON public.student_bits_attempts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own bits attempt rows"
  ON public.student_bits_attempts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
