-- Admin analytics: single RPC that returns all dashboard KPIs and series
-- in the exact shape the frontend expects. All aggregation in SQL — no JSONB
-- transferred to the app server. Called by service_role from the API route.

CREATE OR REPLACE FUNCTION public.admin_analytics_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users int;
  v_student_users int;
  v_teacher_users int;
  v_admin_users int;
  v_active_30d int;
  v_total_rdm bigint;
  v_lifetime_rdm bigint;
  v_total_saved_bits int;
  v_total_saved_formulas int;
  v_total_saved_cards int;
  v_total_saved_units int;
  v_bits_attempts int;
  v_subtopic_engagement int;
  v_total_doubts int;
  v_resolved_doubts int;
  v_total_doubt_views bigint;
  v_ai_calls bigint;
  v_user_growth jsonb;
  v_doubts_monthly jsonb;
  v_class_dist jsonb;
  v_stream_dist jsonb;
  v_rdm_by_role jsonb;
  v_result jsonb;
BEGIN
  -- KPI counts from profiles (NO JSONB columns fetched)
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE role = 'student')::int,
    count(*) FILTER (WHERE role = 'teacher')::int,
    count(*) FILTER (WHERE role = 'admin')::int,
    count(*) FILTER (
      WHERE updated_at >= now() - interval '30 days'
         OR (updated_at IS NULL AND created_at >= now() - interval '30 days')
    )::int,
    coalesce(sum(rdm), 0)::bigint,
    coalesce(sum(lifetime_answer_rdm), 0)::bigint
  INTO v_total_users, v_student_users, v_teacher_users, v_admin_users,
       v_active_30d, v_total_rdm, v_lifetime_rdm
  FROM profiles;

  -- JSONB array/object length sums (server-side, avoids transferring JSONB to app)
  SELECT
    coalesce(sum(jsonb_array_length(coalesce(saved_bits, '[]'::jsonb))), 0)::int,
    coalesce(sum(jsonb_array_length(coalesce(saved_formulas, '[]'::jsonb))), 0)::int,
    coalesce(sum(jsonb_array_length(coalesce(saved_revision_cards, '[]'::jsonb))), 0)::int,
    coalesce(sum(jsonb_array_length(coalesce(saved_revision_units, '[]'::jsonb))), 0)::int,
    coalesce(sum(CASE WHEN bits_test_attempts IS NOT NULL AND jsonb_typeof(bits_test_attempts) = 'object' THEN (SELECT count(*) FROM jsonb_object_keys(bits_test_attempts)) ELSE 0 END), 0)::int,
    coalesce(sum(CASE WHEN subtopic_engagement IS NOT NULL AND jsonb_typeof(subtopic_engagement) = 'object' THEN (SELECT count(*) FROM jsonb_object_keys(subtopic_engagement)) ELSE 0 END), 0)::int
  INTO v_total_saved_bits, v_total_saved_formulas, v_total_saved_cards,
       v_total_saved_units, v_bits_attempts, v_subtopic_engagement
  FROM profiles;

  -- Doubts aggregation
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE is_resolved)::int,
    coalesce(sum(views), 0)::bigint
  INTO v_total_doubts, v_resolved_doubts, v_total_doubt_views
  FROM doubts;

  -- AI calls count (head-only, no rows transferred)
  SELECT count(*)::bigint INTO v_ai_calls FROM ai_token_logs;

  -- User growth by month
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY month), '[]'::jsonb)
  INTO v_user_growth
  FROM (
    SELECT to_char(created_at, 'YYYY-MM') AS month, count(*) AS count
    FROM profiles
    WHERE created_at IS NOT NULL
    GROUP BY 1
  ) t;

  -- Doubts monthly
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY month), '[]'::jsonb)
  INTO v_doubts_monthly
  FROM (
    SELECT to_char(created_at, 'YYYY-MM') AS month, count(*) AS count
    FROM doubts
    WHERE created_at IS NOT NULL
    GROUP BY 1
  ) t;

  -- Class distribution (students only)
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_class_dist
  FROM (
    SELECT 'Class ' || coalesce(class_level::text, 'Unknown') AS name, count(*) AS value
    FROM profiles
    WHERE role = 'student'
    GROUP BY class_level
  ) t;

  -- Stream distribution (students only)
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_stream_dist
  FROM (
    SELECT coalesce(stream, 'Unknown') AS name, count(*) AS value
    FROM profiles
    WHERE role = 'student'
    GROUP BY stream
  ) t;

  -- RDM by role
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_rdm_by_role
  FROM (
    SELECT role, coalesce(sum(rdm), 0)::bigint AS value
    FROM profiles
    GROUP BY role
  ) t;

  -- Build final response — same shape as AnalyticsPayload in the frontend
  v_result := jsonb_build_object(
    'kpis', jsonb_build_object(
      'totalUsers', v_total_users,
      'studentUsers', v_student_users,
      'teacherUsers', v_teacher_users,
      'adminUsers', v_admin_users,
      'active30d', v_active_30d,
      'totalRdm', v_total_rdm,
      'lifetimeRdm', v_lifetime_rdm,
      'totalDoubts', v_total_doubts,
      'resolvedDoubts', v_resolved_doubts,
      'totalDoubtViews', v_total_doubt_views,
      'totalSavedItems', v_total_saved_bits + v_total_saved_formulas + v_total_saved_cards + v_total_saved_units,
      'bitsAttempts', v_bits_attempts,
      'subtopicEngagement', v_subtopic_engagement,
      'aiCalls', v_ai_calls
    ),
    'series', jsonb_build_object(
      'userGrowth', v_user_growth,
      'doubtsMonthly', v_doubts_monthly,
      'classDistribution', v_class_dist,
      'streamDistribution', v_stream_dist,
      'rdmByRole', v_rdm_by_role,
      'savedContentBreakdown', jsonb_build_array(
        jsonb_build_object('name', 'Saved quizzes', 'value', v_total_saved_bits),
        jsonb_build_object('name', 'Saved Formulas', 'value', v_total_saved_formulas),
        jsonb_build_object('name', 'InstaCue Cards', 'value', v_total_saved_cards),
        jsonb_build_object('name', 'Revision Units', 'value', v_total_saved_units)
      )
    ),
    'generatedAt', to_jsonb(now())
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_analytics_summary() TO service_role;
