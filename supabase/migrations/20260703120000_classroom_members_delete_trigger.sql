-- Migration: Delete trigger for classroom_members
-- When a student is removed from classroom_members, close their active interval in student_section_history.

-- 1. Update the maintain_student_section_history trigger function to handle TG_OP = 'DELETE'
CREATE OR REPLACE FUNCTION public.maintain_student_section_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  now_ts timestamptz := now();
BEGIN
  -- Handle Delete operations
  IF TG_OP = 'DELETE' THEN
    -- Only track students (never teachers)
    IF (COALESCE(OLD.role, 'student')) = 'teacher' THEN
      RETURN OLD;
    END IF;

    UPDATE public.student_section_history
    SET left_at = now_ts
    WHERE classroom_id = OLD.classroom_id
      AND user_id = OLD.user_id
      AND left_at IS NULL;

    RETURN OLD;
  END IF;

  -- Only track students (never teachers) for insert/update
  IF (COALESCE(NEW.role, 'student')) = 'teacher' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
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
    -- If a row flips to teacher, close the open interval (best effort) and stop tracking
    IF (COALESCE(OLD.role, 'student')) <> 'teacher' AND (COALESCE(NEW.role, 'student')) = 'teacher' THEN
      UPDATE public.student_section_history
      SET left_at = now_ts
      WHERE classroom_id = NEW.classroom_id
        AND user_id = NEW.user_id
        AND left_at IS NULL;
      RETURN NEW;
    END IF;

    -- Track section transfers (including to/from NULL)
    IF (OLD.section_id IS DISTINCT FROM NEW.section_id) THEN
      -- Close current open interval
      UPDATE public.student_section_history
      SET left_at = now_ts
      WHERE classroom_id = NEW.classroom_id
        AND user_id = NEW.user_id
        AND left_at IS NULL;

      -- Open new interval for the new section
      INSERT INTO public.student_section_history (classroom_id, user_id, section_id, joined_at, left_at)
      VALUES (NEW.classroom_id, NEW.user_id, NEW.section_id, now_ts, NULL);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Create the DELETE trigger on public.classroom_members
DROP TRIGGER IF EXISTS trg_student_section_history_del ON public.classroom_members;
CREATE TRIGGER trg_student_section_history_del
  AFTER DELETE ON public.classroom_members
  FOR EACH ROW
  EXECUTE FUNCTION public.maintain_student_section_history();
