-- Close the student-session data leaks from the 30–31 Oct 2026 assessment.
-- Classrooms, rosters, DailyDose rows, and answer keys are no longer readable
-- by every signed-in student. Join and answer reveal are rate limited.

CREATE OR REPLACE FUNCTION public.caller_is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.caller_is_teacher_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    public.caller_is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) = 'teacher'
    );
$$;

REVOKE ALL ON FUNCTION public.caller_is_app_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.caller_is_teacher_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.caller_is_app_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.caller_is_teacher_or_admin() TO authenticated, service_role;

-- Classrooms: a student may read a class they belong to. A teacher may read their own.
DROP POLICY IF EXISTS "Allow authenticated to read classrooms for explore" ON public.classrooms;
DROP POLICY IF EXISTS "Classrooms readable by teacher or member" ON public.classrooms;
CREATE POLICY "Classrooms readable by teacher or member"
  ON public.classrooms
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = (SELECT auth.uid())
    OR public.user_is_member_of_classroom(id, (SELECT auth.uid()))
  );

-- Students must not add themselves to a class. Membership is created by the teacher
-- or by the approve-join route (service role).
DROP POLICY IF EXISTS "Users can join classroom as student" ON public.classroom_members;

-- Role rows are assigned by the service role, not by the signed-in user.
DROP POLICY IF EXISTS "Users can insert own user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own user_roles" ON public.user_roles;

-- DailyDose attempts: own rows only. The leaderboard function is security definer.
DROP POLICY IF EXISTS "Authenticated can read daily_gauntlet_attempts" ON public.daily_gauntlet_attempts;
CREATE POLICY "Users read own daily_gauntlet_attempts"
  ON public.daily_gauntlet_attempts
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Reward amounts the product screens read. Other keys stay admin-only.
DROP POLICY IF EXISTS "rdm_config_select_all" ON public.rdm_config;
DROP POLICY IF EXISTS "rdm_config_select_authenticated" ON public.rdm_config;
CREATE POLICY "rdm_config_select_authenticated"
  ON public.rdm_config
  FOR SELECT
  TO authenticated
  USING (
    public.caller_is_app_admin()
    OR key = ANY (ARRAY[
      'referral_referrer_reward',
      'referral_referee_welcome',
      'referral_weekly_bonus_threshold',
      'referral_weekly_bonus_rdm',
      'referral_teacher_signup_reward',
      'referral_teacher_student_signup_reward',
      'referral_teacher_paid_bonus',
      'referral_teacher_paid_window_days',
      'challenge_5_win',
      'challenge_5_share',
      'challenge_10_win',
      'challenge_10_share',
      'challenge_20_win',
      'challenge_20_share',
      'challenge_50_win',
      'challenge_50_share',
      'refer_challenge_daily_rdm_cap',
      'redeem_practice_packs_from_rdm',
      'redeem_mock_tests_from_rdm',
      'redeem_analytics_pro_from_rdm',
      'redeem_edufund_entry_from_rdm',
      'play_dailydose_academic_rdm',
      'play_dailydose_funbrain_rdm',
      'play_dual_streak_7_rdm',
      'play_dual_streak_30_rdm',
      'study_streak_bonus_days',
      'study_streak_bonus_rdm',
      'play_dailydose_min_questions_for_rdm',
      'subtopic_quiz_set_rdm',
      'subtopic_quiz_advanced_rdm',
      'subtopic_numerals_formula_rdm',
      'subtopic_numerals_pack_rdm',
      'quiz_community_share_rdm',
      'numerals_community_share_rdm',
      'gyan_post_rdm',
      'gyan_comment_rdm',
      'gyan_upvote_rdm',
      'gyan_save_rdm',
      'gyan_teacher_answer_rdm',
      'teacher_profile_welcome_rdm',
      'free_trial_welcome_rdm',
      'free_trial_inactive_penalty_rdm',
      'free_inactive_penalty_rdm',
      'starter_inactive_penalty_rdm',
      'pro_inactive_penalty_rdm',
      'free_trial_checklist_reward_rdm',
      'free_trial_daily_streak_reward_rdm',
      'classroom_batch_paid_window_days',
      'classroom_bulk_invite_min_students',
      'classroom_bulk_invite_flat_rdm',
      'classroom_batch_paid_bonus_rdm',
      'magic_wall_max_topics',
      'screenshot_filter_enabled',
      'mock_score_bonus_rdm',
      'mock_community_share_rdm',
      'cbse_mcq_community_share_rdm',
      'free_subject_chat_messages_per_day',
      'free_trial_subject_chat_messages_per_day',
      'starter_subject_chat_messages_per_day',
      'pro_subject_chat_messages_per_day',
      'free_subject_chat_multilingual',
      'free_trial_subject_chat_multilingual',
      'starter_subject_chat_multilingual',
      'pro_subject_chat_multilingual',
      'free_lessons_chapter_limit',
      'free_trial_lessons_chapter_limit',
      'starter_lessons_chapter_limit',
      'pro_lessons_chapter_limit',
      'free_instacue_card_limit',
      'free_trial_instacue_card_limit',
      'starter_instacue_card_limit',
      'pro_instacue_card_limit',
      'free_saved_bit_limit',
      'free_trial_saved_bit_limit',
      'starter_saved_bit_limit',
      'pro_saved_bit_limit',
      'free_saved_formula_limit',
      'free_trial_saved_formula_limit',
      'starter_saved_formula_limit',
      'pro_saved_formula_limit',
      'free_saved_question_limit',
      'free_trial_saved_question_limit',
      'starter_saved_question_limit',
      'pro_saved_question_limit',
      'free_mocks_per_month',
      'free_trial_mocks_per_month',
      'starter_mocks_per_month',
      'pro_mocks_per_month',
      'free_daily_dose_questions_per_day',
      'free_trial_daily_dose_questions_per_day',
      'starter_daily_dose_questions_per_day',
      'pro_daily_dose_questions_per_day',
      'free_buddies_limit',
      'free_trial_buddies_limit',
      'starter_buddies_limit',
      'pro_buddies_limit',
      'free_rdm_multiplier_pct',
      'free_trial_rdm_multiplier_pct',
      'starter_rdm_multiplier_months_1_3_pct',
      'starter_rdm_multiplier_months_4_plus_pct',
      'pro_rdm_multiplier_months_1_5_pct',
      'pro_rdm_multiplier_months_6_11_pct',
      'pro_rdm_multiplier_months_12_plus_pct',
      'free_trial_duration_days',
      'free_trial_streak_extension_days',
      'free_trial_streak_days_required',
      'free_plan_max_months',
      'free_magic_wall_max_active_topics',
      'free_magic_wall_monthly_attempts',
      'free_trial_magic_wall_max_active_topics',
      'free_trial_magic_wall_monthly_attempts',
      'starter_magic_wall_max_active_topics',
      'starter_magic_wall_monthly_attempts',
      'pro_magic_wall_max_active_topics',
      'pro_magic_wall_monthly_attempts',
      'free_gyan_doubts_per_day',
      'free_trial_gyan_doubts_per_day',
      'starter_gyan_doubts_per_day',
      'pro_gyan_doubts_per_day'
    ]::text[])
  );

