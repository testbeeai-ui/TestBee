-- Prefer live_class_slots.duration_minutes for delivery RDM end-time (matches scanner + quality award).

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
  v_slot_duration integer;
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

  SELECT ls.duration_minutes INTO v_slot_duration
  FROM public.live_class_slots ls
  WHERE ls.section_id = p_section_id
    AND ls.slot_at = p_occurrence_at
    AND ls.status = 'scheduled'
  LIMIT 1;

  IF FOUND AND v_slot_duration IS NOT NULL THEN
    v_duration := GREATEST(v_slot_duration, 1);
  END IF;

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
    'student_count', v_student_count,
    'capped_student_count', v_capped,
    'base_rdm', v_base,
    'per_student_rdm', v_per_student,
    'student_bonus_rdm', v_student_bonus,
    'total_rdm', v_total,
    'balance', v_new_balance
  );
END;
$$;

COMMENT ON FUNCTION public.award_teacher_section_schedule_occurrence_rdm IS
  'Grants delivery RDM for a section occurrence; prefers live_class_slots.duration_minutes when booked via slot flow.';
