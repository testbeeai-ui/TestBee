-- Temporal section membership ledger for classrooms.
-- Tracks joins/leaves so post visibility can be evaluated at the time a post was created,
-- and supports section transfer rules (retain old section history + inherit pending items).

BEGIN;

-- ---------------------------------------------------------------------------
-- Table: student_section_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_section_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- NULL = enrolled in class but not assigned to a section during this interval
  section_id uuid REFERENCES public.classroom_sections (id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz
);

CREATE INDEX IF NOT EXISTS student_section_history_classroom_user_idx
  ON public.student_section_history (classroom_id, user_id, joined_at);

CREATE INDEX IF NOT EXISTS student_section_history_classroom_section_idx
  ON public.student_section_history (classroom_id, section_id, joined_at);

-- At most one active interval per (classroom_id, user_id).
CREATE UNIQUE INDEX IF NOT EXISTS student_section_history_one_open_interval
  ON public.student_section_history (classroom_id, user_id)
  WHERE left_at IS NULL;

-- ---------------------------------------------------------------------------
-- Trigger: maintain history from classroom_members changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maintain_student_section_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  now_ts timestamptz := now();
BEGIN
  -- Only track students (never teachers).
  IF (COALESCE(NEW.role, 'student')) = 'teacher' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Partial unique indexes cannot be targeted by ON CONFLICT, so guard with NOT EXISTS.
    INSERT INTO public.student_section_history (classroom_id, user_id, section_id, joined_at, left_at)
    SELECT NEW.classroom_id,
           NEW.user_id,
           NEW.section_id,
           COALESCE(NEW.joined_at, now_ts),
           NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.student_section_history ssh
      WHERE ssh.classroom_id = NEW.classroom_id
        AND ssh.user_id = NEW.user_id
        AND ssh.left_at IS NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- If a row flips to teacher, close the open interval (best effort) and stop tracking.
    IF (COALESCE(OLD.role, 'student')) <> 'teacher' AND (COALESCE(NEW.role, 'student')) = 'teacher' THEN
      UPDATE public.student_section_history
      SET left_at = now_ts
      WHERE classroom_id = NEW.classroom_id
        AND user_id = NEW.user_id
        AND left_at IS NULL;
      RETURN NEW;
    END IF;

    -- Track section transfers (including to/from NULL).
    IF (OLD.section_id IS DISTINCT FROM NEW.section_id) THEN
      -- Close current open interval.
      UPDATE public.student_section_history
      SET left_at = now_ts
      WHERE classroom_id = NEW.classroom_id
        AND user_id = NEW.user_id
        AND left_at IS NULL;

      -- Open new interval for the new section.
      INSERT INTO public.student_section_history (classroom_id, user_id, section_id, joined_at, left_at)
      VALUES (NEW.classroom_id, NEW.user_id, NEW.section_id, now_ts, NULL);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_section_history_ins ON public.classroom_members;
CREATE TRIGGER trg_student_section_history_ins
AFTER INSERT ON public.classroom_members
FOR EACH ROW
EXECUTE FUNCTION public.maintain_student_section_history();

DROP TRIGGER IF EXISTS trg_student_section_history_upd ON public.classroom_members;
CREATE TRIGGER trg_student_section_history_upd
AFTER UPDATE OF section_id, role ON public.classroom_members
FOR EACH ROW
EXECUTE FUNCTION public.maintain_student_section_history();

-- ---------------------------------------------------------------------------
-- Backfill: current classroom_members snapshot into history
-- ---------------------------------------------------------------------------
INSERT INTO public.student_section_history (classroom_id, user_id, section_id, joined_at, left_at)
SELECT cm.classroom_id,
       cm.user_id,
       cm.section_id,
       COALESCE(cm.joined_at, now()),
       NULL
FROM public.classroom_members cm
WHERE COALESCE(cm.role, 'student') <> 'teacher'
  AND NOT EXISTS (
    SELECT 1
    FROM public.student_section_history ssh
    WHERE ssh.classroom_id = cm.classroom_id
      AND ssh.user_id = cm.user_id
      AND ssh.left_at IS NULL
  );

-- ---------------------------------------------------------------------------
-- RLS: posts (members) - temporal section history
-- ---------------------------------------------------------------------------
-- Replace the member read policy to:
-- - Preserve historical section visibility when a student transfers sections.
-- - Inherit "pending" section assignments that were created before the student joined a section,
--   as long as due_date is after joined_at (Rule 2B pending exception).
-- - Keep custom-audience restrictions for assignment-like types (targetStudentIds).

DROP POLICY IF EXISTS "Members can read posts of their classroom" ON public.posts;
CREATE POLICY "Members can read posts of their classroom"
  ON public.posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.student_section_history ssh
      WHERE ssh.classroom_id = posts.classroom_id
        AND ssh.user_id = auth.uid()
        AND (
          -- Class-wide post: visible if created while enrolled in the classroom (any section interval).
          (
            posts.section_id IS NULL
            AND posts.created_at >= ssh.joined_at
            AND (ssh.left_at IS NULL OR posts.created_at <= ssh.left_at)
          )
          OR
          -- Section post: visible if created while the student was in that section,
          -- OR pending when the student joined that section (created earlier but due after join).
          (
            posts.section_id = ssh.section_id
            AND (
              (
                posts.created_at >= ssh.joined_at
                AND (ssh.left_at IS NULL OR posts.created_at <= ssh.left_at)
              )
              OR (
                posts.created_at < ssh.joined_at
                AND posts.due_date IS NOT NULL
                AND posts.due_date > ssh.joined_at
              )
            )
          )
        )
    )
    AND (
      NOT (
        posts.type IN ('assignment', 'quiz', 'mock', 'Concept Focus')
        AND jsonb_typeof(posts.content_json->'targetStudentIds') = 'array'
        AND jsonb_array_length(posts.content_json->'targetStudentIds') > 0
      )
      OR (posts.content_json->'targetStudentIds') ? (auth.uid()::text)
    )
  );

COMMIT;

