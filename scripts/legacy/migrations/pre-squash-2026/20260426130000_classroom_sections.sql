-- Classroom sections (1 classroom -> many sections)
-- Scheduling + Google Calendar series is owned by a section (not the classroom).

BEGIN;

CREATE TABLE IF NOT EXISTS public.classroom_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Google Calendar integration (per-section)
  google_calendar_list_id text NOT NULL DEFAULT 'primary',
  google_recurring_event_id text,
  google_meet_link text,
  google_rrule text,
  google_time_zone text,
  google_recurrence_end_date text
);

CREATE INDEX IF NOT EXISTS classroom_sections_classroom_id_idx
  ON public.classroom_sections (classroom_id);

-- Guardrail: max 6 sections per classroom
CREATE OR REPLACE FUNCTION public.enforce_classroom_sections_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.classroom_sections
  WHERE classroom_id = NEW.classroom_id;

  IF cnt >= 6 THEN
    RAISE EXCEPTION 'A classroom can have at most 6 sections';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_classroom_sections_limit ON public.classroom_sections;
CREATE TRIGGER trg_enforce_classroom_sections_limit
BEFORE INSERT ON public.classroom_sections
FOR EACH ROW
EXECUTE FUNCTION public.enforce_classroom_sections_limit();

-- Membership: a student can be approved into the classroom but remain unassigned (NULL section_id)
ALTER TABLE public.classroom_members
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.classroom_sections (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS classroom_members_section_id_idx
  ON public.classroom_members (section_id);

-- Live sessions optionally scoped to a section (NULL means whole-class / legacy)
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.classroom_sections (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS live_sessions_section_id_idx
  ON public.live_sessions (section_id);

-- ---------------------------------------------------------------------------
-- RLS for classroom_sections
-- Teachers can manage sections for their classrooms.
-- Members can read sections of classrooms they belong to (so students can see their section schedule).
-- ---------------------------------------------------------------------------

ALTER TABLE public.classroom_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers insert sections in their classroom" ON public.classroom_sections;
CREATE POLICY "Teachers insert sections in their classroom"
  ON public.classroom_sections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_sections.classroom_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers update sections in their classroom" ON public.classroom_sections;
CREATE POLICY "Teachers update sections in their classroom"
  ON public.classroom_sections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_sections.classroom_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_sections.classroom_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers delete sections in their classroom" ON public.classroom_sections;
CREATE POLICY "Teachers delete sections in their classroom"
  ON public.classroom_sections FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_sections.classroom_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can read sections of their classrooms" ON public.classroom_sections;
CREATE POLICY "Users can read sections of their classrooms"
  ON public.classroom_sections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_sections.classroom_id AND c.teacher_id = auth.uid()
    )
    OR public.user_is_member_of_classroom(classroom_sections.classroom_id, auth.uid())
  );

COMMIT;

