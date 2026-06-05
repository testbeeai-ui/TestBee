-- Track one-time welcome email per account (avoids resend on every login).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

COMMENT ON COLUMN public.profiles.welcome_email_sent_at IS
  'When the post-signup welcome letter was emailed to the user (IST-aware app logic).';
