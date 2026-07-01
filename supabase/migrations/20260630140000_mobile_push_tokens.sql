-- Expo push tokens for EduBlast student mobile app (Phase 3).
-- Server-side send is out of scope here; routes only register/unregister tokens.

CREATE TABLE IF NOT EXISTS public.mobile_push_tokens (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_mobile_push_tokens_user_updated
  ON public.mobile_push_tokens (user_id, updated_at DESC);

ALTER TABLE public.mobile_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own push tokens"
  ON public.mobile_push_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own push tokens"
  ON public.mobile_push_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own push tokens"
  ON public.mobile_push_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own push tokens"
  ON public.mobile_push_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
