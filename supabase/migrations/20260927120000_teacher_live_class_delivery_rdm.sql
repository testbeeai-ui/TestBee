-- Teacher live class delivery RDM:
-- +base per conducted session, +per-student bonus (capped) for enrolled students in scope.
-- Student live join/attendance is NOT required; bonus uses enrolled roster only.

INSERT INTO public.rdm_config (key, value, description) VALUES
  (
    'teacher_live_class_base_rdm',
    100,
    'RDM credited to teacher per live class conducted (delivery reward base)'
  ),
  (
    'teacher_live_class_per_student_rdm',
    10,
    'RDM per enrolled student in class/section when live class delivery reward is granted (roster, not attendance)'
  ),
  (
    'teacher_live_class_student_cap',
    50,
    'Max students counted for per-student live class delivery bonus (prevents inflation)'
  )
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.teacher_live_class_rdm_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_count integer NOT NULL DEFAULT 0,
  capped_student_count integer NOT NULL DEFAULT 0,
  base_rdm integer NOT NULL DEFAULT 0,
  per_student_rdm integer NOT NULL DEFAULT 0,
  student_bonus_rdm integer NOT NULL DEFAULT 0,
  total_rdm integer NOT NULL DEFAULT 0,
  awarded_by text NOT NULL DEFAULT 'auto',
  awarded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_live_class_rdm_grants_awarded_by_check
    CHECK (awarded_by IN ('auto', 'admin'))
);

CREATE INDEX IF NOT EXISTS teacher_live_class_rdm_grants_teacher_id_idx
  ON public.teacher_live_class_rdm_grants (teacher_id, awarded_at DESC);

COMMENT ON TABLE public.teacher_live_class_rdm_grants IS
  'Idempotent ledger: one delivery RDM grant per live_sessions row when a class is conducted. No student join required.';

ALTER TABLE public.teacher_live_class_rdm_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_live_class_rdm_grants_teacher_select
  ON public.teacher_live_class_rdm_grants;
CREATE POLICY teacher_live_class_rdm_grants_teacher_select
  ON public.teacher_live_class_rdm_grants
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

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
DECLARE
  v_session public.live_sessions%ROWTYPE;
  v_existing public.teacher_live_class_rdm_grants%ROWTYPE;
  v_student_count integer := 0;
  v_capped integer := 0;
  v_base integer := 0;
  v_per_student integer := 0;
  v_student_bonus integer := 0;
  v_total integer := 0;
  v_cap integer := 50;
  v_end_at timestamptz;
  v_new_balance integer;
  v_awarded_by text;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  v_awarded_by := CASE
    WHEN lower(trim(coalesce(p_awarded_by, ''))) = 'admin' THEN 'admin'
    ELSE 'auto'
  END;

  SELECT * INTO v_existing
  FROM public.teacher_live_class_rdm_grants g
  WHERE g.session_id = p_session_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_awarded', true,
      'session_id', p_session_id,
      'total_rdm', v_existing.total_rdm,
      'balance', (SELECT rdm FROM public.profiles WHERE id = v_existing.teacher_id)
    );
  END IF;

  SELECT * INTO v_session
  FROM public.live_sessions ls
  WHERE ls.id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  IF lower(trim(coalesce(v_session.status, ''))) = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_cancelled');
  END IF;

  v_end_at := v_session.scheduled_at + make_interval(mins => GREATEST(v_session.duration_minutes, 0));
  IF NOT p_force_before_end AND v_end_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_ended');
  END IF;

  -- Enrolled roster in scope (whole class or section); live_session_joins NOT consulted.
  SELECT count(*)::integer INTO v_student_count
  FROM public.classroom_members cm
  WHERE cm.classroom_id = v_session.classroom_id
    AND cm.role <> 'teacher'
    AND (
      v_session.section_id IS NULL
      OR cm.section_id = v_session.section_id
    );

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
    INSERT INTO public.teacher_live_class_rdm_grants (
      session_id,
      teacher_id,
      classroom_id,
      student_count,
      capped_student_count,
      base_rdm,
      per_student_rdm,
      student_bonus_rdm,
      total_rdm,
      awarded_by
    ) VALUES (
      v_session.id,
      v_session.teacher_id,
      v_session.classroom_id,
      v_student_count,
      v_capped,
      v_base,
      v_per_student,
      v_student_bonus,
      0,
      v_awarded_by
    );

    RETURN jsonb_build_object(
      'ok', true,
      'session_id', v_session.id,
      'total_rdm', 0,
      'skipped_zero', true,
      'student_count', v_student_count,
      'capped_student_count', v_capped
    );
  END IF;

  v_new_balance := public.add_rdm(v_session.teacher_id, v_total);

  INSERT INTO public.teacher_live_class_rdm_grants (
    session_id,
    teacher_id,
    classroom_id,
    student_count,
    capped_student_count,
    base_rdm,
    per_student_rdm,
    student_bonus_rdm,
    total_rdm,
    awarded_by
  ) VALUES (
    v_session.id,
    v_session.teacher_id,
    v_session.classroom_id,
    v_student_count,
    v_capped,
    v_base,
    v_per_student,
    v_student_bonus,
    v_total,
    v_awarded_by
  );

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'title', v_session.title,
    'total_rdm', v_total,
    'base_rdm', v_base,
    'student_bonus_rdm', v_student_bonus,
    'student_count', v_student_count,
    'capped_student_count', v_capped,
    'per_student_rdm', v_per_student,
    'balance', v_new_balance,
    'awarded_by', v_awarded_by
  );
