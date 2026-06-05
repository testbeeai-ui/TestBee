-- Create waitlist submissions table
CREATE TABLE IF NOT EXISTS public.waitlist_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('student', 'teacher', 'parent', 'other')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  
  -- Student specific fields
  student_class text,
  school text,
  exam text,
  coaching text,
  study_hours text,
  grade10_marks text,
  
  -- Teacher specific fields
  primary_subject text,
  experience text,
  students_count text,
  linkedin text,
  
  -- Parent specific fields
  child_class text,
  child_exam text,
  
  -- Other specific fields
  organisation text,
  organisation_role text,
  website text,
  
  -- Common optional fields
  interests text[] NOT NULL DEFAULT '{}'::text[],
  why_join text,
  referral text,
  refcode text,
  
  -- Consents
  consent_terms boolean NOT NULL DEFAULT false,
  consent_updates boolean NOT NULL DEFAULT false,
  
  -- Admin triage columns
  admin_status text NOT NULL DEFAULT 'new' CHECK (admin_status IN ('new', 'reviewed', 'resolved')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexing for lookup performance
CREATE INDEX IF NOT EXISTS waitlist_submissions_role_idx 
  ON public.waitlist_submissions (role);

CREATE INDEX IF NOT EXISTS waitlist_submissions_admin_status_idx 
  ON public.waitlist_submissions (admin_status, created_at DESC);

CREATE INDEX IF NOT EXISTS waitlist_submissions_created_at_idx 
  ON public.waitlist_submissions (created_at DESC);

-- Enable RLS
ALTER TABLE public.waitlist_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public waitlist signup)
CREATE POLICY waitlist_submissions_insert_public
  ON public.waitlist_submissions
  FOR INSERT
  TO public
  WITH CHECK (true);

COMMENT ON TABLE public.waitlist_submissions IS
  'Submissions from public waitlist form with structured student/teacher/parent details.';
