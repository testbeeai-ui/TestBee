-- Canonical session work plan + assignment linkage on live_sessions.
-- Teacher portal previously stored plans only on `posts` (type session_plan) and
-- matched by title/time heuristics; this caused wrong or empty UI when joins missed.

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS plan_json jsonb;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS pre_assignment_post_id uuid REFERENCES public.posts (id) ON DELETE SET NULL;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS post_assignment_post_id uuid REFERENCES public.posts (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.live_sessions.plan_json IS 'Session plan: pre/post modes, custom text, concept refs, delay, trial (authoritative for teacher portal).';

COMMENT ON COLUMN public.live_sessions.pre_assignment_post_id IS 'Post id of auto-created pre-work assignment for this live session.';

COMMENT ON COLUMN public.live_sessions.post_assignment_post_id IS 'Post id of auto-created post-work assignment for this live session.';

CREATE INDEX IF NOT EXISTS live_sessions_pre_assignment_post_id_idx
  ON public.live_sessions (pre_assignment_post_id)
  WHERE pre_assignment_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS live_sessions_post_assignment_post_id_idx
  ON public.live_sessions (post_assignment_post_id)
  WHERE post_assignment_post_id IS NOT NULL;
