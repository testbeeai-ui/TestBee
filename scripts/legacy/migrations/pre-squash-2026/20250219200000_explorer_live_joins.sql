-- Explorers (non-members) joining live during 10-min preview get 8 minutes. One row per user per session.
CREATE TABLE IF NOT EXISTS public.explorer_live_joins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_explorer_live_joins_user_id ON public.explorer_live_joins(user_id);
CREATE INDEX IF NOT EXISTS idx_explorer_live_joins_session_id ON public.explorer_live_joins(session_id);

ALTER TABLE public.explorer_live_joins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own explorer_live_joins" ON public.explorer_live_joins;
CREATE POLICY "Users can read own explorer_live_joins"
  ON public.explorer_live_joins FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- No INSERT policy: only the server (admin client in live join API) creates rows.

COMMENT ON TABLE public.explorer_live_joins IS 'Non-members joining live during class exploration; 8-minute cap enforced server-side.';
