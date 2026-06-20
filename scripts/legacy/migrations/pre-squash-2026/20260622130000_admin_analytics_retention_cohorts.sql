-- Retention Cohorts: Day-1/7/30 return rates per signup month
CREATE OR REPLACE FUNCTION public.admin_retention_cohorts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cohorts jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY cohort_month), '[]'::jsonb)
  INTO v_cohorts
  FROM (
    SELECT
      to_char(p.created_at, 'YYYY-MM') AS cohort_month,
      count(DISTINCT p.id)::int AS cohort_size,
      count(DISTINCT CASE WHEN s1.user_id IS NOT NULL THEN p.id END)::int AS day1,
      count(DISTINCT CASE WHEN s7.user_id IS NOT NULL THEN p.id END)::int AS day7,
      count(DISTINCT CASE WHEN s30.user_id IS NOT NULL THEN p.id END)::int AS day30,
      CASE WHEN count(DISTINCT p.id) > 0
        THEN round(100.0 * count(DISTINCT CASE WHEN s1.user_id IS NOT NULL THEN p.id END) / count(DISTINCT p.id), 1)
        ELSE 0 END AS day1_pct,
      CASE WHEN count(DISTINCT p.id) > 0
        THEN round(100.0 * count(DISTINCT CASE WHEN s7.user_id IS NOT NULL THEN p.id END) / count(DISTINCT p.id), 1)
        ELSE 0 END AS day7_pct,
      CASE WHEN count(DISTINCT p.id) > 0
        THEN round(100.0 * count(DISTINCT CASE WHEN s30.user_id IS NOT NULL THEN p.id END) / count(DISTINCT p.id), 1)
        ELSE 0 END AS day30_pct
    FROM profiles p
    LEFT JOIN user_study_day_totals s1
      ON s1.user_id = p.id AND s1.day = (p.created_at::date + 1)
    LEFT JOIN user_study_day_totals s7
      ON s7.user_id = p.id AND s7.day = (p.created_at::date + 7)
    LEFT JOIN user_study_day_totals s30
      ON s30.user_id = p.id AND s30.day = (p.created_at::date + 30)
    WHERE p.role = 'student' AND p.created_at IS NOT NULL
      AND p.created_at >= now() - interval '12 months'
    GROUP BY 1
  ) t;

  RETURN jsonb_build_object(
    'cohorts', v_cohorts,
    'note', 'Day-N = user returned N days after signup. Last 12 months.',
    'generatedAt', to_jsonb(now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_retention_cohorts() TO service_role;
