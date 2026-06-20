-- Classrooms RLS previously had only SELECT (explore listing). Inserts/updates were denied:
-- "new row violates row-level security policy for table classrooms"
--
-- Teachers may INSERT rows where they are the owner, UPDATE/DELETE only their own classes.

DROP POLICY IF EXISTS "Teachers insert own classrooms" ON public.classrooms;
CREATE POLICY "Teachers insert own classrooms"
  ON public.classrooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers update own classrooms" ON public.classrooms;
CREATE POLICY "Teachers update own classrooms"
  ON public.classrooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers delete own classrooms" ON public.classrooms;
CREATE POLICY "Teachers delete own classrooms"
  ON public.classrooms FOR DELETE
  TO authenticated
  USING (auth.uid() = teacher_id);

-- ---------------------------------------------------------------------------
-- posts: only SELECT existed (explorer/feed reads). Client inserts/updates failed silently or with RLS errors.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Teachers insert posts in their classroom" ON public.posts;
CREATE POLICY "Teachers insert posts in their classroom"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = posts.classroom_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers update own posts" ON public.posts;
CREATE POLICY "Teachers update own posts"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers delete own posts" ON public.posts;
CREATE POLICY "Teachers delete own posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING (auth.uid() = teacher_id);
