-- Phase 2b: drop verified-redundant indexes; add remaining hot FK index.

BEGIN;

-- Exact duplicate of doubt_answers_created_at_idx1
DROP INDEX IF EXISTS public.doubt_answers_created_at_idx;

-- Redundant with UNIQUE (user_id, target_type, target_id) on doubt_votes
DROP INDEX IF EXISTS public.idx_doubt_votes_user_target;

-- Unindexed FK on live_sessions (teacher RLS + inserts)
CREATE INDEX IF NOT EXISTS idx_live_sessions_teacher_id
  ON public.live_sessions (teacher_id);

COMMIT;
