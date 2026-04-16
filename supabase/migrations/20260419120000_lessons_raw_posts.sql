-- Lessons raw social feed: user-generated updates independent from Gyan++ doubts.

CREATE TABLE IF NOT EXISTS public.lessons_raw_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('post', 'doubt', 'instacue')),
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  subject text,
  chapter_ref text,
  boost_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lessons_raw_posts_content_len CHECK (char_length(content) BETWEEN 3 AND 2000)
);

CREATE TABLE IF NOT EXISTS public.lessons_raw_post_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.lessons_raw_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lessons_raw_post_boosts_unique UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lessons_raw_posts_created_at
  ON public.lessons_raw_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lessons_raw_posts_user_created
  ON public.lessons_raw_posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lessons_raw_posts_tags_gin
  ON public.lessons_raw_posts USING gin(tags);

CREATE INDEX IF NOT EXISTS idx_lessons_raw_post_boosts_post
  ON public.lessons_raw_post_boosts (post_id);

CREATE INDEX IF NOT EXISTS idx_lessons_raw_post_boosts_user
  ON public.lessons_raw_post_boosts (user_id);

ALTER TABLE public.lessons_raw_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons_raw_post_boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read lessons raw posts" ON public.lessons_raw_posts;
CREATE POLICY "Authenticated users read lessons raw posts"
  ON public.lessons_raw_posts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users insert own lessons raw posts" ON public.lessons_raw_posts;
CREATE POLICY "Users insert own lessons raw posts"
  ON public.lessons_raw_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own lessons raw posts" ON public.lessons_raw_posts;
CREATE POLICY "Users update own lessons raw posts"
  ON public.lessons_raw_posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own lessons raw posts" ON public.lessons_raw_posts;
CREATE POLICY "Users delete own lessons raw posts"
  ON public.lessons_raw_posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users read lessons raw boosts" ON public.lessons_raw_post_boosts;
CREATE POLICY "Authenticated users read lessons raw boosts"
  ON public.lessons_raw_post_boosts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users insert own lessons raw boosts" ON public.lessons_raw_post_boosts;
CREATE POLICY "Users insert own lessons raw boosts"
  ON public.lessons_raw_post_boosts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own lessons raw boosts" ON public.lessons_raw_post_boosts;
CREATE POLICY "Users delete own lessons raw boosts"
  ON public.lessons_raw_post_boosts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_lessons_raw_posts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lessons_raw_posts_updated_at ON public.lessons_raw_posts;
CREATE TRIGGER trg_lessons_raw_posts_updated_at
BEFORE UPDATE ON public.lessons_raw_posts
FOR EACH ROW
EXECUTE FUNCTION public.set_lessons_raw_posts_updated_at();

CREATE OR REPLACE FUNCTION public.toggle_lessons_raw_post_boost(p_post_id uuid)
RETURNS TABLE(boosted boolean, boost_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.lessons_raw_post_boosts b
    WHERE b.post_id = p_post_id
      AND b.user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.lessons_raw_post_boosts
    WHERE post_id = p_post_id
      AND user_id = v_user_id;

    UPDATE public.lessons_raw_posts
    SET boost_count = GREATEST(0, boost_count - 1)
    WHERE id = p_post_id;

    RETURN QUERY
    SELECT false, p.boost_count
    FROM public.lessons_raw_posts p
    WHERE p.id = p_post_id;
  ELSE
    INSERT INTO public.lessons_raw_post_boosts (post_id, user_id)
    VALUES (p_post_id, v_user_id)
    ON CONFLICT (post_id, user_id) DO NOTHING;

    UPDATE public.lessons_raw_posts
    SET boost_count = boost_count + 1
    WHERE id = p_post_id;

    RETURN QUERY
    SELECT true, p.boost_count
    FROM public.lessons_raw_posts p
    WHERE p.id = p_post_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_lessons_raw_post_boost(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_lessons_raw_post_boost(uuid) TO authenticated;

COMMENT ON TABLE public.lessons_raw_posts IS 'Raw social feed posts on Lessons hub (non-Gyan++)';
COMMENT ON TABLE public.lessons_raw_post_boosts IS 'One boost per user per raw post';
COMMENT ON FUNCTION public.toggle_lessons_raw_post_boost(uuid) IS 'Atomic toggle for boost/unboost + count sync';
