-- Play: adaptive gamified learning (Academic + Funbrain).
-- Tables: play_questions, user_play_stats, play_history, daily_gauntlet_attempts.

CREATE TABLE IF NOT EXISTS public.play_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain IN ('academic', 'funbrain')),
  category text NOT NULL,
  difficulty_rating integer NOT NULL DEFAULT 1000,
  content jsonb NOT NULL DEFAULT '{}',
  options jsonb NOT NULL DEFAULT '[]',
  correct_answer_index integer NOT NULL,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_play_questions_domain_category ON public.play_questions(domain, category);
CREATE INDEX IF NOT EXISTS idx_play_questions_domain_category_rating ON public.play_questions(domain, category, difficulty_rating);

CREATE TABLE IF NOT EXISTS public.user_play_stats (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  current_rating integer NOT NULL DEFAULT 1000,
  questions_answered integer NOT NULL DEFAULT 0,
  win_streak integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_user_play_stats_user_id ON public.user_play_stats(user_id);

CREATE TABLE IF NOT EXISTS public.play_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.play_questions(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL,
  time_taken_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_play_history_user_question ON public.play_history(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_play_history_user_created ON public.play_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.daily_gauntlet_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gauntlet_date date NOT NULL,
  total_time_ms integer NOT NULL,
  correct_count integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, gauntlet_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_gauntlet_date_time ON public.daily_gauntlet_attempts(gauntlet_date, total_time_ms);

ALTER TABLE public.play_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_play_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_gauntlet_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read play_questions" ON public.play_questions;
CREATE POLICY "Authenticated can read play_questions"
  ON public.play_questions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users manage own user_play_stats" ON public.user_play_stats;
CREATE POLICY "Users manage own user_play_stats"
  ON public.user_play_stats FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert select own play_history" ON public.play_history;
CREATE POLICY "Users insert select own play_history"
  ON public.play_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users select own play_history"
  ON public.play_history FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own daily_gauntlet_attempts" ON public.daily_gauntlet_attempts;
CREATE POLICY "Users insert own daily_gauntlet_attempts"
  ON public.daily_gauntlet_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Authenticated can read daily_gauntlet_attempts" ON public.daily_gauntlet_attempts;
CREATE POLICY "Authenticated can read daily_gauntlet_attempts"
  ON public.daily_gauntlet_attempts FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.play_questions IS 'Play questions: academic and funbrain; difficulty_rating is Elo-style 100-3000.';
COMMENT ON TABLE public.user_play_stats IS 'Per-user per-category rating and streak for adaptive play.';
COMMENT ON TABLE public.play_history IS 'Answer history; used to exclude correct repeats and update rating.';
COMMENT ON TABLE public.daily_gauntlet_attempts IS 'One attempt per user per day for Daily Gauntlet leaderboard.';
