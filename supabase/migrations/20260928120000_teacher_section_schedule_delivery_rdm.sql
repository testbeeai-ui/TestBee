-- Delivery RDM for Path A: recurring section / Google Calendar class schedule.
-- NOT for extra one-off rows in live_sessions (Schedule Live Session wizard).

CREATE TABLE IF NOT EXISTS public.teacher_section_schedule_rdm_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.classroom_sections(id) ON DELETE CASCADE,
  occurrence_at timestamptz NOT NULL,
  student_count integer NOT NULL DEFAULT 0,
  capped_student_count integer NOT NULL DEFAULT 0,
  base_rdm integer NOT NULL DEFAULT 0,
  per_student_rdm integer NOT NULL DEFAULT 0,
  student_bonus_rdm integer NOT NULL DEFAULT 0,
  total_rdm integer NOT NULL DEFAULT 0,
  awarded_by text NOT NULL DEFAULT 'auto',
  awarded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_section_schedule_rdm_grants_awarded_by_check
    CHECK (awarded_by IN ('auto', 'admin')),
  CONSTRAINT teacher_section_schedule_rdm_grants_section_occurrence_key
    UNIQUE (section_id, occurrence_at)
);

CREATE INDEX IF NOT EXISTS teacher_section_schedule_rdm_grants_teacher_id_idx
  ON public.teacher_section_schedule_rdm_grants (teacher_id, awarded_at DESC);

COMMENT ON TABLE public.teacher_section_schedule_rdm_grants IS
  'One grant per section schedule occurrence (Path A). Student join not required.';

ALTER TABLE public.teacher_section_schedule_rdm_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_section_schedule_rdm_grants_teacher_select
  ON public.teacher_section_schedule_rdm_grants;
