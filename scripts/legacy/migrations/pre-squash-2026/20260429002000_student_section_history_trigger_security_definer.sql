-- Ensure the classroom_members -> student_section_history trigger can write even under RLS.
-- Without this, teachers approving students can fail with:
-- "new row violates row-level security policy for table student_section_history".

BEGIN;

-- Recreate trigger function as SECURITY DEFINER so it can bypass RLS safely.
CREATE OR REPLACE FUNCTION public.maintain_student_section_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMIT;

