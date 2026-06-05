-- Transactional email audit trail (welcome, login) for admin volume monitoring + daily cap.

CREATE TABLE IF NOT EXISTS public.transactional_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ist_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('welcome', 'login', 'other')),
  recipient text NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  subject text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'blocked_cap')),
  message_id text,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_transactional_email_logs_ist_date
  ON public.transactional_email_logs (ist_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactional_email_logs_created_at
  ON public.transactional_email_logs (created_at DESC);

COMMENT ON TABLE public.transactional_email_logs IS
  'Outbound SMTP sends (welcome/login). ist_date is Asia/Kolkata calendar day for admin daily totals.';

ALTER TABLE public.transactional_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read transactional email logs" ON public.transactional_email_logs;
CREATE POLICY "Admins can read transactional email logs"
  ON public.transactional_email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