END;
$$;

COMMENT ON FUNCTION public.award_teacher_live_class_delivery_rdm(uuid, text, boolean) IS
  'Grants delivery RDM for one live session (idempotent). Requires session end time unless admin forces. Student join not required.';

CREATE OR REPLACE FUNCTION public.award_eligible_teacher_live_class_delivery_rdm(p_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_session_id uuid;
  v_result jsonb;
  v_awarded jsonb := '[]'::jsonb;
  v_count integer := 0;
BEGIN
  IF p_teacher_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_teacher');
  END IF;

  FOR v_session_id IN
    SELECT ls.id
    FROM public.live_sessions ls
    LEFT JOIN public.teacher_live_class_rdm_grants g ON g.session_id = ls.id
    WHERE ls.teacher_id = p_teacher_id
      AND lower(trim(coalesce(ls.status, ''))) <> 'cancelled'
      AND g.id IS NULL
      AND (ls.scheduled_at + make_interval(mins => GREATEST(ls.duration_minutes, 0))) <= now()
    ORDER BY ls.scheduled_at ASC
    LIMIT 25
  LOOP
    v_result := public.award_teacher_live_class_delivery_rdm(v_session_id, 'auto', false);
    IF coalesce((v_result->>'ok')::boolean, false)
       AND coalesce((v_result->>'already_awarded')::boolean, false) = false
       AND coalesce((v_result->>'total_rdm')::integer, 0) > 0 THEN
      v_awarded := v_awarded || jsonb_build_array(v_result);
      v_count := v_count + 1;
    ELSIF coalesce((v_result->>'ok')::boolean, false)
       AND coalesce((v_result->>'already_awarded')::boolean, false) = false
       AND coalesce((v_result->>'skipped_zero')::boolean, false) = true THEN
      v_awarded := v_awarded || jsonb_build_array(v_result);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'awarded_count', v_count, 'awards', v_awarded);
END;
$$;

COMMENT ON FUNCTION public.award_eligible_teacher_live_class_delivery_rdm(uuid) IS
  'Auto-grants delivery RDM for ended live sessions without a prior grant (teacher portal on load).';

REVOKE ALL ON FUNCTION public.award_teacher_live_class_delivery_rdm(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_eligible_teacher_live_class_delivery_rdm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_teacher_live_class_delivery_rdm(uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_eligible_teacher_live_class_delivery_rdm(uuid) TO service_role;
