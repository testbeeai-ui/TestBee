-- Conversion Funnel: signup → first quiz → first doubt → daily active → paid
CREATE OR REPLACE FUNCTION public.admin_conversion_funnel()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_signups int;
  v_first_quiz int;
  v_first_doubt int;
  v_daily_active int;
  v_paid int;
BEGIN
  SELECT count(*) INTO v_total_signups
  FROM profiles WHERE role = 'student';

  SELECT count(DISTINCT p.id) INTO v_first_quiz
  FROM profiles p
  WHERE p.role = 'student'
    AND EXISTS (SELECT 1 FROM play_history h WHERE h.user_id = p.id);

  SELECT count(DISTINCT p.id) INTO v_first_doubt
  FROM profiles p
  WHERE p.role = 'student'
    AND EXISTS (SELECT 1 FROM doubts d WHERE d.user_id = p.id);

  SELECT count(DISTINCT p.id) INTO v_daily_active
  FROM profiles p
  WHERE p.role = 'student'
    AND (
      p.updated_at >= now() - interval '30 days'
      OR EXISTS (
        SELECT 1 FROM user_study_day_totals s
        WHERE s.user_id = p.id AND s.day >= (current_date - 30)
      )
    );

  SELECT count(*) INTO v_paid
  FROM profiles WHERE role = 'student' AND plan_tier IS NOT NULL AND plan_tier != 'free';

  RETURN jsonb_build_object(
    'steps', jsonb_build_array(
      jsonb_build_object('name', 'Signup', 'count', v_total_signups, 'pct', 100),
      jsonb_build_object('name', 'First Quiz', 'count', v_first_quiz,
        'pct', CASE WHEN v_total_signups > 0 THEN round(100.0 * v_first_quiz / v_total_signups, 1) ELSE 0 END,
        'dropoff', CASE WHEN v_total_signups > 0 THEN round(100.0 * (v_total_signups - v_first_quiz) / v_total_signups, 1) ELSE 0 END),
      jsonb_build_object('name', 'First Doubt', 'count', v_first_doubt,
        'pct', CASE WHEN v_total_signups > 0 THEN round(100.0 * v_first_doubt / v_total_signups, 1) ELSE 0 END,
        'dropoff', CASE WHEN v_first_quiz > 0 THEN round(100.0 * (v_first_quiz - v_first_doubt) / v_first_quiz, 1) ELSE 0 END),
      jsonb_build_object('name', 'Daily Active (30d)', 'count', v_daily_active,
        'pct', CASE WHEN v_total_signups > 0 THEN round(100.0 * v_daily_active / v_total_signups, 1) ELSE 0 END,
        'dropoff', CASE WHEN v_first_doubt > 0 THEN round(100.0 * (v_first_doubt - v_daily_active) / v_first_doubt, 1) ELSE 0 END),
      jsonb_build_object('name', 'Paid', 'count', v_paid,
        'pct', CASE WHEN v_total_signups > 0 THEN round(100.0 * v_paid / v_total_signups, 1) ELSE 0 END,
        'dropoff', CASE WHEN v_daily_active > 0 THEN round(100.0 * (v_daily_active - v_paid) / v_daily_active, 1) ELSE 0 END)
    ),
    'generatedAt', to_jsonb(now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_conversion_funnel() TO service_role;
