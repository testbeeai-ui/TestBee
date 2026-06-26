-- Live-class quality bonus RDM (CREDIT ONLY).
-- Students rate a section schedule occurrence (Path A) 1-5 stars after it ends.
-- A class earns the teacher a flat quality bonus (default +200) ONLY when:
--   (1) the ratings window has closed,
--   (2) quorum is met: raters >= min_ratings AND raters >= ceil(coverage% * roster),
--   (3) the Bayesian-smoothed score >= threshold (default 4.5), and
--   (4) the teacher is under the monthly cap.
-- There are NEVER deductions/penalties/claw-backs. add_rdm is only ever called with a
-- positive amount, and only once per occurrence (idempotent via quality_awarded_at).

-- ---------------------------------------------------------------------------
-- 1. Config defaults (scores stored x10 to stay integer-compatible)
-- ---------------------------------------------------------------------------
INSERT INTO public.rdm_config (key, value)
VALUES
  ('teacher_live_class_quality_bonus_rdm', 200),
  ('teacher_live_class_quality_min_avg_x10', 45),
  ('teacher_live_class_quality_min_ratings', 5),
  ('teacher_live_class_quality_min_coverage_pct', 50),
  ('teacher_live_class_quality_smoothing_m', 8),
  ('teacher_live_class_quality_prior_avg_x10', 40),
  ('teacher_live_class_quality_window_hours', 24),
  ('teacher_live_class_quality_monthly_cap', 20)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Ratings table: one row per student per occurrence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_class_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.classroom_sections(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  occurrence_at timestamptz NOT NULL,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_class_ratings_unique UNIQUE (section_id, occurrence_at, student_id)
);

CREATE INDEX IF NOT EXISTS live_class_ratings_occurrence_idx
  ON public.live_class_ratings (section_id, occurrence_at);

COMMENT ON TABLE public.live_class_ratings IS
  'One 1-5 star rating per student per section schedule occurrence (Path A). Drives the credit-only quality bonus.';

ALTER TABLE public.live_class_ratings ENABLE ROW LEVEL SECURITY;

-- Students can read ONLY their own rating row (teachers never see who rated what).
DROP POLICY IF EXISTS live_class_ratings_student_select ON public.live_class_ratings;
CREATE POLICY live_class_ratings_student_select
  ON public.live_class_ratings
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- All writes go through submit_live_class_rating (SECURITY DEFINER); no direct table writes.

