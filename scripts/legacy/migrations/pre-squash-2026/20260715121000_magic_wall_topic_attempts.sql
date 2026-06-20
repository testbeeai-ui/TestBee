-- Tracks monthly Magic Wall topic-pick attempts per user.
-- Used for Free/Free Trial/Starter plan limits.

CREATE TABLE IF NOT EXISTS public.magic_wall_topic_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_wall_topic_attempts_user_time
  ON public.magic_wall_topic_attempts (user_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_magic_wall_topic_attempts_user_topic
  ON public.magic_wall_topic_attempts (user_id, topic_key);

ALTER TABLE public.magic_wall_topic_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS magic_wall_topic_attempts_select_own ON public.magic_wall_topic_attempts;
CREATE POLICY magic_wall_topic_attempts_select_own
  ON public.magic_wall_topic_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS magic_wall_topic_attempts_insert_own ON public.magic_wall_topic_attempts;
CREATE POLICY magic_wall_topic_attempts_insert_own
  ON public.magic_wall_topic_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

