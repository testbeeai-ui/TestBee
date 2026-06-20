-- Drop-off Tracking: where students abandon the learning flow
-- Stages: Page Visited → Quiz Started → Quiz Completed → Lesson Marked Complete
CREATE OR REPLACE FUNCTION public.admin_dropoff_tracking()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_page_only int := 0;
  v_quiz_started int := 0;
  v_quiz_completed int := 0;
  v_lesson_marked int := 0;
  r RECORD;
  key TEXT;
  val JSONB;
  bits_val JSONB;
BEGIN
  FOR r IN SELECT subtopic_engagement FROM profiles
           WHERE role = 'student'
             AND subtopic_engagement IS NOT NULL
             AND jsonb_typeof(subtopic_engagement) = 'object'
  LOOP
    FOR key, val IN SELECT * FROM jsonb_each(r.subtopic_engagement)
    LOOP
      IF val IS NULL OR jsonb_typeof(val) != 'object' THEN CONTINUE; END IF;
      IF val->>'bitsSignature' IS NULL OR val->>'bitsSignature' = '' THEN CONTINUE; END IF;

      v_total := v_total + 1;
      bits_val := val->'bits';

      IF val->>'lessonChecklistMarkedCompleteAt' IS NOT NULL THEN
        v_lesson_marked := v_lesson_marked + 1;
      ELSIF bits_val IS NOT NULL AND bits_val->>'graded' IS NOT NULL THEN
        v_quiz_completed := v_quiz_completed + 1;
      ELSIF bits_val IS NOT NULL AND (bits_val->>'currentIdx')::int > 0 THEN
        v_quiz_started := v_quiz_started + 1;
      ELSE
        v_page_only := v_page_only + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'totalSubtopicVisits', v_total,
    'stages', jsonb_build_array(
      jsonb_build_object('stage', 'Page Visited', 'count', v_page_only + v_quiz_started + v_quiz_completed + v_lesson_marked, 'pct', 100),
      jsonb_build_object('stage', 'Quiz Started', 'count', v_quiz_started + v_quiz_completed + v_lesson_marked,
        'pct', CASE WHEN v_total > 0 THEN round(100.0 * (v_quiz_started + v_quiz_completed + v_lesson_marked) / v_total, 1) ELSE 0 END),
      jsonb_build_object('stage', 'Quiz Completed', 'count', v_quiz_completed + v_lesson_marked,
        'pct', CASE WHEN v_total > 0 THEN round(100.0 * (v_quiz_completed + v_lesson_marked) / v_total, 1) ELSE 0 END),
      jsonb_build_object('stage', 'Lesson Marked Complete', 'count', v_lesson_marked,
        'pct', CASE WHEN v_total > 0 THEN round(100.0 * v_lesson_marked / v_total, 1) ELSE 0 END)
    ),
    'abandonmentPoints', jsonb_build_array(
      jsonb_build_object('point', 'Page → Quiz', 'abandoned', v_page_only,
        'pct', CASE WHEN v_total > 0 THEN round(100.0 * v_page_only / v_total, 1) ELSE 0 END),
      jsonb_build_object('point', 'Quiz Started → Completed', 'abandoned', v_quiz_started,
        'pct', CASE WHEN (v_quiz_started + v_quiz_completed + v_lesson_marked) > 0 THEN round(100.0 * v_quiz_started / (v_quiz_started + v_quiz_completed + v_lesson_marked), 1) ELSE 0 END),
      jsonb_build_object('point', 'Completed → Marked', 'abandoned', v_quiz_completed,
        'pct', CASE WHEN (v_quiz_completed + v_lesson_marked) > 0 THEN round(100.0 * v_quiz_completed / (v_quiz_completed + v_lesson_marked), 1) ELSE 0 END)
    ),
    'generatedAt', to_jsonb(now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dropoff_tracking() TO service_role;