CREATE TABLE IF NOT EXISTS public.join_code_lookup_attempts (
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.join_code_lookup_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.join_code_lookup_attempts FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.assessment_reveal_events (
  user_id uuid NOT NULL,
  units integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_reveal_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.assessment_reveal_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_reveal_budget(p_user uuid, p_units integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_used integer;
BEGIN
  IF p_user IS NULL OR p_units IS NULL OR p_units < 1 THEN
    RETURN false;
  END IF;
  DELETE FROM public.assessment_reveal_events
  WHERE user_id = p_user
    AND created_at < now() - interval '10 minutes';
  SELECT COALESCE(SUM(units), 0) INTO v_used
  FROM public.assessment_reveal_events
  WHERE user_id = p_user
    AND created_at >= now() - interval '10 minutes';
  IF v_used + p_units > 400 THEN
    RETURN false;
  END IF;
  INSERT INTO public.assessment_reveal_events (user_id, units)
  VALUES (p_user, p_units);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_reveal_budget(uuid, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.lookup_classroom_by_join_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_code text;
  v_user uuid := auth.uid();
  v_recent integer;
  v_row public.classrooms%ROWTYPE;
BEGIN
  v_code := upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g'));
  IF length(v_code) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF v_user IS NOT NULL THEN
    DELETE FROM public.join_code_lookup_attempts
    WHERE user_id = v_user
      AND created_at < now() - interval '10 minutes';
    SELECT COUNT(*) INTO v_recent
    FROM public.join_code_lookup_attempts
    WHERE user_id = v_user
      AND created_at >= now() - interval '10 minutes';
    IF v_recent >= 20 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
    END IF;
    INSERT INTO public.join_code_lookup_attempts (user_id) VALUES (v_user);
  END IF;

  SELECT * INTO v_row
  FROM public.classrooms
  WHERE upper(trim(join_code)) = v_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'classroom', null);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'classroom', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'subject', v_row.subject,
      'section', v_row.section,
      'teacher_id', v_row.teacher_id,
      'description', v_row.description,
      'type', v_row.type,
      'intro_video_url', v_row.intro_video_url,
      'allow_adhoc_trial', v_row.allow_adhoc_trial
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_classroom_preview(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.classrooms%ROWTYPE;
  v_visibility text;
BEGIN
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_id');
  END IF;

  SELECT * INTO v_row FROM public.classrooms WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'classroom', null);
  END IF;

  SELECT lower(trim(coalesce(p.visibility, 'public'))) INTO v_visibility
  FROM public.profiles p
  WHERE p.id = v_row.teacher_id;

  IF v_user IS NULL
     OR (
       v_row.teacher_id IS DISTINCT FROM v_user
       AND NOT public.user_is_member_of_classroom(v_row.id, v_user)
       AND coalesce(v_visibility, 'public') = 'invite_only'
     ) THEN
    RETURN jsonb_build_object('ok', true, 'classroom', null);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'classroom', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'subject', v_row.subject,
      'section', v_row.section,
      'teacher_id', v_row.teacher_id,
      'description', v_row.description,
      'type', v_row.type,
      'intro_video_url', v_row.intro_video_url,
      'allow_adhoc_trial', v_row.allow_adhoc_trial
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_classroom_preview(uuid) TO authenticated, service_role;

-- Answer keys stay in the table for the service role and for these functions.
REVOKE SELECT (solution_html, correct_letter) ON TABLE public.mock_questions FROM anon, authenticated;
REVOKE SELECT (solution_html, correct_letter) ON TABLE public.past_paper_questions FROM anon, authenticated;
REVOKE SELECT (correct_answer_index, explanation) ON TABLE public.play_questions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.grade_catalog_answers(p_source text, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count integer;
  v_item jsonb;
  v_id uuid;
  v_selected integer;
  v_letter text;
  v_solution text;
  v_correct_index integer;
  v_out jsonb := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('mock', 'past_paper') OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  v_count := jsonb_array_length(p_answers);
  IF v_count < 1 OR v_count > 120 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;
  IF NOT public.consume_reveal_budget(v_user, v_count) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_answers)
  LOOP
    BEGIN
      v_id := (v_item->>'id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      CONTINUE;
    END;
    BEGIN
      v_selected := NULLIF(v_item->>'selected', '')::integer;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      v_selected := NULL;
    END;
    v_letter := NULL;
    v_solution := NULL;

    IF p_source = 'mock' THEN
      SELECT q.correct_letter, q.solution_html
      INTO v_letter, v_solution
      FROM public.mock_questions q
      WHERE q.id = v_id;
    ELSE
      SELECT q.correct_letter, q.solution_html
      INTO v_letter, v_solution
      FROM public.past_paper_questions q
      WHERE q.id = v_id;
    END IF;

    IF v_letter IS NULL THEN
      CONTINUE;
    END IF;

    v_correct_index := ascii(upper(left(trim(v_letter), 1))) - 65;
    IF v_correct_index < 0 OR v_correct_index > 3 THEN
      v_correct_index := 0;
    END IF;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'correct_index', v_correct_index,
      'solution_html', v_solution,
      'is_correct', v_selected IS NOT NULL AND v_selected = v_correct_index
    ));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'results', v_out);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grade_catalog_answers(text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_play_answer(p_question_id uuid, p_selected_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_correct integer;
  v_explanation text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;
  IF NOT public.consume_reveal_budget(v_user, 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  SELECT q.correct_answer_index, q.explanation
  INTO v_correct, v_explanation
  FROM public.play_questions q
  WHERE q.id = p_question_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'is_correct', p_selected_index IS NOT NULL AND p_selected_index = v_correct,
    'correct_index', v_correct,
    'explanation', v_explanation
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_play_answer(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.teacher_mock_question_bank(p_paper_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;
  IF NOT public.caller_is_teacher_or_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_paper_ids IS NULL OR cardinality(p_paper_ids) < 1 OR cardinality(p_paper_ids) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id,
        'paper_id', q.paper_id,
        'sort_order', q.sort_order,
        'subject', q.subject,
        'topic', q.topic,
        'chapter', q.chapter,
        'difficulty', q.difficulty,
        'question_html', q.question_html,
        'solution_html', q.solution_html,
        'correct_letter', q.correct_letter,
        'options_json', q.options_json
      ) ORDER BY q.sort_order)
      FROM public.mock_questions q
      WHERE q.paper_id = ANY (p_paper_ids)
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.teacher_mock_question_bank(uuid[]) TO authenticated, service_role;

-- The adaptive picker stays, but its public result no longer includes the answer key.
ALTER FUNCTION public.get_adaptive_play_questions(text, text, integer)
  RENAME TO get_adaptive_play_questions_internal;

CREATE OR REPLACE FUNCTION public.get_adaptive_play_questions(
  p_domain text,
  p_category text,
  p_count integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  content jsonb,
  options jsonb,
  correct_answer_index integer,
  explanation text,
  difficulty_rating integer,
  category text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    q.id,
    q.content,
    q.options,
    NULL::integer,
    NULL::text,
    q.difficulty_rating,
    q.category
  FROM public.get_adaptive_play_questions_internal(p_domain, p_category, p_count) q;
$$;

REVOKE ALL ON FUNCTION public.get_adaptive_play_questions_internal(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_adaptive_play_questions(text, text, integer) TO authenticated, service_role;
