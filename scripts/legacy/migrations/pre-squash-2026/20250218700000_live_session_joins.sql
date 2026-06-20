-- Track who has paid to join a live session (one charge per user per session; re-joins free).
CREATE TABLE IF NOT EXISTS public.live_session_joins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credits_deducted integer NOT NULL DEFAULT 5,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_session_joins_session_id ON public.live_session_joins(session_id);
CREATE INDEX IF NOT EXISTS idx_live_session_joins_user_id ON public.live_session_joins(user_id);

ALTER TABLE public.live_session_joins ENABLE ROW LEVEL SECURITY;

-- Users can read their own join records
CREATE POLICY "Users can read own live_session_joins"
  ON public.live_session_joins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert/update only via service or trusted API (server will use service role or auth)
-- Allow insert so the join API can record after deducting (API uses auth context)
CREATE POLICY "Users can insert own live_session_join"
  ON public.live_session_joins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.live_session_joins IS 'One row per user per session; first join deducts credits, re-joins are free.';
