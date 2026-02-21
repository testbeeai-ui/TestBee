-- Allow students to see classrooms in Explore (and teacher names/visibility).
-- Without these policies, SELECT from classrooms/profiles returns no rows for students (RLS blocks).

-- Classrooms: let any authenticated user read all (so Explore can list classes from other teachers)
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to read classrooms for explore" ON public.classrooms;
CREATE POLICY "Allow authenticated to read classrooms for explore"
  ON public.classrooms FOR SELECT
  TO authenticated
  USING (true);

-- Profiles: let any authenticated user read id, name, visibility (so Explore can show teacher name and filter by visibility)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to read profiles for explore" ON public.profiles;
CREATE POLICY "Allow authenticated to read profiles for explore"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
