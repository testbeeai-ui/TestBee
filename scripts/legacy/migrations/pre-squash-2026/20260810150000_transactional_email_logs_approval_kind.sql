-- Allow approval invite emails in transactional_email_logs.kind

ALTER TABLE public.transactional_email_logs
  DROP CONSTRAINT IF EXISTS transactional_email_logs_kind_check;

ALTER TABLE public.transactional_email_logs
  ADD CONSTRAINT transactional_email_logs_kind_check
  CHECK (kind IN ('welcome', 'login', 'approval', 'other'));
