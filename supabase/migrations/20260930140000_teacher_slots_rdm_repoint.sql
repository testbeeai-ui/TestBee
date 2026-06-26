-- Re-point delivery RDM scanner to ended live_class_slots (slot_at = occurrence_at).

CREATE OR REPLACE FUNCTION public.award_eligible_section_schedule_delivery_rdm(p_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_slot record;
  v_result jsonb;
  v_awarded jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_grants_this_run integer := 0;
  v_max_grants integer := 40;
  v_end_at timestamptz;
BEGIN
  IF p_teacher_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_teacher');
  END IF;

  FOR v_slot IN
    SELECT ls.id, ls.section_id, ls.slot_at, ls.duration_minutes
    FROM public.live_class_slots ls
    JOIN public.classroom_sections s ON s.id = ls.section_id
    JOIN public.classrooms c ON c.id = ls.classroom_id
    WHERE c.teacher_id = p_teacher_id
      AND ls.teacher_id = p_teacher_id
      AND ls.status = 'scheduled'
      AND coalesce(s.is_active, true) = true
    ORDER BY ls.slot_at ASC
  LOOP
    EXIT WHEN v_grants_this_run >= v_max_grants;

    v_end_at := v_slot.slot_at + make_interval(mins => GREATEST(v_slot.duration_minutes, 1));
    IF v_end_at > now() THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.teacher_section_schedule_rdm_grants g
      WHERE g.section_id = v_slot.section_id AND g.occurrence_at = v_slot.slot_at
    ) THEN
      v_result := public.award_teacher_section_schedule_occurrence_rdm(
        v_slot.section_id,
        v_slot.slot_at,
        'auto',
        false
      );
      IF coalesce((v_result->>'ok')::boolean, false)
         AND coalesce((v_result->>'already_awarded')::boolean, false) = false
         AND coalesce((v_result->>'total_rdm')::integer, 0) > 0 THEN
        v_awarded := v_awarded || jsonb_build_array(v_result);
        v_count := v_count + 1;
        v_grants_this_run := v_grants_this_run + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'awarded_count', v_count, 'awards', v_awarded);
END;
$$;

COMMENT ON FUNCTION public.award_eligible_section_schedule_delivery_rdm IS
  'Auto-grants delivery RDM for ended live_class_slots (slot_at = occurrence_at).';

-- Student rating: resolve duration from live_class_slots when present.
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
  v_slot public.live_class_slots%ROWTYPE;
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

  SELECT * INTO v_slot
  FROM public.live_class_slots ls
  WHERE ls.section_id = p_section_id
    AND ls.slot_at = p_occurrence_at
    AND ls.status = 'scheduled';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slot_not_found');
  END IF;

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

  v_duration := GREATEST(coalesce(v_slot.duration_minutes, v_section.duration_minutes, 60), 1);
  v_end_at := p_occurrence_at + make_interval(mins => v_duration);

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_quality_window_hours'), 24)
  INTO v_window_hours;
  v_window_hours := GREATEST(0, COALESCE(v_window_hours, 24));

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

  SELECT ls.section_id, ls.classroom_id, s.name AS title, ls.slot_at AS occurrence_at
  INTO v_row
  FROM public.live_class_slots ls
  JOIN public.classroom_sections s ON s.id = ls.section_id
  JOIN public.classroom_members cm
    ON cm.classroom_id = ls.classroom_id
   AND cm.section_id = ls.section_id
   AND cm.user_id = v_uid
   AND cm.role <> 'teacher'
  WHERE ls.status = 'scheduled'
    AND coalesce(s.is_active, true) = true
    AND ls.slot_at + make_interval(mins => GREATEST(ls.duration_minutes, 1)) <= now()
    AND now() <= ls.slot_at
        + make_interval(mins => GREATEST(ls.duration_minutes, 1))
        + make_interval(hours => v_window_hours)
    AND NOT EXISTS (
      SELECT 1 FROM public.live_class_ratings r
      WHERE r.section_id = ls.section_id
        AND r.occurrence_at = ls.slot_at
        AND r.student_id = v_uid
    )
  ORDER BY ls.slot_at DESC
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

-- Quality award: prefer live_class_slots.duration_minutes for window timing.
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
  v_slot public.live_class_slots%ROWTYPE;
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

  SELECT * INTO v_slot
  FROM public.live_class_slots ls
  WHERE ls.section_id = p_section_id
    AND ls.slot_at = p_occurrence_at
    AND ls.status = 'scheduled';

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

  IF FOUND THEN
    v_duration := GREATEST(coalesce(v_slot.duration_minutes, 60), 1);
  ELSE
    v_duration := GREATEST(coalesce(v_section.duration_minutes, 60), 1);
  END IF;
  v_end_at := p_occurrence_at + make_interval(mins => v_duration);
  IF now() <= v_end_at + make_interval(hours => v_window_hours) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rating_window_open',
      'section_id', p_section_id, 'occurrence_at', p_occurrence_at);
  END IF;

  SELECT count(*)::integer INTO v_roster
  FROM public.classroom_members cm
  WHERE cm.classroom_id = v_section.classroom_id
    AND cm.role <> 'teacher'
    AND cm.section_id = v_section.id;

  SELECT count(*)::integer, COALESCE(sum(stars), 0)::integer
  INTO v_n, v_sum
  FROM public.live_class_ratings r
  WHERE r.section_id = p_section_id AND r.occurrence_at = p_occurrence_at;

  IF v_n > 0 THEN
    v_raw_x10 := round((v_sum::numeric / v_n) * 10)::integer;
  ELSE
    v_raw_x10 := 0;
  END IF;
  v_adjusted := (v_sum + v_smoothing_m * (v_prior_avg_x10 / 10.0)) / NULLIF(v_n + v_smoothing_m, 0);
  v_adjusted := COALESCE(v_adjusted, v_prior_avg_x10 / 10.0);
  v_adjusted_x10 := round(v_adjusted * 10)::integer;

  v_required := GREATEST(v_min_ratings, ceil((v_min_coverage_pct::numeric / 100) * v_roster)::integer);

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
    v_new_balance := public.add_rdm(v_grant.teacher_id, v_bonus);
  ELSE
    v_bonus := 0;
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
