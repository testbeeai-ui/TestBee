-- Baseline tables for a fresh Supabase project. Later migrations assume these exist
-- (they were originally created outside this repo / in the dashboard).

DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_url text,
  role text NOT NULL DEFAULT 'student',
  onboarding_complete boolean NOT NULL DEFAULT false,
  google_connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  bio text,
  class_level integer,
  stream text,
  subject_combo text,
  subjects text[],
  exam_tags text[],
  teaching_levels integer[],
  visibility text NOT NULL DEFAULT 'public',
  rdm integer NOT NULL DEFAULT 100,
  lifetime_answer_rdm integer NOT NULL DEFAULT 0,
  saved_bits jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_formulas jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.app_role NOT NULL
);

CREATE TABLE IF NOT EXISTS public.classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  join_code text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  description text,
  section text,
  subject text,
  google_classroom_id text,
  invite_link text,
  intro_video_url text
);

CREATE TABLE IF NOT EXISTS public.classroom_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'student',
  joined_at timestamptz NOT NULL DEFAULT now(),
  google_synced boolean NOT NULL DEFAULT false,
  UNIQUE (classroom_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms (id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL,
  visibility text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  content_json jsonb,
  description text,
  due_date timestamptz,
  google_classroom_synced boolean NOT NULL DEFAULT false,
  tags text[]
);

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms (id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  meet_link text,
  attendance_code text,
  recording_url text,
  recap_post_id uuid REFERENCES public.posts (id) ON DELETE SET NULL
);
