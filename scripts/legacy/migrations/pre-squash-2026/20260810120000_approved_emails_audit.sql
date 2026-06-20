-- Audit columns for approved_emails whitelist entries
ALTER TABLE public.approved_emails
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_via text CHECK (approved_via IS NULL OR approved_via IN ('waitlist_approve', 'manual'));

COMMENT ON COLUMN public.approved_emails.approved_by IS 'Admin user who granted whitelist access';
COMMENT ON COLUMN public.approved_emails.approved_via IS 'How access was granted: waitlist_approve or manual';
