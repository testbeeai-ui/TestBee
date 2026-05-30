-- Churn Risk: scores each student 0-100 on churn risk
CREATE OR REPLACE FUNCTION public.admin_churn_risk(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users jsonb;
  v_summary jsonb;
BEGIN
  CREATE TEMP TABLE tmp_churn ON COMMIT DROP AS
  WITH last_activity AS (
    SELECT user_id, max(day) AS last_active_day
    FROM user_study_day_totals
    WHERE active_ms > 0
    GROUP BY user_id
  ),
  recent_study AS (
    SELECT user_id,
           sum(CASE WHEN day >= current_date - 7 THEN active_ms ELSE 0 END) AS ms_7d,
           sum(CASE WHEN day >= current_date - 14 AND day < current_date - 7 THEN active_ms ELSE 0 END) AS ms_prev_7d
    FROM user_study_day_totals
    WHERE day >= current_date - 14
    GROUP BY user_id
  ),
  recent_quizzes AS (
    SELECT user_id, count(*) AS quiz_count_30d
    FROM play_history
    WHERE created_at >= now() - interval '30 days'
    GROUP BY user_id
  )
  SELECT
    p.id AS user_id,
    p.name,
    p.daily_dose_streak,
    p.last_daily_dose_streak_date,
    coalesce(current_date - la.last_active_day, 999) AS days_inactive,
    coalesce(rs.ms_7d, 0) AS study_ms_7d,
    coalesce(rs.ms_prev_7d, 0) AS study_ms_prev_7d,
    coalesce(rq.quiz_count_30d, 0) AS quiz_count_30d,
    LEAST(100,
      LEAST(60, coalesce(current_date - la.last_active_day, 999) * 3)
      + CASE WHEN p.daily_dose_streak > 3
             AND (p.last_daily_dose_streak_date IS NULL OR p.last_daily_dose_streak_date::date < current_date - 1)
          THEN 15 ELSE 0 END
      + CASE WHEN rs.ms_prev_7d > 600000 AND coalesce(rs.ms_7d, 0) < rs.ms_prev_7d * 0.5
          THEN 15 ELSE 0 END
      + CASE WHEN coalesce(rq.quiz_count_30d, 0) = 0 THEN 10 ELSE 0 END
    ) AS risk_score
  FROM profiles p
  LEFT JOIN last_activity la ON la.user_id = p.id
  LEFT JOIN recent_study rs ON rs.user_id = p.id
  LEFT JOIN recent_quizzes rq ON rq.user_id = p.id
  WHERE p.role = 'student';

  SELECT jsonb_build_object(
    'high', count(*) FILTER (WHERE risk_score >= 60),
    'medium', count(*) FILTER (WHERE risk_score >= 30 AND risk_score < 60),
    'low', count(*) FILTER (WHERE risk_score < 30),
    'total', count(*)
  ) INTO v_summary
  FROM tmp_churn;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY risk_score DESC), '[]'::jsonb)
  INTO v_users
  FROM (
    SELECT
      user_id, name, risk_score, days_inactive,
      daily_dose_streak, study_ms_7d, study_ms_prev_7d, quiz_count_30d,
      CASE
        WHEN risk_score >= 60 THEN 'high'
        WHEN risk_score >= 30 THEN 'medium'
        ELSE 'low'
      END AS risk_level,
      array_remove(ARRAY[
        CASE WHEN days_inactive > 7 THEN 'Inactive ' || days_inactive || 'd' END,
        CASE WHEN daily_dose_streak > 3 AND (last_daily_dose_streak_date IS NULL OR last_daily_dose_streak_date::date < current_date - 1)
          THEN 'Streak broken (was ' || daily_dose_streak || ')' END,
        CASE WHEN study_ms_prev_7d > 600000 AND study_ms_7d < study_ms_prev_7d * 0.5
          THEN 'Study time declining' END,
        CASE WHEN quiz_count_30d = 0 THEN 'No quizzes 30d' END
      ], NULL) AS risk_factors
    FROM tmp_churn
    WHERE risk_score >= 20
    ORDER BY risk_score DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object(
    'summary', v_summary,
    'atRiskUsers', v_users,
    'generatedAt', to_jsonb(now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_churn_risk(int) TO service_role;
