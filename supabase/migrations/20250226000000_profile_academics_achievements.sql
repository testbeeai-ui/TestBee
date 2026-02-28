-- Profile academics (exam records) and achievements (competitions).
-- Users can add their own academic records and achievements for public profile display.

CREATE TABLE IF NOT EXISTS public.profile_academics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exam text NOT NULL,
  board text NOT NULL DEFAULT '',
  score text NOT NULL DEFAULT '',
  verified text NOT NULL DEFAULT 'unverified' CHECK (verified IN ('verified', 'pending', 'unverified')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_academics_user_id ON public.profile_academics(user_id);

CREATE TABLE IF NOT EXISTS public.profile_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text NOT NULL CHECK (level IN ('School', 'District', 'State', 'National', 'International')),
  year integer NOT NULL,
  result text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_achievements_user_id ON public.profile_achievements(user_id);

ALTER TABLE public.profile_academics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_achievements ENABLE ROW LEVEL SECURITY;

-- Academics: public read for profile display; users can write their own
DROP POLICY IF EXISTS "Public read profile_academics" ON public.profile_academics;
CREATE POLICY "Public read profile_academics"
  ON public.profile_academics FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile_academics" ON public.profile_academics;
CREATE POLICY "Users can insert own profile_academics"
  ON public.profile_academics FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile_academics" ON public.profile_academics;
CREATE POLICY "Users can update own profile_academics"
  ON public.profile_academics FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profile_academics" ON public.profile_academics;
CREATE POLICY "Users can delete own profile_academics"
  ON public.profile_academics FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Achievements: public read for profile display; users can write their own
DROP POLICY IF EXISTS "Public read profile_achievements" ON public.profile_achievements;
CREATE POLICY "Public read profile_achievements"
  ON public.profile_achievements FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile_achievements" ON public.profile_achievements;
CREATE POLICY "Users can insert own profile_achievements"
  ON public.profile_achievements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile_achievements" ON public.profile_achievements;
CREATE POLICY "Users can update own profile_achievements"
  ON public.profile_achievements FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profile_achievements" ON public.profile_achievements;
CREATE POLICY "Users can delete own profile_achievements"
  ON public.profile_achievements FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.profile_academics IS 'Academic exam records (Class 10, 12, etc.) for public profile.';
COMMENT ON TABLE public.profile_achievements IS 'Achievements and competitions for public profile.';
