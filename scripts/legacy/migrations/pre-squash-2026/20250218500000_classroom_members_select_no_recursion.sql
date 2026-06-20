-- Fix: "infinite recursion detected in policy for relation classroom_members"
-- The SELECT policy must not query classroom_members from within the same policy.

-- Helper: check membership without triggering RLS (avoids recursion)
CREATE OR REPLACE FUNCTION public.user_is_member_of_classroom(cid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_members m
    WHERE m.classroom_id = cid AND m.user_id = uid
  );
$$;

-- Replace the self-referential SELECT policy
DROP POLICY IF EXISTS "Users can read members of their classrooms" ON public.classroom_members;
CREATE POLICY "Users can read members of their classrooms"
  ON public.classroom_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = auth.uid()
    )
    OR public.user_is_member_of_classroom(classroom_members.classroom_id, auth.uid())
  );
