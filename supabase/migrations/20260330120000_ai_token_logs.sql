CREATE TABLE IF NOT EXISTS public.ai_token_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action_type text NOT NULL,
  model_id text NOT NULL DEFAULT '',
  backend text NOT NULL DEFAULT '',
  prompt_tokens integer NOT NULL DEFAULT 0,
  candidates_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12, 8) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ai_token_logs_created_at_idx
  ON public.ai_token_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_token_logs_action_type_idx
  ON public.ai_token_logs (action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_token_logs_user_id_idx
  ON public.ai_token_logs (user_id, created_at DESC);

ALTER TABLE public.ai_token_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_token_logs_select_admin" ON public.ai_token_logs;
CREATE POLICY "ai_token_logs_select_admin"
  ON public.ai_token_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
  );

DROP POLICY IF EXISTS "ai_token_logs_insert_authenticated" ON public.ai_token_logs;
CREATE POLICY "ai_token_logs_insert_authenticated"
  ON public.ai_token_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE public.ai_token_logs IS 'Per-request AI usage telemetry: model, tokens, backend, cost, and metadata.';
