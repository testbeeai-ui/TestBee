-- Create approved_emails table
CREATE TABLE IF NOT EXISTS public.approved_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  role text NOT NULL CHECK (role IN ('student', 'teacher')),
  first_name text,
  last_name text,
  waitlist_submission_id uuid REFERENCES public.waitlist_submissions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexing for lookup performance
CREATE INDEX IF NOT EXISTS approved_emails_email_idx ON public.approved_emails (email);

-- Enable RLS
ALTER TABLE public.approved_emails ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only select their own email (auth.jwt() ->> 'email')
CREATE POLICY "Allow select by own email" ON public.approved_emails
  FOR SELECT TO public
  USING (email = lower(auth.jwt() ->> 'email'));