-- ---------------------------------------------------------------------------
-- 3. Quality columns on the existing delivery grant (same occurrence key)
-- ---------------------------------------------------------------------------
ALTER TABLE public.teacher_section_schedule_rdm_grants
  ADD COLUMN IF NOT EXISTS quality_rating_count integer,
  ADD COLUMN IF NOT EXISTS quality_avg_x10 integer,
  ADD COLUMN IF NOT EXISTS quality_adjusted_x10 integer,
  ADD COLUMN IF NOT EXISTS quality_bonus_rdm integer,
  ADD COLUMN IF NOT EXISTS quality_awarded_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Student rating submission (validates membership + window; one per student)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_live_class_rating(
  p_section_id uuid,
  p_occurrence_at timestamptz,
  p_stars smallint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_section public.classroom_sections%ROWTYPE;
  v_is_member boolean := false;
  v_duration integer := 60;
  v_end_at timestamptz;
  v_window_hours integer := 24;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF p_section_id IS NULL OR p_occurrence_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;
  IF p_stars IS NULL OR p_stars < 1 OR p_stars > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_stars');
  END IF;

  SELECT * INTO v_section FROM public.classroom_sections s WHERE s.id = p_section_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'section_not_found');
  END IF;

  -- Must be a non-teacher member of this section's class.
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_members cm
    WHERE cm.classroom_id = v_section.classroom_id
      AND cm.user_id = v_uid
      AND cm.role <> 'teacher'
      AND cm.section_id = v_section.id
  ) INTO v_is_member;
  IF NOT v_is_member THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
  END IF;

  v_duration := GREATEST(coalesce(v_section.duration_minutes, 60), 1);
  v_end_at := p_occurrence_at + make_interval(mins => v_duration);

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_window_hours'), 24)
  INTO v_window_hours;
  v_window_hours := GREATEST(0, COALESCE(v_window_hours, 24));

  -- Window: from class end until end + window_hours.
  IF v_end_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_not_ended');
  END IF;
  IF now() > v_end_at + make_interval(hours => v_window_hours) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rating_window_closed');
  END IF;

  INSERT INTO public.live_class_ratings (
    section_id, classroom_id, occurrence_at, student_id, stars
  ) VALUES (
    p_section_id, v_section.classroom_id, p_occurrence_at, v_uid, p_stars
  )
  ON CONFLICT (section_id, occurrence_at, student_id)
  DO UPDATE SET stars = EXCLUDED.stars, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'stars', p_stars);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Award the quality bonus for one occurrence (CREDIT ONLY, idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_teacher_section_schedule_quality_rdm(
  p_section_id uuid,
  p_occurrence_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_grant public.teacher_section_schedule_rdm_grants%ROWTYPE;
  v_section public.classroom_sections%ROWTYPE;
  v_duration integer := 60;
  v_end_at timestamptz;
  v_window_hours integer := 24;
  v_bonus integer := 200;
  v_min_avg_x10 integer := 45;
  v_min_ratings integer := 5;
  v_min_coverage_pct integer := 50;
  v_smoothing_m integer := 8;
  v_prior_avg_x10 integer := 40;
  v_monthly_cap integer := 20;
  v_roster integer := 0;
  v_n integer := 0;
  v_sum integer := 0;
  v_required integer := 0;
  v_raw_x10 integer := 0;
  v_adjusted numeric := 0;
  v_adjusted_x10 integer := 0;
  v_month_awards integer := 0;
  v_new_balance integer;
  v_qualifies boolean := false;
BEGIN
  IF p_section_id IS NULL OR p_occurrence_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  -- Anchor to the delivery grant (canonical occurrence). Idempotent on quality_awarded_at.
  SELECT * INTO v_grant
  FROM public.teacher_section_schedule_rdm_grants g
  WHERE g.section_id = p_section_id AND g.occurrence_at = p_occurrence_at;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'delivery_grant_missing');
  END IF;
  IF v_grant.quality_awarded_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true, 'already_awarded', true,
      'section_id', p_section_id, 'occurrence_at', p_occurrence_at,
      'quality_bonus_rdm', coalesce(v_grant.quality_bonus_rdm, 0)
    );
  END IF;

  SELECT * INTO v_section FROM public.classroom_sections s WHERE s.id = p_section_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'section_not_found');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_window_hours'), 24) INTO v_window_hours;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_bonus_rdm'), 200) INTO v_bonus;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_min_avg_x10'), 45) INTO v_min_avg_x10;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_min_ratings'), 5) INTO v_min_ratings;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_min_coverage_pct'), 50) INTO v_min_coverage_pct;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_smoothing_m'), 8) INTO v_smoothing_m;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_prior_avg_x10'), 40) INTO v_prior_avg_x10;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_monthly_cap'), 20) INTO v_monthly_cap;

  v_window_hours := GREATEST(0, COALESCE(v_window_hours, 24));
  v_bonus := GREATEST(0, COALESCE(v_bonus, 200));
  v_min_avg_x10 := GREATEST(10, LEAST(50, COALESCE(v_min_avg_x10, 45)));
  v_min_ratings := GREATEST(1, COALESCE(v_min_ratings, 5));
  v_min_coverage_pct := GREATEST(0, LEAST(100, COALESCE(v_min_coverage_pct, 50)));
  v_smoothing_m := GREATEST(0, COALESCE(v_smoothing_m, 8));
  v_prior_avg_x10 := GREATEST(10, LEAST(50, COALESCE(v_prior_avg_x10, 40)));
  v_monthly_cap := GREATEST(0, COALESCE(v_monthly_cap, 20));

  -- Window must have closed before we decide (no premature/partial awards).
  v_duration := GREATEST(coalesce(v_section.duration_minutes, 60), 1);
  v_end_at := p_occurrence_at + make_interval(mins => v_duration);
  IF now() <= v_end_at + make_interval(hours => v_window_hours) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rating_window_open',
      'section_id', p_section_id, 'occurrence_at', p_occurrence_at);
  END IF;

  -- Roster = enrolled non-teacher members of this section.
  SELECT count(*)::integer INTO v_roster
  FROM public.classroom_members cm
  WHERE cm.classroom_id = v_section.classroom_id
    AND cm.role <> 'teacher'
    AND cm.section_id = v_section.id;

  SELECT count(*)::integer, COALESCE(sum(stars), 0)::integer
  INTO v_n, v_sum
  FROM public.live_class_ratings r
  WHERE r.section_id = p_section_id AND r.occurrence_at = p_occurrence_at;

  -- Scores (mirror lib/teacherPortal/liveClassQualityRdm.ts).
  IF v_n > 0 THEN
    v_raw_x10 := round((v_sum::numeric / v_n) * 10)::integer;
  ELSE
    v_raw_x10 := 0;
  END IF;
  v_adjusted := (v_sum + v_smoothing_m * (v_prior_avg_x10 / 10.0)) / NULLIF(v_n + v_smoothing_m, 0);
  v_adjusted := COALESCE(v_adjusted, v_prior_avg_x10 / 10.0);
  v_adjusted_x10 := round(v_adjusted * 10)::integer;

  v_required := GREATEST(v_min_ratings, ceil((v_min_coverage_pct::numeric / 100) * v_roster)::integer);

  -- Monthly cap (IST), counting only positive prior quality grants.
  SELECT count(*)::integer INTO v_month_awards
  FROM public.teacher_section_schedule_rdm_grants g
  WHERE g.teacher_id = v_grant.teacher_id
    AND g.quality_awarded_at IS NOT NULL
    AND coalesce(g.quality_bonus_rdm, 0) > 0
    AND date_trunc('month', (g.quality_awarded_at AT TIME ZONE 'Asia/Kolkata'))
        = date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata'));

  v_qualifies := (v_monthly_cap = 0 OR v_month_awards < v_monthly_cap)
    AND v_n >= v_required
    AND v_adjusted_x10 >= v_min_avg_x10;

  IF v_qualifies THEN
    v_new_balance := public.add_rdm(v_grant.teacher_id, v_bonus);  -- CREDIT ONLY
  ELSE
    v_bonus := 0;  -- never debit
  END IF;

  UPDATE public.teacher_section_schedule_rdm_grants
  SET quality_rating_count = v_n,
      quality_avg_x10 = v_raw_x10,
      quality_adjusted_x10 = v_adjusted_x10,
      quality_bonus_rdm = v_bonus,
      quality_awarded_at = now()
  WHERE id = v_grant.id;

  RETURN jsonb_build_object(
    'ok', true,
    'section_id', p_section_id,
    'occurrence_at', p_occurrence_at,
    'title', v_section.name,
    'classroom_id', v_section.classroom_id,
    'qualifies', v_qualifies,
    'quality_bonus_rdm', v_bonus,
    'rating_count', v_n,
    'roster_count', v_roster,
    'required_raters', v_required,
    'avg_x10', v_raw_x10,
    'adjusted_x10', v_adjusted_x10,
    'balance', CASE WHEN v_qualifies THEN v_new_balance ELSE NULL END,
    'source', 'section_schedule_quality'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Batch: award all of a teacher's eligible (window-closed) occurrences
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_eligible_teacher_live_class_quality_rdm(p_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_grant record;
  v_result jsonb;
  v_awarded jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_max integer := 40;
BEGIN
  IF p_teacher_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_teacher');
  END IF;

  FOR v_grant IN
    SELECT g.section_id, g.occurrence_at
    FROM public.teacher_section_schedule_rdm_grants g
    WHERE g.teacher_id = p_teacher_id
      AND g.quality_awarded_at IS NULL
    ORDER BY g.occurrence_at ASC
    LIMIT v_max
  LOOP
    v_result := public.award_teacher_section_schedule_quality_rdm(
      v_grant.section_id, v_grant.occurrence_at
    );
    IF coalesce((v_result->>'ok')::boolean, false)
       AND coalesce((v_result->>'qualifies')::boolean, false)
       AND coalesce((v_result->>'quality_bonus_rdm')::integer, 0) > 0 THEN
      v_awarded := v_awarded || jsonb_build_array(v_result);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'awarded_count', v_count, 'awards', v_awarded);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6b. Student read: the most recent occurrence this student can rate right now
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pending_live_class_rating()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_window_hours integer := 24;
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_window_hours'), 24)
  INTO v_window_hours;
  v_window_hours := GREATEST(0, COALESCE(v_window_hours, 24));

  SELECT s.id AS section_id, s.classroom_id, s.name AS title, occ.occurrence_at
  INTO v_row
  FROM public.classroom_sections s
  JOIN public.classroom_members cm
    ON cm.classroom_id = s.classroom_id
   AND cm.section_id = s.id
   AND cm.user_id = v_uid
   AND cm.role <> 'teacher'
  CROSS JOIN LATERAL (
    SELECT public._section_schedule_occurrence_start(d::date, s.schedule_time, s.google_time_zone) AS occurrence_at
    FROM generate_series(current_date - 2, current_date, interval '1 day') AS d
  ) occ
  WHERE coalesce(s.is_active, true) = true
    AND trim(coalesce(s.schedule_time, '')) <> ''
    AND coalesce(s.duration_minutes, 0) > 0
    AND occ.occurrence_at IS NOT NULL
    AND (
      (
        coalesce(array_length(s.repeat_days, 1), 0) = 0
        AND public._parse_schedule_ymd(s.schedule_date) = (
          occ.occurrence_at AT TIME ZONE coalesce(nullif(trim(s.google_time_zone), ''), 'Asia/Kolkata')
        )::date
      )
      OR (
        coalesce(array_length(s.repeat_days, 1), 0) > 0
        AND public._weekday_short_en(
          (occ.occurrence_at AT TIME ZONE coalesce(nullif(trim(s.google_time_zone), ''), 'Asia/Kolkata'))::date
        ) = ANY (s.repeat_days)
      )
    )
    AND occ.occurrence_at + make_interval(mins => GREATEST(s.duration_minutes, 1)) <= now()
    AND now() <= occ.occurrence_at
        + make_interval(mins => GREATEST(s.duration_minutes, 1))
        + make_interval(hours => v_window_hours)
    AND NOT EXISTS (
      SELECT 1 FROM public.live_class_ratings r
      WHERE r.section_id = s.id AND r.occurrence_at = occ.occurrence_at AND r.student_id = v_uid
    )
  ORDER BY occ.occurrence_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'has_pending', false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'has_pending', true,
    'section_id', v_row.section_id,
    'classroom_id', v_row.classroom_id,
    'occurrence_at', v_row.occurrence_at,
    'title', v_row.title
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.submit_live_class_rating(uuid, timestamptz, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_live_class_rating(uuid, timestamptz, smallint) TO authenticated;

REVOKE ALL ON FUNCTION public.get_pending_live_class_rating() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_live_class_rating() TO authenticated;

REVOKE ALL ON FUNCTION public.award_teacher_section_schedule_quality_rdm(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_eligible_teacher_live_class_quality_rdm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_teacher_section_schedule_quality_rdm(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_eligible_teacher_live_class_quality_rdm(uuid) TO service_role;

COMMENT ON FUNCTION public.award_teacher_section_schedule_quality_rdm IS
  'Credit-only quality bonus for one section schedule occurrence after the ratings window closes. Never debits.';
COMMENT ON FUNCTION public.award_eligible_teacher_live_class_quality_rdm IS
  'Auto-grants quality bonuses for a teacher (teacher portal on load). Credit-only, idempotent.';