CREATE POLICY teacher_section_schedule_rdm_grants_teacher_select
  ON public.teacher_section_schedule_rdm_grants
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE OR REPLACE FUNCTION public._parse_schedule_ymd(p_raw text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
  m text[];
BEGIN
  v := trim(coalesce(p_raw, ''));
  IF v = '' THEN RETURN NULL; END IF;
  IF v ~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN v::date; END IF;
  m := regexp_match(v, '^(\d{2})-(\d{2})-(\d{4})$');
  IF m IS NOT NULL THEN RETURN make_date(m[3]::int, m[2]::int, m[1]::int); END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._weekday_short_en(p_d date)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(to_char(p_d, 'Dy'));
$$;

CREATE OR REPLACE FUNCTION public._section_schedule_occurrence_start(
  p_day date,
  p_schedule_time text,
  p_time_zone text
)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_time time;
  v_tz text;
BEGIN
  IF p_day IS NULL OR trim(coalesce(p_schedule_time, '')) = '' THEN RETURN NULL; END IF;
  BEGIN
    v_time := p_schedule_time::time;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  v_tz := nullif(trim(coalesce(p_time_zone, '')), '');
  IF v_tz IS NULL THEN v_tz := 'Asia/Kolkata'; END IF;
  RETURN (p_day::timestamp + v_time) AT TIME ZONE v_tz;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_teacher_section_schedule_occurrence_rdm(
  p_section_id uuid,
  p_occurrence_at timestamptz,
  p_awarded_by text DEFAULT 'auto',
  p_force_before_end boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_section public.classroom_sections%ROWTYPE;
  v_room public.classrooms%ROWTYPE;
  v_existing public.teacher_section_schedule_rdm_grants%ROWTYPE;
  v_student_count integer := 0;
  v_capped integer := 0;
  v_base integer := 0;
  v_per_student integer := 0;
  v_student_bonus integer := 0;
  v_total integer := 0;
  v_cap integer := 50;
  v_duration integer := 60;
  v_end_at timestamptz;
  v_new_balance integer;
  v_awarded_by text;
BEGIN
  IF p_section_id IS NULL OR p_occurrence_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  v_awarded_by := CASE
    WHEN lower(trim(coalesce(p_awarded_by, ''))) = 'admin' THEN 'admin'
    ELSE 'auto'
  END;

  SELECT * INTO v_existing
  FROM public.teacher_section_schedule_rdm_grants g
  WHERE g.section_id = p_section_id AND g.occurrence_at = p_occurrence_at;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_awarded', true,
      'section_id', p_section_id,
      'occurrence_at', p_occurrence_at,
      'total_rdm', v_existing.total_rdm,
      'balance', (SELECT rdm FROM public.profiles WHERE id = v_existing.teacher_id)
    );
  END IF;

  SELECT * INTO v_section FROM public.classroom_sections s WHERE s.id = p_section_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'section_not_found');
  END IF;
  IF coalesce(v_section.is_active, true) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'section_inactive');
  END IF;

  SELECT * INTO v_room FROM public.classrooms c WHERE c.id = v_section.classroom_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'classroom_not_found');
  END IF;

  v_duration := GREATEST(coalesce(v_section.duration_minutes, 60), 1);
  v_end_at := p_occurrence_at + make_interval(mins => v_duration);
  IF NOT p_force_before_end AND v_end_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'occurrence_not_ended');
  END IF;

  SELECT count(*)::integer INTO v_student_count
  FROM public.classroom_members cm
  WHERE cm.classroom_id = v_section.classroom_id
    AND cm.role <> 'teacher'
    AND cm.section_id = v_section.id;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_base_rdm'), 100)
  INTO v_base;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_per_student_rdm'), 10)
  INTO v_per_student;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'teacher_live_class_student_cap'), 50)
  INTO v_cap;

  v_base := GREATEST(0, COALESCE(v_base, 100));
  v_per_student := GREATEST(0, COALESCE(v_per_student, 10));
  v_cap := GREATEST(0, COALESCE(v_cap, 50));
  v_capped := LEAST(GREATEST(v_student_count, 0), v_cap);
  v_student_bonus := v_capped * v_per_student;
  v_total := v_base + v_student_bonus;

  IF v_total <= 0 THEN
    INSERT INTO public.teacher_section_schedule_rdm_grants (
      teacher_id, classroom_id, section_id, occurrence_at,
      student_count, capped_student_count, base_rdm, per_student_rdm,
      student_bonus_rdm, total_rdm, awarded_by
    ) VALUES (
      v_room.teacher_id, v_section.classroom_id, v_section.id, p_occurrence_at,
      v_student_count, v_capped, v_base, v_per_student, v_student_bonus, 0, v_awarded_by
    );
    RETURN jsonb_build_object(
      'ok', true,
      'section_id', p_section_id,
      'occurrence_at', p_occurrence_at,
      'title', v_section.name,
      'total_rdm', 0,
      'skipped_zero', true
    );
  END IF;

  v_new_balance := public.add_rdm(v_room.teacher_id, v_total);

  INSERT INTO public.teacher_section_schedule_rdm_grants (
    teacher_id, classroom_id, section_id, occurrence_at,
    student_count, capped_student_count, base_rdm, per_student_rdm,
    student_bonus_rdm, total_rdm, awarded_by
  ) VALUES (
    v_room.teacher_id, v_section.classroom_id, v_section.id, p_occurrence_at,
    v_student_count, v_capped, v_base, v_per_student, v_student_bonus, v_total, v_awarded_by
  );

  RETURN jsonb_build_object(
    'ok', true,
    'section_id', p_section_id,
    'occurrence_at', p_occurrence_at,
    'title', v_section.name,
    'classroom_id', v_section.classroom_id,
    'total_rdm', v_total,
    'base_rdm', v_base,
    'student_bonus_rdm', v_student_bonus,
    'student_count', v_student_count,
    'capped_student_count', v_capped,
    'per_student_rdm', v_per_student,
    'balance', v_new_balance,
    'awarded_by', v_awarded_by,
    'source', 'section_schedule'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.award_eligible_section_schedule_delivery_rdm(p_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_sec record;
  v_anchor date;
  v_end_bound date;
  v_scan_from date;
  v_scan_to date;
  v_day date;
  v_occurrence_start timestamptz;
  v_occurrence_end timestamptz;
  v_result jsonb;
  v_awarded jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_grants_this_run integer := 0;
  v_max_grants integer := 40;
  v_repeat_days text[];
  v_weekday text;
BEGIN
  IF p_teacher_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_teacher');
  END IF;

  FOR v_sec IN
    SELECT s.*
    FROM public.classroom_sections s
    JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE c.teacher_id = p_teacher_id
      AND coalesce(s.is_active, true) = true
      AND trim(coalesce(s.schedule_date, '')) <> ''
      AND trim(coalesce(s.schedule_time, '')) <> ''
      AND coalesce(s.duration_minutes, 0) > 0
      AND (
        trim(coalesce(s.google_recurring_event_id, '')) <> ''
        OR coalesce(array_length(s.repeat_days, 1), 0) > 0
        OR trim(coalesce(s.schedule_date, '')) <> ''
      )
  LOOP
    EXIT WHEN v_grants_this_run >= v_max_grants;

    v_anchor := public._parse_schedule_ymd(v_sec.schedule_date);
    IF v_anchor IS NULL THEN CONTINUE; END IF;

    v_end_bound := public._parse_schedule_ymd(v_sec.schedule_end_date);
    v_scan_to := least(coalesce(v_end_bound, current_date), current_date);
    v_scan_from := greatest(v_anchor, v_scan_to - 90);

    v_repeat_days := coalesce(v_sec.repeat_days, ARRAY[]::text[]);

    v_day := v_scan_from;
    WHILE v_day <= v_scan_to AND v_grants_this_run < v_max_grants LOOP
      IF coalesce(array_length(v_repeat_days, 1), 0) = 0 THEN
        IF v_day <> v_anchor THEN
          v_day := v_day + 1;
          CONTINUE;
        END IF;
      ELSE
        v_weekday := public._weekday_short_en(v_day);
        IF NOT (v_weekday = ANY (v_repeat_days)) THEN
          v_day := v_day + 1;
          CONTINUE;
        END IF;
      END IF;

      v_occurrence_start := public._section_schedule_occurrence_start(
        v_day,
        v_sec.schedule_time,
        v_sec.google_time_zone
      );
      IF v_occurrence_start IS NULL OR v_occurrence_start < (
        public._section_schedule_occurrence_start(v_anchor, v_sec.schedule_time, v_sec.google_time_zone)
      ) THEN
        v_day := v_day + 1;
        CONTINUE;
      END IF;

      v_occurrence_end := v_occurrence_start + make_interval(mins => GREATEST(v_sec.duration_minutes, 1));
      IF v_occurrence_end > now() THEN
        v_day := v_day + 1;
        CONTINUE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.teacher_section_schedule_rdm_grants g
        WHERE g.section_id = v_sec.id AND g.occurrence_at = v_occurrence_start
      ) THEN
        v_result := public.award_teacher_section_schedule_occurrence_rdm(
          v_sec.id,
          v_occurrence_start,
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

      v_day := v_day + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'awarded_count', v_count, 'awards', v_awarded);
END;
$$;

-- Path B (extra live_sessions) is not eligible for delivery RDM.
CREATE OR REPLACE FUNCTION public.award_teacher_live_class_delivery_rdm(
  p_session_id uuid,
  p_awarded_by text DEFAULT 'auto',
  p_force_before_end boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', false,
    'error', 'extra_session_not_eligible',
    'hint', 'Delivery RDM applies to section/Google Calendar schedule (Path A), not extra Schedule Live Session rows.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.award_eligible_teacher_live_class_delivery_rdm(p_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN public.award_eligible_section_schedule_delivery_rdm(p_teacher_id);
END;
$$;

COMMENT ON FUNCTION public.award_teacher_section_schedule_occurrence_rdm IS
  'Grants delivery RDM for one ended section schedule occurrence (Path A).';

COMMENT ON FUNCTION public.award_eligible_section_schedule_delivery_rdm IS
  'Auto-grants Path A section schedule occurrences for a teacher (portal on load).';

REVOKE ALL ON FUNCTION public.award_teacher_section_schedule_occurrence_rdm(uuid, timestamptz, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_eligible_section_schedule_delivery_rdm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_teacher_section_schedule_occurrence_rdm(uuid, timestamptz, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_eligible_section_schedule_delivery_rdm(uuid) TO service_role;
