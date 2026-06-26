-- Public join-code lookup (logged-out students clicking email invite links).
-- SECURITY DEFINER returns one classroom row by exact join_code only.

CREATE OR REPLACE FUNCTION public.lookup_classroom_by_join_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_code text;
  v_row public.classrooms%ROWTYPE;
BEGIN
  v_code := upper(trim(coalesce(p_code, '')));
  IF length(v_code) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT * INTO v_row
  FROM public.classrooms
  WHERE join_code = v_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'classroom', null);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'classroom', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'subject', v_row.subject,
      'section', v_row.section,
      'join_code', v_row.join_code,
      'teacher_id', v_row.teacher_id,
      'description', v_row.description,
      'intro_video_url', v_row.intro_video_url,
      'created_at', v_row.created_at,
      'updated_at', v_row.updated_at,
      'google_meet_link', v_row.google_meet_link,
      'google_recurring_event_id', v_row.google_recurring_event_id,
      'allow_adhoc_trial', v_row.allow_adhoc_trial
    )
  );
END;
$$;

COMMENT ON FUNCTION public.lookup_classroom_by_join_code(text) IS
  'Resolve a classroom by join code for /join (including logged-out email invite clicks).';

REVOKE ALL ON FUNCTION public.lookup_classroom_by_join_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_classroom_by_join_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_classroom_by_join_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_classroom_by_join_code(text) TO service_role;
