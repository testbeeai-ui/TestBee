-- Migration: Default classroom enrollment for new and existing users
-- Automatically assigns students to the default classroom named "Class" on signup,
-- and backfills existing students to the same classroom.

-- 1. Update the handle_new_user function to automatically assign new users to the default classroom
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  default_class_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, name, avatar_url, role, onboarding_complete, google_connected)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'User'
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'student',
    false,
    COALESCE((NEW.raw_app_meta_data ->> 'provider') = 'google', false)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Automatically enroll new student in the classroom named 'Class'
  -- (Ignore if the classroom doesn't exist or is not found)
  SELECT id INTO default_class_id FROM public.classrooms WHERE name = 'Class' LIMIT 1;
  IF default_class_id IS NOT NULL THEN
    INSERT INTO public.classroom_members (classroom_id, user_id, role)
    VALUES (default_class_id, NEW.id, 'student')
    ON CONFLICT (classroom_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 2. Backfill existing users (role = 'student') into the classroom named 'Class'
DO $$
DECLARE
  default_class_id uuid;
  student_row record;
BEGIN
  SELECT id INTO default_class_id FROM public.classrooms WHERE name = 'Class' LIMIT 1;
  IF default_class_id IS NOT NULL THEN
    FOR student_row IN 
      SELECT id FROM public.profiles WHERE role = 'student'
    LOOP
      INSERT INTO public.classroom_members (classroom_id, user_id, role)
      VALUES (default_class_id, student_row.id, 'student')
      ON CONFLICT (classroom_id, user_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;
