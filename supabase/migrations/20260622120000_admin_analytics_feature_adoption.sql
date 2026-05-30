-- Feature Adoption: % of active users (30d) using each feature
CREATE OR REPLACE FUNCTION public.admin_feature_adoption()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_30d int;
  v_play_users int;
  v_doubt_users int;
  v_mock_users int;
  v_instacue_users int;
  v_dailydose_users int;
  v_community_users int;
  v_saved_users int;
BEGIN
  -- Active students in last 30 days
  SELECT count(DISTINCT p.id) INTO v_active_30d
  FROM profiles p
  WHERE p.role = 'student'
    AND (
      p.updated_at >= now() - interval '30 days'
      OR EXISTS (
        SELECT 1 FROM user_study_day_totals s
        WHERE s.user_id = p.id AND s.day >= (current_date - 30)
      )
    );

  SELECT count(DISTINCT user_id) INTO v_play_users
  FROM play_history WHERE created_at >= now() - interval '30 days';

  SELECT count(DISTINCT user_id) INTO v_doubt_users
  FROM doubts WHERE created_at >= now() - interval '30 days';

  SELECT count(DISTINCT user_id) INTO v_mock_users
  FROM mock_test_attempts WHERE created_at >= now() - interval '30 days';

  SELECT count(DISTINCT user_id) INTO v_instacue_users
  FROM student_learning_dwell_events
  WHERE occurred_at >= now() - interval '30 days' AND panel = 'instacue';

  SELECT count(DISTINCT user_id) INTO v_dailydose_users
  FROM daily_gauntlet_attempts WHERE gauntlet_date >= current_date - 30;

  SELECT count(DISTINCT user_id) INTO v_community_users
  FROM (
    SELECT user_id FROM lessons_raw_posts WHERE created_at >= now() - interval '30 days'
    UNION
    SELECT user_id FROM lessons_raw_post_comments WHERE created_at >= now() - interval '30 days'
  ) t;

  SELECT count(DISTINCT user_id) INTO v_saved_users
  FROM user_saved_items;

  RETURN jsonb_build_object(
    'activeUsers30d', v_active_30d,
    'features', jsonb_build_array(
      jsonb_build_object('name', 'Play', 'users', v_play_users,
        'pct', CASE WHEN v_active_30d > 0 THEN round(100.0 * v_play_users / v_active_30d, 1) ELSE 0 END),
      jsonb_build_object('name', 'Gyan++', 'users', v_doubt_users,
        'pct', CASE WHEN v_active_30d > 0 THEN round(100.0 * v_doubt_users / v_active_30d, 1) ELSE 0 END),
      jsonb_build_object('name', 'Mock Tests', 'users', v_mock_users,
        'pct', CASE WHEN v_active_30d > 0 THEN round(100.0 * v_mock_users / v_active_30d, 1) ELSE 0 END),
      jsonb_build_object('name', 'InstaCue', 'users', v_instacue_users,
        'pct', CASE WHEN v_active_30d > 0 THEN round(100.0 * v_instacue_users / v_active_30d, 1) ELSE 0 END),
      jsonb_build_object('name', 'DailyDose', 'users', v_dailydose_users,
        'pct', CASE WHEN v_active_30d > 0 THEN round(100.0 * v_dailydose_users / v_active_30d, 1) ELSE 0 END),
      jsonb_build_object('name', 'Community', 'users', v_community_users,
        'pct', CASE WHEN v_active_30d > 0 THEN round(100.0 * v_community_users / v_active_30d, 1) ELSE 0 END),
      jsonb_build_object('name', 'Saved Items', 'users', v_saved_users,
        'pct', CASE WHEN v_active_30d > 0 THEN round(100.0 * v_saved_users / v_active_30d, 1) ELSE 0 END)
    ),
    'generatedAt', to_jsonb(now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_feature_adoption() TO service_role;
