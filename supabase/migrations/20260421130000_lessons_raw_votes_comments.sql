-- Raw feed: Reddit-style votes, threaded comments, denormalized counts on posts.

ALTER TABLE public.lessons_raw_posts
  ADD COLUMN IF NOT EXISTS upvote_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downvote_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.lessons_raw_post_votes (
  post_id uuid NOT NULL REFERENCES public.lessons_raw_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lessons_raw_post_votes_user
  ON public.lessons_raw_post_votes (user_id);

CREATE TABLE IF NOT EXISTS public.lessons_raw_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.lessons_raw_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.lessons_raw_post_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lessons_raw_post_comments_body_len CHECK (char_length(trim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_lessons_raw_post_comments_post_created
  ON public.lessons_raw_post_comments (post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_lessons_raw_post_comments_parent
  ON public.lessons_raw_post_comments (parent_id)
  WHERE parent_id IS NOT NULL;

ALTER TABLE public.lessons_raw_post_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons_raw_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read lessons raw votes" ON public.lessons_raw_post_votes;
CREATE POLICY "Authenticated read lessons raw votes"
  ON public.lessons_raw_post_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users upsert own lessons raw votes" ON public.lessons_raw_post_votes;
CREATE POLICY "Users insert own lessons raw votes"
  ON public.lessons_raw_post_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own lessons raw votes" ON public.lessons_raw_post_votes;
CREATE POLICY "Users update own lessons raw votes"
  ON public.lessons_raw_post_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own lessons raw votes" ON public.lessons_raw_post_votes;
CREATE POLICY "Users delete own lessons raw votes"
  ON public.lessons_raw_post_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated read lessons raw comments" ON public.lessons_raw_post_comments;
CREATE POLICY "Authenticated read lessons raw comments"
  ON public.lessons_raw_post_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users insert own lessons raw comments" ON public.lessons_raw_post_comments;
CREATE POLICY "Users insert own lessons raw comments"
  ON public.lessons_raw_post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own lessons raw comments" ON public.lessons_raw_post_comments;
CREATE POLICY "Users update own lessons raw comments"
  ON public.lessons_raw_post_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own lessons raw comments" ON public.lessons_raw_post_comments;
CREATE POLICY "Users delete own lessons raw comments"
  ON public.lessons_raw_post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_lessons_raw_post_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lessons_raw_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.lessons_raw_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lessons_raw_comments_count_ins ON public.lessons_raw_post_comments;
CREATE TRIGGER trg_lessons_raw_comments_count_ins
AFTER INSERT ON public.lessons_raw_post_comments
FOR EACH ROW EXECUTE FUNCTION public.bump_lessons_raw_post_comment_count();

DROP TRIGGER IF EXISTS trg_lessons_raw_comments_count_del ON public.lessons_raw_post_comments;
CREATE TRIGGER trg_lessons_raw_comments_count_del
AFTER DELETE ON public.lessons_raw_post_comments
FOR EACH ROW EXECUTE FUNCTION public.bump_lessons_raw_post_comment_count();

CREATE OR REPLACE FUNCTION public.vote_lessons_raw_post(p_post_id uuid, p_click smallint)
RETURNS TABLE(score integer, up_count integer, down_count integer, my_vote smallint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_old smallint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_click IS DISTINCT FROM 1 AND p_click IS DISTINCT FROM -1 THEN
    RAISE EXCEPTION 'Invalid vote';
  END IF;

  SELECT v.vote INTO v_old
  FROM public.lessons_raw_post_votes v
  WHERE v.post_id = p_post_id AND v.user_id = v_user;

  IF v_old IS NULL THEN
    INSERT INTO public.lessons_raw_post_votes (post_id, user_id, vote)
    VALUES (p_post_id, v_user, p_click);
    IF p_click = 1 THEN
      UPDATE public.lessons_raw_posts SET upvote_count = upvote_count + 1 WHERE id = p_post_id;
    ELSE
      UPDATE public.lessons_raw_posts SET downvote_count = downvote_count + 1 WHERE id = p_post_id;
    END IF;
  ELSIF v_old = p_click THEN
    DELETE FROM public.lessons_raw_post_votes WHERE post_id = p_post_id AND user_id = v_user;
    IF p_click = 1 THEN
      UPDATE public.lessons_raw_posts SET upvote_count = GREATEST(0, upvote_count - 1) WHERE id = p_post_id;
    ELSE
      UPDATE public.lessons_raw_posts SET downvote_count = GREATEST(0, downvote_count - 1) WHERE id = p_post_id;
    END IF;
  ELSE
    UPDATE public.lessons_raw_post_votes SET vote = p_click WHERE post_id = p_post_id AND user_id = v_user;
    IF p_click = 1 THEN
      UPDATE public.lessons_raw_posts
      SET upvote_count = upvote_count + 1, downvote_count = GREATEST(0, downvote_count - 1)
      WHERE id = p_post_id;
    ELSE
      UPDATE public.lessons_raw_posts
      SET downvote_count = downvote_count + 1, upvote_count = GREATEST(0, upvote_count - 1)
      WHERE id = p_post_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p.upvote_count - p.downvote_count,
    p.upvote_count,
    p.downvote_count,
    COALESCE((SELECT vv.vote FROM public.lessons_raw_post_votes vv WHERE vv.post_id = p_post_id AND vv.user_id = v_user), 0::smallint)::smallint
  FROM public.lessons_raw_posts p
  WHERE p.id = p_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vote_lessons_raw_post(uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vote_lessons_raw_post(uuid, smallint) TO authenticated;

COMMENT ON TABLE public.lessons_raw_post_votes IS 'One vote per user per post: +1 or -1';
COMMENT ON TABLE public.lessons_raw_post_comments IS 'Threaded comments on raw feed posts; parent_id for replies';
COMMENT ON FUNCTION public.vote_lessons_raw_post(uuid, smallint) IS 'Toggle or flip vote; returns score and counts';
