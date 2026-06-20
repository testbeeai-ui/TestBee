-- Squashed schema baseline (structure only — NO row data).
-- Generated from production snapshot bytsiknhtcnlxwzgqkrd on 2026-06-15.
--
-- PRODUCTION (bytsiknhtcnlxwzgqkrd): mark applied via migration repair ONLY.
--   Do NOT re-run this file on prod — data (lessons, mocks, past papers, curriculum) stays as-is.
--
-- Fresh local DB: creates empty tables; load reference/content via existing import scripts
--   (curriculum seeds, CBSE MCQ import, past-paper JSON import, play packs, etc.).
--
-- Archived incremental history: scripts/legacy/migrations/pre-squash-2026/




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'teacher',
    'student'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "public"."_bits_attempt_key"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic" "text", "p_set" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    public._norm_attempt_key_part(p_board, 40)
    || '||'
    || public._norm_attempt_key_part(p_subject, 80)
    || '||'
    || p_class_level::text
    || '||'
    || public._norm_attempt_key_part(p_topic, 300)
    || '||'
    || public._norm_attempt_key_part(p_subtopic, 300)
    || '||'
    || public._norm_attempt_key_part('advanced', 30)
    || '||set:'
    || p_set::text;
$$;


ALTER FUNCTION "public"."_bits_attempt_key"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic" "text", "p_set" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_bits_sanitize_key_part"("p" "text", "maxlen" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT LEFT(
    LOWER(
      trim(
        both ' '
        FROM regexp_replace(
          regexp_replace(coalesce(p, ''), '[[:cntrl:]]', ' ', 'g'),
          '[[:space:]]+',
          ' ',
          'g'
        )
      )
    ),
    maxlen
  );
$$;


ALTER FUNCTION "public"."_bits_sanitize_key_part"("p" "text", "maxlen" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_formula_practice_attempt_key"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text", "p_formula_idx" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT public._bits_sanitize_key_part(p_board, 40)
    || '||'
    || public._bits_sanitize_key_part(p_subject, 80)
    || '||'
    || p_class_level::text
    || '||'
    || public._bits_sanitize_key_part(p_topic, 300)
    || '||'
    || public._bits_sanitize_key_part(p_subtopic_name, 300)
    || '||'
    || public._bits_sanitize_key_part(p_level, 30)
    || '||fp:'
    || p_formula_idx::text;
$$;


ALTER FUNCTION "public"."_formula_practice_attempt_key"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text", "p_formula_idx" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_free_trial_daily_task_ids"() RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT ARRAY['t1', 't2', 't3', 't4', 't5', 't6']::text[];
$$;


ALTER FUNCTION "public"."_free_trial_daily_task_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_free_trial_daily_tasks_valid"("p_tasks" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p_tasks IS NOT NULL
    AND array_length(p_tasks, 1) = 6
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(public._free_trial_daily_task_ids()) AS required(task_id)
      WHERE NOT (required.task_id = ANY (p_tasks))
    )
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(p_tasks) AS provided(task_id)
      WHERE provided.task_id <> ALL (public._free_trial_daily_task_ids())
    );
$$;


ALTER FUNCTION "public"."_free_trial_daily_tasks_valid"("p_tasks" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_free_trial_day2_unlock_at"("p_claimed_at" timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT (
    date_trunc('day', p_claimed_at AT TIME ZONE 'UTC')
    + interval '1 day'
    + interval '9 hours'
  ) AT TIME ZONE 'UTC';
$$;


ALTER FUNCTION "public"."_free_trial_day2_unlock_at"("p_claimed_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_free_trial_next_streak_day"("p_state" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_day integer;
BEGIN
  FOR v_day IN 2..10 LOOP
    IF COALESCE(p_state -> v_day::text ->> 'claimed_at', '') = '' THEN
      RETURN v_day;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."_free_trial_next_streak_day"("p_state" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_free_trial_onboarding_all_complete"("p_progress" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(public._free_trial_onboarding_task_ids()) AS tid(task_id)
    WHERE CASE
      WHEN tid.task_id = 'gyan_plus' THEN NOT public._gyan_plus_onboarding_complete(p_progress)
      ELSE COALESCE((p_progress ->> tid.task_id)::boolean, false) IS NOT TRUE
    END
  );
$$;


ALTER FUNCTION "public"."_free_trial_onboarding_all_complete"("p_progress" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_free_trial_onboarding_task_ids"() RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT ARRAY[
    'magic_wall',
    'lessons',
    'prep_classes',
    'prep_mcq',
    'gyan_plus',
    'earn_buddy',
    'earn_challenge',
    'news_blog',
    'edufund',
    'profile'
  ]::text[];
$$;


ALTER FUNCTION "public"."_free_trial_onboarding_task_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_free_trial_streak_active_day"("p_state" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN public._free_trial_next_streak_day(COALESCE(p_state, '{}'::jsonb));
END;
$$;


ALTER FUNCTION "public"."_free_trial_streak_active_day"("p_state" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_free_trial_streak_day_task_ids"("p_state" "jsonb", "p_day_key" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT jsonb_array_elements_text(
        COALESCE(p_state -> p_day_key -> 'task_ids', '[]'::jsonb)
      )
    ),
    ARRAY[]::text[]
  );
$$;


ALTER FUNCTION "public"."_free_trial_streak_day_task_ids"("p_state" "jsonb", "p_day_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_free_trial_trial_day_number"("p_claimed_at" timestamp with time zone, "p_now" timestamp with time zone DEFAULT "now"()) RETURNS integer
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_unlock timestamptz;
  v_diff_days integer;
BEGIN
  IF p_claimed_at IS NULL THEN
    RETURN 1;
  END IF;

  v_unlock := public._free_trial_day2_unlock_at(p_claimed_at);
  IF p_now < v_unlock THEN
    RETURN 1;
  END IF;

  v_diff_days := floor(extract(epoch FROM (p_now - v_unlock)) / 86400.0)::integer;
  RETURN least(10, 2 + v_diff_days);
END;
$$;


ALTER FUNCTION "public"."_free_trial_trial_day_number"("p_claimed_at" timestamp with time zone, "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_gyan_plus_onboarding_complete"("p_progress" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE((p_progress ->> 'gyan_plus')::boolean, false)
    OR (
      COALESCE((p_progress ->> 'gyan_browse')::boolean, false)
      AND COALESCE((p_progress ->> 'gyan_post')::boolean, false)
      AND COALESCE((p_progress ->> 'gyan_engagement')::boolean, false)
    );
$$;


ALTER FUNCTION "public"."_gyan_plus_onboarding_complete"("p_progress" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_js_int32_wrap"("x" bigint) RETURNS bigint
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT (
    CASE
      WHEN ((x % 4294967296) + 4294967296) % 4294967296 >= 2147483648
      THEN ((x % 4294967296) + 4294967296) % 4294967296 - 4294967296
      ELSE ((x % 4294967296) + 4294967296) % 4294967296
    END
  )::bigint;
$$;


ALTER FUNCTION "public"."_js_int32_wrap"("x" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_legacy_sanitize_lookup"("t" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    btrim(
      regexp_replace(
        regexp_replace(coalesce(t, ''), '[<>\x00-\x1F\x7F]', ' ', 'g'),
        '\s+',
        ' ',
        'g'
      )
    );
$$;


ALTER FUNCTION "public"."_legacy_sanitize_lookup"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_norm_attempt_key_part"("t" "text", "max_len" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT lower(
    left(
      btrim(regexp_replace(regexp_replace(coalesce(t, ''), '[\x00-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g')),
      greatest(1, least(max_len, 600))
    )
  );
$$;


ALTER FUNCTION "public"."_norm_attempt_key_part"("t" "text", "max_len" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_norm_content_key"("t" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    left(
      btrim(regexp_replace(regexp_replace(coalesce(t, ''), '[\x00-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g')),
      600
    );
$$;


ALTER FUNCTION "public"."_norm_content_key"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_norm_subject_key"("t" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT lower(public._norm_content_key(t));
$$;


ALTER FUNCTION "public"."_norm_subject_key"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invite RECORD;
  v_acceptor_onboarded boolean;
  v_pair_id uuid;
  v_referral_credited boolean := false;
  v_already_paired boolean := false;
  v_acceptor_buddy_count int;
  v_inviter_buddy_count int;
  v_max_buddies int := 5;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT id, inviter_user_id, status, expires_at, accepted_by_user_id
    INTO v_invite
  FROM public.buddy_invites
  WHERE token = p_token
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_accepted');
  END IF;

  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;

  IF v_invite.expires_at <= now() THEN
    UPDATE public.buddy_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF v_invite.inviter_user_id = p_acceptor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_invite');
  END IF;

  SELECT onboarding_complete INTO v_acceptor_onboarded
  FROM public.profiles WHERE id = p_acceptor_id;
  IF v_acceptor_onboarded IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_incomplete');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.study_buddies
    WHERE status = 'active'
      AND user_id = p_acceptor_id
      AND buddy_user_id = v_invite.inviter_user_id
  ) THEN
    v_already_paired := true;
  END IF;

  IF NOT v_already_paired THEN
    SELECT count(*)::int INTO v_acceptor_buddy_count
    FROM public.study_buddies
    WHERE user_id = p_acceptor_id AND status = 'active';

    SELECT count(*)::int INTO v_inviter_buddy_count
    FROM public.study_buddies
    WHERE user_id = v_invite.inviter_user_id AND status = 'active';

    IF v_acceptor_buddy_count >= v_max_buddies THEN
      RETURN jsonb_build_object('ok', false, 'error', 'acceptor_buddy_limit');
    END IF;

    IF v_inviter_buddy_count >= v_max_buddies THEN
      RETURN jsonb_build_object('ok', false, 'error', 'inviter_buddy_limit');
    END IF;

    INSERT INTO public.study_buddies (user_id, buddy_user_id, status)
    VALUES (p_acceptor_id, v_invite.inviter_user_id, 'active')
    ON CONFLICT (user_id, buddy_user_id) DO UPDATE SET status = 'active', ended_at = NULL
    RETURNING id INTO v_pair_id;

    INSERT INTO public.study_buddies (user_id, buddy_user_id, status)
    VALUES (v_invite.inviter_user_id, p_acceptor_id, 'active')
    ON CONFLICT (user_id, buddy_user_id) DO UPDATE SET status = 'active', ended_at = NULL;
  END IF;

  UPDATE public.buddy_invites
     SET status = 'accepted',
         accepted_by_user_id = p_acceptor_id,
         accepted_at = now()
   WHERE id = v_invite.id AND status = 'pending';

  IF NOT EXISTS (SELECT 1 FROM public.referral_attributions WHERE referee_user_id = p_acceptor_id) THEN
    BEGIN
      PERFORM public.claim_referral_attribution(
        upper(substr(replace(v_invite.inviter_user_id::text, '-', ''), 1, 7)),
        p_acceptor_id
      );
      v_referral_credited := true;
    EXCEPTION WHEN OTHERS THEN
      v_referral_credited := false;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pairId', v_pair_id,
    'alreadyPaired', v_already_paired,
    'referralCredited', v_referral_credited
  );
END;
$$;


ALTER FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid") IS 'Called with service_role only. Pairs both sides into study_buddies and (if first-time) also credits referral RDM via claim_referral_attribution.';



CREATE OR REPLACE FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid", "p_acceptor_max" integer DEFAULT 5, "p_inviter_max" integer DEFAULT 5) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invite RECORD;
  v_acceptor_onboarded boolean;
  v_pair_id uuid;
  v_referral_credited boolean := false;
  v_already_paired boolean := false;
  v_acceptor_buddy_count int;
  v_inviter_buddy_count int;
  v_acceptor_max int;
  v_inviter_max int;
BEGIN
  v_acceptor_max := GREATEST(0, COALESCE(p_acceptor_max, 5));
  v_inviter_max := GREATEST(0, COALESCE(p_inviter_max, 5));

  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT id, inviter_user_id, status, expires_at, accepted_by_user_id
    INTO v_invite
  FROM public.buddy_invites
  WHERE token = p_token
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_accepted');
  END IF;

  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;

  IF v_invite.expires_at <= now() THEN
    UPDATE public.buddy_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF v_invite.inviter_user_id = p_acceptor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_invite');
  END IF;

  SELECT onboarding_complete INTO v_acceptor_onboarded
  FROM public.profiles WHERE id = p_acceptor_id;
  IF v_acceptor_onboarded IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_incomplete');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.study_buddies
    WHERE status = 'active'
      AND user_id = p_acceptor_id
      AND buddy_user_id = v_invite.inviter_user_id
  ) THEN
    v_already_paired := true;
  END IF;

  IF NOT v_already_paired THEN
    SELECT count(*)::int INTO v_acceptor_buddy_count
    FROM public.study_buddies
    WHERE user_id = p_acceptor_id AND status = 'active';

    SELECT count(*)::int INTO v_inviter_buddy_count
    FROM public.study_buddies
    WHERE user_id = v_invite.inviter_user_id AND status = 'active';

    IF v_acceptor_max = 0 OR v_acceptor_buddy_count >= v_acceptor_max THEN
      RETURN jsonb_build_object('ok', false, 'error', 'acceptor_buddy_limit');
    END IF;

    IF v_inviter_max = 0 OR v_inviter_buddy_count >= v_inviter_max THEN
      RETURN jsonb_build_object('ok', false, 'error', 'inviter_buddy_limit');
    END IF;

    INSERT INTO public.study_buddies (user_id, buddy_user_id, status)
    VALUES (p_acceptor_id, v_invite.inviter_user_id, 'active')
    ON CONFLICT (user_id, buddy_user_id) DO UPDATE SET status = 'active', ended_at = NULL
    RETURNING id INTO v_pair_id;

    INSERT INTO public.study_buddies (user_id, buddy_user_id, status)
    VALUES (v_invite.inviter_user_id, p_acceptor_id, 'active')
    ON CONFLICT (user_id, buddy_user_id) DO UPDATE SET status = 'active', ended_at = NULL;
  END IF;

  UPDATE public.buddy_invites
     SET status = 'accepted',
         accepted_by_user_id = p_acceptor_id,
         accepted_at = now()
   WHERE id = v_invite.id AND status = 'pending';

  IF NOT EXISTS (SELECT 1 FROM public.referral_attributions WHERE referee_user_id = p_acceptor_id) THEN
    BEGIN
      PERFORM public.claim_referral_attribution(
        upper(substr(replace(v_invite.inviter_user_id::text, '-', ''), 1, 7)),
        p_acceptor_id
      );
      v_referral_credited := true;
    EXCEPTION WHEN OTHERS THEN
      v_referral_credited := false;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pairId', v_pair_id,
    'alreadyPaired', v_already_paired,
    'referralCredited', v_referral_credited
  );
END;
$$;


ALTER FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid", "p_acceptor_max" integer, "p_inviter_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_doubt_answer"("p_doubt_id" "uuid", "p_answer_id" "uuid", "p_bonus_rdm" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_doubt_user_id uuid;
  v_answer_user_id uuid;
  v_bounty integer;
  v_base integer := 10;
  v_gross integer;
  v_tax integer;
  v_net integer;
  v_payouts_today integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT user_id INTO v_doubt_user_id FROM public.doubts WHERE id = p_doubt_id;
  IF v_doubt_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Doubt not found');
  END IF;
  IF v_doubt_user_id != v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the question author can accept an answer');
  END IF;
  SELECT da.user_id INTO v_answer_user_id FROM public.doubt_answers da WHERE da.id = p_answer_id AND da.doubt_id = p_doubt_id AND da.hidden = false;
  IF v_answer_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Answer not found for this doubt');
  END IF;

  SELECT COALESCE(bounty_rdm, 0) INTO v_bounty FROM public.doubts WHERE id = p_doubt_id;

  SELECT COUNT(*) INTO v_payouts_today FROM public.accepted_answer_payouts
  WHERE user_id = v_answer_user_id AND paid_at >= date_trunc('day', now());
  IF v_payouts_today >= 3 THEN
    v_net := 0;
  ELSE
    v_gross := v_base + COALESCE(v_bounty, 0);
    v_tax := (v_gross * 10) / 100;
    v_net := GREATEST(0, v_gross - v_tax);
  END IF;

  UPDATE public.doubt_answers SET is_accepted = false WHERE doubt_id = p_doubt_id;
  UPDATE public.doubt_answers SET is_accepted = true WHERE id = p_answer_id;
  UPDATE public.doubts SET is_resolved = true, bounty_rdm = 0, bounty_escrowed_at = NULL WHERE id = p_doubt_id;

  IF v_net > 0 THEN
    PERFORM public.add_rdm(v_answer_user_id, v_net);
    INSERT INTO public.accepted_answer_payouts (user_id, answer_id, rdm_paid) VALUES (v_answer_user_id, p_answer_id, v_net);
    UPDATE public.profiles SET lifetime_answer_rdm = lifetime_answer_rdm + v_net WHERE id = v_answer_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'rdm_paid', v_net);
END;
$$;


ALTER FUNCTION "public"."accept_doubt_answer"("p_doubt_id" "uuid", "p_answer_id" "uuid", "p_bonus_rdm" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."accept_doubt_answer"("p_doubt_id" "uuid", "p_answer_id" "uuid", "p_bonus_rdm" integer) IS 'Accept answer; pay (Base+Bounty)-10%% tax to answerer; farming cap 3/day; clear escrow.';



CREATE OR REPLACE FUNCTION "public"."add_rdm"("uid" "uuid", "amt" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_balance integer;
  v_prev text;
BEGIN
  v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
  PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
  UPDATE public.profiles
  SET rdm = rdm + amt
  WHERE id = uid
  RETURNING rdm INTO new_balance;
  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;
  RETURN new_balance;
END;
$$;


ALTER FUNCTION "public"."add_rdm"("uid" "uuid", "amt" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_rdm"("uid" "uuid", "amt" integer) IS 'Add RDM to a user; used for doubt/answer rewards.';



CREATE OR REPLACE FUNCTION "public"."add_user_site_presence_ms"("p_day" "date", "p_delta_ms" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  d bigint := coalesce(p_delta_ms, 0);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_day is null then
    raise exception 'p_day required';
  end if;
  if d <= 0 then
    return;
  end if;
  if d > 5 * 60 * 1000 then
    d := 5 * 60 * 1000;
  end if;

  insert into public.user_study_day_totals (user_id, day, presence_ms)
  values (uid, p_day, d)
  on conflict (user_id, day) do update set
    presence_ms = least(
      user_study_day_totals.presence_ms + excluded.presence_ms,
      20 * 60 * 60 * 1000
    ),
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."add_user_site_presence_ms"("p_day" "date", "p_delta_ms" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_user_study_day_ms"("p_day" "date", "p_delta_ms" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  d bigint := coalesce(p_delta_ms, 0);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_day is null then
    raise exception 'p_day required';
  end if;
  if d <= 0 then
    return;
  end if;
  if d > 12 * 60 * 60 * 1000 then
    d := 12 * 60 * 60 * 1000;
  end if;

  insert into public.user_study_day_totals (user_id, day, active_ms)
  values (uid, p_day, d)
  on conflict (user_id, day) do update set
    active_ms = user_study_day_totals.active_ms + excluded.active_ms,
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."add_user_study_day_ms"("p_day" "date", "p_delta_ms" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_analytics_summary"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  SELECT
    coalesce(sum(jsonb_array_length(coalesce(saved_bits, '[]'::jsonb))), 0)::int,
    coalesce(sum(jsonb_array_length(coalesce(saved_formulas, '[]'::jsonb))), 0)::int,
    coalesce(sum(jsonb_array_length(coalesce(saved_revision_cards, '[]'::jsonb))), 0)::int,
    coalesce(sum(jsonb_array_length(coalesce(saved_revision_units, '[]'::jsonb))), 0)::int,
    coalesce(sum(
      CASE WHEN bits_test_attempts IS NOT NULL AND jsonb_typeof(bits_test_attempts) = 'object'
        THEN (SELECT count(*) FROM jsonb_object_keys(bits_test_attempts))
        ELSE 0 END
    ), 0)::int,
    coalesce(sum(
      CASE WHEN subtopic_engagement IS NOT NULL AND jsonb_typeof(subtopic_engagement) = 'object'
        THEN (SELECT count(*) FROM jsonb_object_keys(subtopic_engagement))
        ELSE 0 END
    ), 0)::int
  INTO v_total_saved_bits, v_total_saved_formulas, v_total_saved_cards,
       v_total_saved_units, v_bits_attempts, v_subtopic_engagement
  FROM profiles;

  SELECT
    count(*)::int,
    count(*) FILTER (WHERE is_resolved)::int,
    coalesce(sum(views), 0)::bigint
  INTO v_total_doubts, v_resolved_doubts, v_total_doubt_views
  FROM doubts;

  SELECT count(*)::bigint INTO v_ai_calls FROM ai_token_logs;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY month), '[]'::jsonb)
  INTO v_user_growth
  FROM (
    SELECT to_char(created_at, 'YYYY-MM') AS month, count(*) AS count
    FROM profiles WHERE created_at IS NOT NULL GROUP BY 1
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY month), '[]'::jsonb)
  INTO v_doubts_monthly
  FROM (
    SELECT to_char(created_at, 'YYYY-MM') AS month, count(*) AS count
    FROM doubts WHERE created_at IS NOT NULL GROUP BY 1
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_class_dist
  FROM (
    SELECT 'Class ' || coalesce(class_level::text, 'Unknown') AS name, count(*) AS value
    FROM profiles WHERE role = 'student' GROUP BY class_level
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_stream_dist
  FROM (
    SELECT coalesce(stream, 'Unknown') AS name, count(*) AS value
    FROM profiles WHERE role = 'student' GROUP BY stream
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_rdm_by_role
  FROM (
    SELECT role, coalesce(sum(rdm), 0)::bigint AS value FROM profiles GROUP BY role
  ) t;

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


ALTER FUNCTION "public"."admin_analytics_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_churn_risk"("p_limit" integer DEFAULT 100) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."admin_churn_risk"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_conversion_funnel"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total_signups int;
  v_first_quiz int;
  v_first_doubt int;
  v_daily_active int;
  v_paid int;
BEGIN
  SELECT count(*) INTO v_total_signups
  FROM profiles WHERE role = 'student';

  SELECT count(DISTINCT p.id) INTO v_first_quiz
  FROM profiles p
  WHERE p.role = 'student'
    AND EXISTS (SELECT 1 FROM play_history h WHERE h.user_id = p.id);

  SELECT count(DISTINCT p.id) INTO v_first_doubt
  FROM profiles p
  WHERE p.role = 'student'
    AND EXISTS (SELECT 1 FROM doubts d WHERE d.user_id = p.id);

  SELECT count(DISTINCT p.id) INTO v_daily_active
  FROM profiles p
  WHERE p.role = 'student'
    AND (
      p.updated_at >= now() - interval '30 days'
      OR EXISTS (
        SELECT 1 FROM user_study_day_totals s
        WHERE s.user_id = p.id AND s.day >= (current_date - 30)
      )
    );

  SELECT count(*) INTO v_paid
  FROM profiles WHERE role = 'student' AND plan_tier IS NOT NULL AND plan_tier != 'free';

  RETURN jsonb_build_object(
    'steps', jsonb_build_array(
      jsonb_build_object('name', 'Signup', 'count', v_total_signups, 'pct', 100),
      jsonb_build_object('name', 'First Quiz', 'count', v_first_quiz,
        'pct', CASE WHEN v_total_signups > 0 THEN round(100.0 * v_first_quiz / v_total_signups, 1) ELSE 0 END,
        'dropoff', CASE WHEN v_total_signups > 0 THEN round(100.0 * (v_total_signups - v_first_quiz) / v_total_signups, 1) ELSE 0 END),
      jsonb_build_object('name', 'First Doubt', 'count', v_first_doubt,
        'pct', CASE WHEN v_total_signups > 0 THEN round(100.0 * v_first_doubt / v_total_signups, 1) ELSE 0 END,
        'dropoff', CASE WHEN v_first_quiz > 0 THEN round(100.0 * (v_first_quiz - v_first_doubt) / v_first_quiz, 1) ELSE 0 END),
      jsonb_build_object('name', 'Daily Active (30d)', 'count', v_daily_active,
        'pct', CASE WHEN v_total_signups > 0 THEN round(100.0 * v_daily_active / v_total_signups, 1) ELSE 0 END,
        'dropoff', CASE WHEN v_first_doubt > 0 THEN round(100.0 * (v_first_doubt - v_daily_active) / v_first_doubt, 1) ELSE 0 END),
      jsonb_build_object('name', 'Paid', 'count', v_paid,
        'pct', CASE WHEN v_total_signups > 0 THEN round(100.0 * v_paid / v_total_signups, 1) ELSE 0 END,
        'dropoff', CASE WHEN v_daily_active > 0 THEN round(100.0 * (v_daily_active - v_paid) / v_daily_active, 1) ELSE 0 END)
    ),
    'generatedAt', to_jsonb(now())
  );
END;
$$;


ALTER FUNCTION "public"."admin_conversion_funnel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_dropoff_tracking"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total int := 0;
  v_page_only int := 0;
  v_quiz_started int := 0;
  v_quiz_completed int := 0;
  v_lesson_marked int := 0;
  r RECORD;
  key TEXT;
  val JSONB;
  bits_val JSONB;
BEGIN
  FOR r IN SELECT subtopic_engagement FROM profiles
           WHERE role = 'student'
             AND subtopic_engagement IS NOT NULL
             AND jsonb_typeof(subtopic_engagement) = 'object'
  LOOP
    FOR key, val IN SELECT * FROM jsonb_each(r.subtopic_engagement)
    LOOP
      IF val IS NULL OR jsonb_typeof(val) != 'object' THEN CONTINUE; END IF;
      IF val->>'bitsSignature' IS NULL OR val->>'bitsSignature' = '' THEN CONTINUE; END IF;

      v_total := v_total + 1;
      bits_val := val->'bits';

      IF val->>'lessonChecklistMarkedCompleteAt' IS NOT NULL THEN
        v_lesson_marked := v_lesson_marked + 1;
      ELSIF bits_val IS NOT NULL AND bits_val->>'graded' IS NOT NULL THEN
        v_quiz_completed := v_quiz_completed + 1;
      ELSIF bits_val IS NOT NULL AND (bits_val->>'currentIdx')::int > 0 THEN
        v_quiz_started := v_quiz_started + 1;
      ELSE
        v_page_only := v_page_only + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'totalSubtopicVisits', v_total,
    'stages', jsonb_build_array(
      jsonb_build_object('stage', 'Page Visited', 'count', v_page_only + v_quiz_started + v_quiz_completed + v_lesson_marked, 'pct', 100),
      jsonb_build_object('stage', 'Quiz Started', 'count', v_quiz_started + v_quiz_completed + v_lesson_marked,
        'pct', CASE WHEN v_total > 0 THEN round(100.0 * (v_quiz_started + v_quiz_completed + v_lesson_marked) / v_total, 1) ELSE 0 END),
      jsonb_build_object('stage', 'Quiz Completed', 'count', v_quiz_completed + v_lesson_marked,
        'pct', CASE WHEN v_total > 0 THEN round(100.0 * (v_quiz_completed + v_lesson_marked) / v_total, 1) ELSE 0 END),
      jsonb_build_object('stage', 'Lesson Marked Complete', 'count', v_lesson_marked,
        'pct', CASE WHEN v_total > 0 THEN round(100.0 * v_lesson_marked / v_total, 1) ELSE 0 END)
    ),
    'abandonmentPoints', jsonb_build_array(
      jsonb_build_object('point', 'Page → Quiz', 'abandoned', v_page_only,
        'pct', CASE WHEN v_total > 0 THEN round(100.0 * v_page_only / v_total, 1) ELSE 0 END),
      jsonb_build_object('point', 'Quiz Started → Completed', 'abandoned', v_quiz_started,
        'pct', CASE WHEN (v_quiz_started + v_quiz_completed + v_lesson_marked) > 0 THEN round(100.0 * v_quiz_started / (v_quiz_started + v_quiz_completed + v_lesson_marked), 1) ELSE 0 END),
      jsonb_build_object('point', 'Completed → Marked', 'abandoned', v_quiz_completed,
        'pct', CASE WHEN (v_quiz_completed + v_lesson_marked) > 0 THEN round(100.0 * v_quiz_completed / (v_quiz_completed + v_lesson_marked), 1) ELSE 0 END)
    ),
    'generatedAt', to_jsonb(now())
  );
END;
$$;


ALTER FUNCTION "public"."admin_dropoff_tracking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_event_funnel"("p_event_names" "text"[], "p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result jsonb;
  v_total_users int;
  v_start_date timestamptz := now() - (p_days || ' days')::interval;
BEGIN
  -- Total active users in period
  SELECT count(DISTINCT user_id) INTO v_total_users
  FROM student_events
  WHERE created_at >= v_start_date;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.step_order), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      unnest(p_event_names) AS event_name,
      generate_series(1, array_length(p_event_names, 1)) AS step_order
  ) steps
  CROSS JOIN LATERAL (
    SELECT
      steps.step_order,
      steps.event_name,
      count(DISTINCT se.user_id)::int AS unique_users,
      CASE WHEN v_total_users > 0
        THEN round(100.0 * count(DISTINCT se.user_id) / v_total_users, 1)
        ELSE 0 END AS pct_of_active
    FROM student_events se
    WHERE se.event_name = steps.event_name
      AND se.created_at >= v_start_date
  ) t;

  RETURN jsonb_build_object(
    'periodDays', p_days,
    'totalActiveUsers', v_total_users,
    'funnel', v_result,
    'generatedAt', to_jsonb(now())
  );
END;
$$;


ALTER FUNCTION "public"."admin_event_funnel"("p_event_names" "text"[], "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_event_summary"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_start_date timestamptz := now() - (p_days || ' days')::interval;
  v_events jsonb;
  v_total int;
  v_unique_users int;
BEGIN
  SELECT count(*), count(DISTINCT user_id)
  INTO v_total, v_unique_users
  FROM student_events
  WHERE created_at >= v_start_date;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.event_count DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT
      event_name,
      count(*)::int AS event_count,
      count(DISTINCT user_id)::int AS unique_users,
      round(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 1) AS pct_of_total
    FROM student_events
    WHERE created_at >= v_start_date
    GROUP BY event_name
    ORDER BY count(*) DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'periodDays', p_days,
    'totalEvents', v_total,
    'uniqueUsers', v_unique_users,
    'events', v_events,
    'generatedAt', to_jsonb(now())
  );
END;
$$;


ALTER FUNCTION "public"."admin_event_summary"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_feature_adoption"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."admin_feature_adoption"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_retention_cohorts"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."admin_retention_cohorts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_expired_classroom_sections"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  updated_count integer := 0;
BEGIN
  UPDATE public.classroom_sections
  SET is_active = false,
      archived_at = COALESCE(archived_at, now()),
      updated_at = now()
  WHERE is_active = true
    AND schedule_end_date IS NOT NULL
    AND schedule_end_date ~ '^\d{4}-\d{2}-\d{2}$'
    AND (schedule_end_date::date) < (CURRENT_DATE);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$_$;


ALTER FUNCTION "public"."archive_expired_classroom_sections"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_daily_rdm"("p_user_id" "uuid", "p_action_type" "text", "p_points" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ist_date date;
  v_claim_id uuid;
  v_new_balance integer;
  v_balance integer;
BEGIN
  IF p_user_id IS NULL OR p_points IS NULL OR p_points <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_params');
  END IF;
  IF p_action_type NOT IN (
    'ASK',
    'COMMENT',
    'UPVOTE',
    'SAVE',
    'INSTACUE_CREATE',
    'TOPIC_QUIZ_ADVANCED_60',
    'NUMERALS_PACK_COMPLETE',
    'DAILY_DOSE_ACADEMIC',
    'DAILY_DOSE_FUNBRAIN',
    'DAILY_DOSE_STREAK_7',
    'DAILY_DOSE_STREAK_30'
  ) THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_action');
  END IF;
  IF public.is_gyan_bot_user(p_user_id) THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason', 'gyan_bot'
    );
  END IF;

  v_ist_date := ((now() AT TIME ZONE 'Asia/Kolkata'))::date;

  INSERT INTO public.daily_reward_claims (user_id, action_type, claim_date_ist, points_awarded)
  VALUES (p_user_id, p_action_type, v_ist_date, p_points)
  ON CONFLICT (user_id, action_type, claim_date_ist) DO NOTHING
  RETURNING id INTO v_claim_id;

  IF v_claim_id IS NOT NULL THEN
    v_new_balance := public.add_rdm(p_user_id, p_points);
    RETURN jsonb_build_object(
      'awarded', true,
      'amount', p_points,
      'balance', v_new_balance,
      'claim_date_ist', v_ist_date
    );
  END IF;

  SELECT rdm INTO v_balance FROM public.profiles WHERE id = p_user_id;
  RETURN jsonb_build_object(
    'awarded', false,
    'amount', 0,
    'balance', COALESCE(v_balance, 0),
    'claim_date_ist', v_ist_date,
    'reason', 'already_claimed_today'
  );
END;
$$;


ALTER FUNCTION "public"."award_daily_rdm"("p_user_id" "uuid", "p_action_type" "text", "p_points" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."award_daily_rdm"("p_user_id" "uuid", "p_action_type" "text", "p_points" integer) IS 'IST-day-first RDM; includes DailyDose academic/funbrain and streak milestone bonuses.';



CREATE OR REPLACE FUNCTION "public"."bits_signature_v1"("bits_questions" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  n int;
  i int;
  oi int;
  elem jsonb;
  opts jsonb;
  q text;
  ca text;
  opt_join text;
  raw text := '';
  j int;
  h bigint := 0;
  cp int;
  v_len int;
  ch text;
BEGIN
  IF bits_questions IS NULL OR jsonb_typeof(bits_questions) <> 'array' THEN
    RETURN NULL;
  END IF;
  n := jsonb_array_length(bits_questions);
  IF n < 1 THEN
    RETURN NULL;
  END IF;

  FOR i IN 0..n - 1 LOOP
    elem := bits_questions -> i;
    IF elem IS NULL OR jsonb_typeof(elem) <> 'object' THEN
      CONTINUE;
    END IF;
    q := COALESCE(elem ->> 'question', '');
    ca := COALESCE(elem ->> 'correctAnswer', '');
    opts := elem -> 'options';
    opt_join := '';
    IF opts IS NOT NULL AND jsonb_typeof(opts) = 'array' THEN
      FOR oi IN 0..jsonb_array_length(opts) - 1 LOOP
        IF oi > 0 THEN
          opt_join := opt_join || '||';
        END IF;
        opt_join := opt_join || COALESCE(opts ->> oi, '');
      END LOOP;
    END IF;
    IF raw <> '' THEN
      raw := raw || '###';
    END IF;
    raw := raw || (i + 1)::text || '|' || q || '|' || ca || '|' || opt_join;
  END LOOP;

  v_len := char_length(raw);
  FOR j IN 1..v_len LOOP
    ch := substr(raw, j, 1);
    cp := ascii(ch);
    h := public._js_int32_wrap(h * 31 + cp::bigint);
  END LOOP;

  RETURN 'v1-' || n::text || '-' || abs(h::integer)::text;
END;
$$;


ALTER FUNCTION "public"."bits_signature_v1"("bits_questions" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."bits_signature_v1"("bits_questions" "jsonb") IS 'Stable fingerprint for bits_questions JSON; must match lib/bitsSignature.ts getBitsSignature.';



CREATE OR REPLACE FUNCTION "public"."bump_lessons_raw_post_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.lessons_raw_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.lessons_raw_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."bump_lessons_raw_post_comment_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_cbse_mcq_chapter_score_rdm"("p_paper_id" "uuid", "p_correct" integer, "p_total" integer, "p_attempt_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_attempt text;
  v_paper_ok boolean;
  v_pct integer;
  v_min_pct integer;
  v_win_rdm integer;
  v_eligible boolean;
  v_new_rdm integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  v_attempt := trim(both from coalesce(p_attempt_key, ''));
  IF length(v_attempt) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_attempt_key');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.mock_papers mp
    WHERE mp.id = p_paper_id
      AND mp.published = true
      AND mp.paper_type = 'chapter'
  )
  INTO v_paper_ok;

  IF NOT v_paper_ok THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'paper_not_found');
  END IF;

  IF p_total IS NULL OR p_total <= 0 OR p_correct IS NULL OR p_correct < 0 OR p_correct > p_total THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_score');
  END IF;

  v_pct := ROUND(100.0 * p_correct::numeric / p_total::numeric)::integer;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'cbse_mcq_min_accuracy_pct'), 60)
  INTO v_min_pct;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'cbse_mcq_win_rdm'), 5)
  INTO v_win_rdm;

  v_min_pct := GREATEST(0, LEAST(100, v_min_pct));
  v_win_rdm := GREATEST(0, v_win_rdm);
  v_eligible := v_pct >= v_min_pct AND v_win_rdm > 0;

  PERFORM pg_advisory_xact_lock(904323, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.cbse_mcq_score_bonus_claims c
    WHERE c.user_id = v_uid AND c.attempt_key = v_attempt
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END IF;

  IF NOT v_eligible THEN
    INSERT INTO public.cbse_mcq_score_bonus_claims (
      user_id, paper_id, attempt_key, correct_count, total_questions,
      accuracy_pct, eligible, rdm_amount
    ) VALUES (
      v_uid, p_paper_id, v_attempt, p_correct, p_total, v_pct, false, 0
    );
    RETURN jsonb_build_object(
      'ok', false,
      'denial_reason', 'below_minimum',
      'accuracy_pct', v_pct,
      'min_accuracy_pct', v_min_pct,
      'rdm_amount', 0
    );
  END IF;

  BEGIN
    INSERT INTO public.cbse_mcq_score_bonus_claims (
      user_id, paper_id, attempt_key, correct_count, total_questions,
      accuracy_pct, eligible, rdm_amount
    ) VALUES (
      v_uid, p_paper_id, v_attempt, p_correct, p_total, v_pct, true, v_win_rdm
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END;

  v_new_rdm := public.add_rdm(v_uid, v_win_rdm);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_win_rdm,
    'new_rdm_balance', v_new_rdm,
    'accuracy_pct', v_pct,
    'min_accuracy_pct', v_min_pct,
    'eligible', true
  );
END;
$$;


ALTER FUNCTION "public"."claim_cbse_mcq_chapter_score_rdm"("p_paper_id" "uuid", "p_correct" integer, "p_total" integer, "p_attempt_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_cbse_mcq_chapter_score_rdm"("p_paper_id" "uuid", "p_correct" integer, "p_total" integer, "p_attempt_key" "text") IS 'Authenticated: chapter paper quiz completion RDM from accuracy tiers in rdm_config; once per attempt_key.';



CREATE OR REPLACE FUNCTION "public"."claim_cbse_mcq_community_share_rdm"("p_post_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post_user_id uuid;
  v_kind text;
  v_source_type text;
  v_payload jsonb;
  v_tags text[];
  v_attempt text;
  v_new_rdm integer;
  v_reward_rdm integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  BEGIN
    SELECT lp.user_id, lp.kind, lp.source_type, lp.source_payload, lp.tags
    INTO STRICT v_post_user_id, v_kind, v_source_type, v_payload, v_tags
    FROM public.lessons_raw_posts lp
    WHERE lp.id = p_post_id;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'post_not_found');
  END;

  IF v_post_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'wrong_owner');
  END IF;

  IF v_kind IS DISTINCT FROM 'post' THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  IF v_source_type IS DISTINCT FROM 'cbse_mcq_chapter'
    OR v_tags IS NULL
    OR NOT ('cbse_mcq_chapter' = ANY (v_tags)) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  v_attempt := trim(both from coalesce(v_payload->>'attemptKey', ''));
  IF length(v_attempt) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_attempt_key');
  END IF;

  PERFORM pg_advisory_xact_lock(904324, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.cbse_mcq_community_share_rdm_claims c
    WHERE c.user_id = v_uid AND c.attempt_key = v_attempt
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'cbse_mcq_community_share_rdm'), 10)
  INTO v_reward_rdm;
  v_reward_rdm := GREATEST(1, v_reward_rdm);

  BEGIN
    INSERT INTO public.cbse_mcq_community_share_rdm_claims (user_id, post_id, attempt_key, rdm_amount)
    VALUES (v_uid, p_post_id, v_attempt, v_reward_rdm);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END;

  v_new_rdm := public.add_rdm(v_uid, v_reward_rdm);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_reward_rdm,
    'new_rdm_balance', v_new_rdm,
    'post_id', p_post_id
  );
END;
$$;


ALTER FUNCTION "public"."claim_cbse_mcq_community_share_rdm"("p_post_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_cbse_mcq_community_share_rdm"("p_post_id" "uuid") IS 'Authenticated: verify lessons_raw_posts is cbse_mcq_chapter share; grant rdm_config.cbse_mcq_community_share_rdm once per attempt_key.';



CREATE OR REPLACE FUNCTION "public"."claim_free_trial_checklist_reward"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_progress jsonb;
  v_claimed_at timestamptz;
  v_amount integer;
  v_new_balance integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT onboarding_reward_progress, onboarding_reward_claimed_at
  INTO v_progress, v_claimed_at
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  IF v_claimed_at IS NOT NULL THEN
    SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'amount', 0,
      'balance', COALESCE(v_new_balance, 0)
    );
  END IF;

  IF NOT public._free_trial_onboarding_all_complete(v_progress) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'checklist_incomplete');
  END IF;

  SELECT COALESCE(
    (SELECT value::integer FROM public.rdm_config WHERE key = 'free_trial_checklist_reward_rdm'),
    100
  )
  INTO v_amount;

  v_amount := GREATEST(0, COALESCE(v_amount, 100));

  v_new_balance := public.add_rdm(v_user_id, v_amount);

  UPDATE public.profiles
  SET onboarding_reward_claimed_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_claimed', false,
    'amount', v_amount,
    'balance', v_new_balance
  );
END;
$$;


ALTER FUNCTION "public"."claim_free_trial_checklist_reward"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_free_trial_checklist_reward"() IS 'One-time RDM claim after all free-trial onboarding checklist tasks are complete. Amount from rdm_config.free_trial_checklist_reward_rdm.';



CREATE OR REPLACE FUNCTION "public"."claim_free_trial_daily_streak_reward"("p_day" integer, "p_task_ids" "text"[] DEFAULT NULL::"text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_claimed_at timestamptz;
  v_state jsonb;
  v_day_key text;
  v_amount integer;
  v_new_balance integer;
  v_now timestamptz := now();
  v_expected_day integer;
  v_stored_tasks text[];
  v_day jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_day IS NULL OR p_day < 2 OR p_day > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  SELECT onboarding_reward_claimed_at, free_trial_daily_streak
  INTO v_claimed_at, v_state
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  IF v_claimed_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'site_tour_not_claimed');
  END IF;

  v_state := COALESCE(v_state, '{}'::jsonb);
  v_day_key := p_day::text;
  v_day := COALESCE(v_state -> v_day_key, '{}'::jsonb);

  IF COALESCE(v_day ->> 'claimed_at', '') <> '' THEN
    SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'amount', 0,
      'balance', COALESCE(v_new_balance, 0),
      'trial_day', p_day
    );
  END IF;

  v_expected_day := public._free_trial_next_streak_day(v_state);
  IF v_expected_day IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'all_days_complete');
  END IF;

  IF p_day <> v_expected_day THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'wrong_day',
      'expected_day', v_expected_day
    );
  END IF;

  v_stored_tasks := public._free_trial_streak_day_task_ids(v_state, v_day_key);
  IF NOT public._free_trial_daily_tasks_valid(v_stored_tasks) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'incomplete_tasks');
  END IF;

  SELECT COALESCE(
    (SELECT value::integer FROM public.rdm_config WHERE key = 'free_trial_daily_streak_reward_rdm'),
    80
  )
  INTO v_amount;

  v_amount := GREATEST(0, COALESCE(v_amount, 80));
  v_new_balance := public.add_rdm(v_user_id, v_amount);

  v_day := jsonb_set(
    v_day,
    '{task_ids}',
    to_jsonb(v_stored_tasks),
    true
  );
  v_day := jsonb_set(v_day, '{completed_at}', to_jsonb(v_now), true);
  v_day := jsonb_set(v_day, '{claimed_at}', to_jsonb(v_now), true);

  v_state := jsonb_set(v_state, ARRAY[v_day_key], v_day, true);

  UPDATE public.profiles
  SET free_trial_daily_streak = v_state
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_claimed', false,
    'amount', v_amount,
    'balance', v_new_balance,
    'trial_day', p_day
  );
END;
$$;


ALTER FUNCTION "public"."claim_free_trial_daily_streak_reward"("p_day" integer, "p_task_ids" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_free_trial_daily_streak_reward"("p_day" integer, "p_task_ids" "text"[]) IS 'Credits free_trial_daily_streak_reward_rdm after all 6 daily tasks for the current trial day (2–10).';



CREATE OR REPLACE FUNCTION "public"."claim_instacue_create_daily_rdm"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', NULL,
      'reason', 'not_authenticated'
    );
  END IF;
  RETURN public.award_daily_rdm(v_uid, 'INSTACUE_CREATE', 5);
END;
$$;


ALTER FUNCTION "public"."claim_instacue_create_daily_rdm"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_instacue_create_daily_rdm"() IS 'First InstaCue (revision) card create per IST day: +5 RDM via award_daily_rdm.';



CREATE OR REPLACE FUNCTION "public"."claim_mock_community_share_rdm"("p_post_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post_user_id uuid;
  v_kind text;
  v_source_type text;
  v_payload jsonb;
  v_tags text[];
  v_attempt text;
  v_new_rdm integer;
  v_reward_rdm integer;
  v_eligible boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  BEGIN
    SELECT lp.user_id, lp.kind, lp.source_type, lp.source_payload, lp.tags
    INTO STRICT v_post_user_id, v_kind, v_source_type, v_payload, v_tags
    FROM public.lessons_raw_posts lp
    WHERE lp.id = p_post_id;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'post_not_found');
  END;

  IF v_post_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'wrong_owner');
  END IF;

  IF v_kind IS DISTINCT FROM 'post' THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  v_eligible :=
    (v_source_type = 'mock_test' AND v_tags IS NOT NULL AND 'mock_test' = ANY (v_tags))
    OR (
      v_source_type = 'past_paper_result'
      AND v_tags IS NOT NULL
      AND 'past_paper_share' = ANY (v_tags)
    );

  IF NOT v_eligible THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  v_attempt := trim(both from coalesce(v_payload->>'attemptKey', ''));
  IF length(v_attempt) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_attempt_key');
  END IF;

  PERFORM pg_advisory_xact_lock(904322, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.mock_community_share_rdm_claims c
    WHERE c.user_id = v_uid AND c.attempt_key = v_attempt
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'mock_community_share_rdm'), 40)
  INTO v_reward_rdm;
  v_reward_rdm := GREATEST(1, v_reward_rdm);

  BEGIN
    INSERT INTO public.mock_community_share_rdm_claims (user_id, post_id, attempt_key, rdm_amount)
    VALUES (v_uid, p_post_id, v_attempt, v_reward_rdm);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END;

  v_new_rdm := public.add_rdm(v_uid, v_reward_rdm);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_reward_rdm,
    'new_rdm_balance', v_new_rdm,
    'post_id', p_post_id
  );
END;
$$;


ALTER FUNCTION "public"."claim_mock_community_share_rdm"("p_post_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_mock_community_share_rdm"("p_post_id" "uuid") IS 'Authenticated: verify lessons_raw_posts row is mock_test (tag mock_test) or past_paper_result (tag past_paper_share); grant RDM from rdm_config.mock_community_share_rdm once per attempt_key.';



CREATE OR REPLACE FUNCTION "public"."claim_mock_rdm_bonus"("p_paper_id" "uuid", "p_answer_indices" integer[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ist date;
  v_total integer;
  v_correct integer := 0;
  v_expected integer;
  v_given integer;
  v_score_pct integer;
  v_eligible boolean;
  r record;
  v_idx integer := 1;
  v_new_rdm integer;
  v_paper_ok boolean;
  v_bonus_rdm integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  v_ist := (timezone('Asia/Kolkata', clock_timestamp()))::date;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'mock_score_bonus_rdm'), 50)
  INTO v_bonus_rdm;
  v_bonus_rdm := GREATEST(1, v_bonus_rdm);

  SELECT EXISTS (
    SELECT 1 FROM public.mock_papers mp
    WHERE mp.id = p_paper_id AND mp.published = true
  )
  INTO v_paper_ok;

  IF NOT v_paper_ok THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, denial_reason, rdm_awarded
    ) VALUES (v_uid, p_paper_id, v_ist, false, NULL, 'paper_not_found', 0);
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'paper_not_found');
  END IF;

  SELECT COUNT(*)::integer INTO v_total FROM public.mock_questions mq WHERE mq.paper_id = p_paper_id;

  IF v_total IS NULL OR v_total <= 0 THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, denial_reason, rdm_awarded
    ) VALUES (v_uid, p_paper_id, v_ist, false, NULL, 'no_questions', 0);
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'no_questions');
  END IF;

  IF p_answer_indices IS NULL OR array_length(p_answer_indices, 1) IS DISTINCT FROM v_total THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, denial_reason, rdm_awarded, total_questions
    ) VALUES (v_uid, p_paper_id, v_ist, false, NULL, 'invalid_payload', 0, v_total);
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_payload', 'expected_answers', v_total);
  END IF;

  FOR r IN
    SELECT mq.correct_letter
    FROM public.mock_questions mq
    WHERE mq.paper_id = p_paper_id
    ORDER BY mq.sort_order
  LOOP
    v_expected := ascii(trim(both from upper(r.correct_letter::text))) - 65;
    IF v_expected < 0 OR v_expected > 3 THEN
      v_expected := 0;
    END IF;

    v_given := p_answer_indices[v_idx];
    IF v_given IS NOT NULL AND v_given >= 0 AND v_given <= 3 AND v_given = v_expected THEN
      v_correct := v_correct + 1;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  v_score_pct := ROUND(100.0 * v_correct::numeric / v_total::numeric)::integer;
  v_eligible := (100 * v_correct >= 60 * v_total);

  IF NOT v_eligible THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, correct_count, total_questions,
      denial_reason, rdm_awarded
    ) VALUES (
      v_uid, p_paper_id, v_ist, false, v_score_pct, v_correct, v_total, 'below_60', 0
    );
    RETURN jsonb_build_object(
      'ok', false,
      'denial_reason', 'below_60',
      'score_percent', v_score_pct,
      'correct_count', v_correct,
      'total_questions', v_total
    );
  END IF;

  PERFORM pg_advisory_xact_lock(904321, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.mock_rdm_bonus_claims c WHERE c.user_id = v_uid AND c.paper_id = p_paper_id
  ) THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, correct_count, total_questions,
      denial_reason, rdm_awarded
    ) VALUES (
      v_uid, p_paper_id, v_ist, true, v_score_pct, v_correct, v_total, 'already_claimed_paper', 0
    );
    RETURN jsonb_build_object(
      'ok', false,
      'denial_reason', 'already_claimed_paper',
      'score_percent', v_score_pct,
      'correct_count', v_correct,
      'total_questions', v_total
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mock_rdm_bonus_claims c WHERE c.user_id = v_uid AND c.ist_claim_date = v_ist
  ) THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, correct_count, total_questions,
      denial_reason, rdm_awarded
    ) VALUES (
      v_uid, p_paper_id, v_ist, true, v_score_pct, v_correct, v_total, 'already_claimed_today', 0
    );
    RETURN jsonb_build_object(
      'ok', false,
      'denial_reason', 'already_claimed_today',
      'score_percent', v_score_pct,
      'correct_count', v_correct,
      'total_questions', v_total
    );
  END IF;

  INSERT INTO public.mock_rdm_bonus_claims (
    user_id, paper_id, ist_claim_date, score_percent, correct_count, total_questions, rdm_amount
  ) VALUES (
    v_uid, p_paper_id, v_ist, v_score_pct, v_correct, v_total, v_bonus_rdm
  );

  v_new_rdm := public.add_rdm(v_uid, v_bonus_rdm);

  INSERT INTO public.mock_rdm_bonus_attempts (
    user_id, paper_id, ist_claim_date, eligible, score_percent, correct_count, total_questions,
    denial_reason, rdm_awarded
  ) VALUES (
    v_uid, p_paper_id, v_ist, true, v_score_pct, v_correct, v_total, NULL, v_bonus_rdm
  );

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_bonus_rdm,
    'new_rdm_balance', v_new_rdm,
    'score_percent', v_score_pct,
    'correct_count', v_correct,
    'total_questions', v_total,
    'ist_claim_date', v_ist
  );
END;
$$;


ALTER FUNCTION "public"."claim_mock_rdm_bonus"("p_paper_id" "uuid", "p_answer_indices" integer[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_mock_rdm_bonus"("p_paper_id" "uuid", "p_answer_indices" integer[]) IS 'Authenticated: verify mock answers vs DB, grant RDM from rdm_config.mock_score_bonus_rdm if >=60% and daily/paper uniqueness (IST).';



CREATE OR REPLACE FUNCTION "public"."claim_numerals_community_share_rdm"("p_post_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post_user_id uuid;
  v_kind text;
  v_source_type text;
  v_payload jsonb;
  v_topic_ref text;
  v_subtopic_ref text;
  v_formula_index integer;
  v_reward_rdm integer;
  v_new_rdm integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  BEGIN
    SELECT
      lp.user_id,
      lp.kind,
      lp.source_type,
      lp.source_payload,
      trim(both from coalesce(lp.topic_ref, '')),
      trim(both from coalesce(lp.subtopic_ref, ''))
    INTO STRICT
      v_post_user_id,
      v_kind,
      v_source_type,
      v_payload,
      v_topic_ref,
      v_subtopic_ref
    FROM public.lessons_raw_posts lp
    WHERE lp.id = p_post_id;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'post_not_found');
  END;

  IF v_post_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'wrong_owner');
  END IF;

  IF v_kind IS DISTINCT FROM 'post' OR v_source_type IS DISTINCT FROM 'numerals_post' THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  IF length(v_topic_ref) = 0 OR length(v_subtopic_ref) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_scope');
  END IF;

  v_formula_index := NULLIF(trim(both from coalesce(v_payload->>'formulaIndex', '')), '')::integer;
  IF v_formula_index IS NULL OR v_formula_index < 0 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_formula_index');
  END IF;

  PERFORM pg_advisory_xact_lock(914022, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1
    FROM public.numerals_community_share_rdm_claims c
    WHERE c.user_id = v_uid
      AND c.topic_ref = v_topic_ref
      AND c.subtopic_ref = v_subtopic_ref
      AND c.formula_index = v_formula_index
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_numeral');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'numerals_community_share_rdm'), 5)
  INTO v_reward_rdm;
  v_reward_rdm := GREATEST(1, v_reward_rdm);

  BEGIN
    INSERT INTO public.numerals_community_share_rdm_claims (
      user_id, topic_ref, subtopic_ref, formula_index, post_id, rdm_amount
    )
    VALUES (
      v_uid, v_topic_ref, v_subtopic_ref, v_formula_index, p_post_id, v_reward_rdm
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_numeral');
  END;

  v_new_rdm := public.add_rdm(v_uid, v_reward_rdm);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_reward_rdm,
    'new_rdm_balance', v_new_rdm,
    'formula_index', v_formula_index
  );
END;
$$;


ALTER FUNCTION "public"."claim_numerals_community_share_rdm"("p_post_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_numerals_community_share_rdm"("p_post_id" "uuid") IS 'Authenticated: grants numerals post share bonus once per (topic_ref, subtopic_ref, formula_index) per user.';



CREATE OR REPLACE FUNCTION "public"."claim_numerals_pack_complete_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_formulas jsonb;
  v_bits jsonb;
  v_elem jsonb;
  v_bq jsonb;
  v_key text;
  v_sig_expected text;
  v_sig_att text;
  v_i int;
  v_n int;
  v_required int := 0;
  v_att jsonb;
  v_award jsonb;
  v_balance integer;
  v_corr int := 0;
  v_tot int := 0;
  v_pct int;
  sa jsonb;
  qi int;
  q jsonb;
  opts jsonb;
  si int;
  chosen text;
  ca text;
  ans_key text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'unauthenticated');
  END IF;

  IF p_class_level NOT IN (11, 12) OR lower(trim(p_level)) NOT IN ('basics', 'intermediate', 'advanced') THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_scope');
  END IF;

  SELECT sc.practice_formulas INTO v_formulas
  FROM public.subtopic_content sc
  WHERE lower(trim(sc.board)) = lower(trim(p_board))
    AND lower(trim(sc.subject)) = lower(trim(p_subject))
    AND sc.class_level = p_class_level
    AND lower(trim(sc.topic)) = lower(trim(p_topic))
    AND lower(trim(sc.subtopic_name)) = lower(trim(p_subtopic_name))
    AND lower(trim(sc.level)) = lower(trim(p_level))
  LIMIT 1;

  IF v_formulas IS NULL OR jsonb_typeof(v_formulas) <> 'array' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'subtopic_not_found');
  END IF;

  v_n := jsonb_array_length(v_formulas);
  IF v_n <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_formulas');
  END IF;

  SELECT COALESCE(p.bits_test_attempts, '{}'::jsonb) INTO v_bits
  FROM public.profiles p
  WHERE p.id = v_uid;

  FOR v_i IN 0..v_n - 1 LOOP
    v_elem := v_formulas -> v_i;
    IF v_elem IS NULL OR jsonb_typeof(v_elem) <> 'object' THEN
      CONTINUE;
    END IF;

    v_bq := v_elem -> 'bitsQuestions';
    IF v_bq IS NULL OR jsonb_typeof(v_bq) <> 'array' OR jsonb_array_length(v_bq) <= 0 THEN
      CONTINUE;
    END IF;

    v_required := v_required + 1;

    v_key := public._formula_practice_attempt_key(
      p_board,
      p_subject,
      p_class_level,
      p_topic,
      p_subtopic_name,
      p_level,
      v_i
    );

    IF NOT (v_bits ? v_key) THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', COALESCE(v_balance, 0),
        'reason',
        'incomplete_numerals'
      );
    END IF;

    v_att := v_bits -> v_key;
    IF v_att IS NULL OR jsonb_typeof(v_att) <> 'object' THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', COALESCE(v_balance, 0),
        'reason',
        'bad_attempt_blob'
      );
    END IF;

    v_sig_expected := public.bits_signature_v1(v_bq);
    v_sig_att := v_att ->> 'bitsSignature';
    IF v_sig_att IS DISTINCT FROM v_sig_expected THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', COALESCE(v_balance, 0),
        'reason',
        'stale_or_mismatch_signature'
      );
    END IF;

    sa := v_att -> 'selectedAnswers';
    IF sa IS NULL OR jsonb_typeof(sa) <> 'object' THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', COALESCE(v_balance, 0),
        'reason',
        'missing_selected_answers_formula_' || v_i::text
      );
    END IF;

    FOR qi IN 0..jsonb_array_length(v_bq) - 1 LOOP
      ans_key := qi::text;
      IF NOT (sa ? ans_key) THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false,
          'amount', 0,
          'balance', COALESCE(v_balance, 0),
          'reason',
          'missing_answer_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      si := (sa ->> ans_key)::int;
      IF si IS NULL OR si < 0 OR si > 3 THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false,
          'amount', 0,
          'balance', COALESCE(v_balance, 0),
          'reason',
          'invalid_answer_index_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      q := v_bq -> qi;
      IF q IS NULL OR jsonb_typeof(q) <> 'object' THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false,
          'amount', 0,
          'balance', COALESCE(v_balance, 0),
          'reason',
          'missing_question_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      opts := q -> 'options';
      IF opts IS NULL OR jsonb_typeof(opts) <> 'array' OR si >= jsonb_array_length(opts) THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false,
          'amount', 0,
          'balance', COALESCE(v_balance, 0),
          'reason',
          'invalid_options_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      chosen := (opts -> si) #>> '{}';
      ca := COALESCE(q ->> 'correctAnswer', '');
      v_tot := v_tot + 1;
      IF chosen IS NOT DISTINCT FROM ca THEN
        v_corr := v_corr + 1;
      END IF;
    END LOOP;
  END LOOP;

  IF v_required <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_numerals_required');
  END IF;

  IF v_tot <= 0 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason',
      'nothing_graded'
    );
  END IF;

  v_pct := round(100.0 * v_corr::numeric / v_tot::numeric)::int;
  IF v_pct < 60 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason',
      'below_threshold',
      'score_percent', v_pct,
      'correct', v_corr,
      'total', v_tot
    );
  END IF;

  v_award := public.award_daily_rdm(v_uid, 'NUMERALS_PACK_COMPLETE', 15);
  IF COALESCE((v_award ->> 'awarded')::boolean, false) THEN
    RETURN v_award || jsonb_build_object('score_percent', v_pct, 'correct', v_corr, 'total', v_tot);
  END IF;

  RETURN v_award
    || jsonb_build_object(
      'score_percent', v_pct,
      'correct', v_corr,
      'total', v_tot
    );
END;
$$;


ALTER FUNCTION "public"."claim_numerals_pack_complete_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_numerals_pack_complete_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text") IS 'All numerals submitted + server-regraded overall ≥60%: +15 RDM once per IST day (NUMERALS_PACK_COMPLETE).';



CREATE OR REPLACE FUNCTION "public"."claim_quiz_community_share_rdm"("p_post_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post_user_id uuid;
  v_kind text;
  v_source_type text;
  v_payload jsonb;
  v_topic_ref text;
  v_subtopic_ref text;
  v_quiz_set integer;
  v_reward_rdm integer;
  v_new_rdm integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  BEGIN
    SELECT
      lp.user_id,
      lp.kind,
      lp.source_type,
      lp.source_payload,
      trim(both from coalesce(lp.topic_ref, '')),
      trim(both from coalesce(lp.subtopic_ref, ''))
    INTO STRICT
      v_post_user_id,
      v_kind,
      v_source_type,
      v_payload,
      v_topic_ref,
      v_subtopic_ref
    FROM public.lessons_raw_posts lp
    WHERE lp.id = p_post_id;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'post_not_found');
  END;

  IF v_post_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'wrong_owner');
  END IF;

  IF v_kind IS DISTINCT FROM 'post' OR v_source_type IS DISTINCT FROM 'quiz_post' THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  IF length(v_topic_ref) = 0 OR length(v_subtopic_ref) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_scope');
  END IF;

  v_quiz_set := NULLIF(trim(both from coalesce(v_payload->>'quizSetNumber', '')), '')::integer;
  IF v_quiz_set IS NULL OR v_quiz_set < 1 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_quiz_set');
  END IF;

  PERFORM pg_advisory_xact_lock(914021, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1
    FROM public.quiz_community_share_rdm_claims c
    WHERE c.user_id = v_uid
      AND c.topic_ref = v_topic_ref
      AND c.subtopic_ref = v_subtopic_ref
      AND c.quiz_set = v_quiz_set
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_set');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'quiz_community_share_rdm'), 5)
  INTO v_reward_rdm;
  v_reward_rdm := GREATEST(1, v_reward_rdm);

  BEGIN
    INSERT INTO public.quiz_community_share_rdm_claims (
      user_id, topic_ref, subtopic_ref, quiz_set, post_id, rdm_amount
    )
    VALUES (
      v_uid, v_topic_ref, v_subtopic_ref, v_quiz_set, p_post_id, v_reward_rdm
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_set');
  END;

  v_new_rdm := public.add_rdm(v_uid, v_reward_rdm);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_reward_rdm,
    'new_rdm_balance', v_new_rdm,
    'quiz_set', v_quiz_set
  );
END;
$$;


ALTER FUNCTION "public"."claim_quiz_community_share_rdm"("p_post_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_quiz_community_share_rdm"("p_post_id" "uuid") IS 'Authenticated: grants quiz post share bonus once per (topic_ref, subtopic_ref, quiz_set) per user.';



CREATE OR REPLACE FUNCTION "public"."claim_refer_challenge_reward"("p_challenge_key" "text", "p_reward_type" "text", "p_claim_date" "date" DEFAULT (("now"() AT TIME ZONE 'utc'::"text"))::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.refer_challenge_claims%ROWTYPE;
  v_reward integer := 0;
  v_daily_earned integer := 0;
  v_new_balance integer := 0;
  v_claimed_now boolean := false;
  v_daily_cap integer;
  v_c5w integer;
  v_c5s integer;
  v_c10w integer;
  v_c10s integer;
  v_c20w integer;
  v_c20s integer;
  v_c50w integer;
  v_c50s integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF p_challenge_key NOT IN ('5', '10', '20', '50') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid challenge key');
  END IF;
  IF p_reward_type NOT IN ('win', 'share') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid reward type');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'refer_challenge_daily_rdm_cap'), 50) INTO v_daily_cap;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_5_win'), 3) INTO v_c5w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_5_share'), 2) INTO v_c5s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_10_win'), 7) INTO v_c10w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_10_share'), 3) INTO v_c10s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_20_win'), 15) INTO v_c20w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_20_share'), 5) INTO v_c20s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_50_win'), 30) INTO v_c50w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_50_share'), 20) INTO v_c50s;

  IF p_reward_type = 'win' THEN
    v_reward := CASE p_challenge_key
      WHEN '5' THEN v_c5w
      WHEN '10' THEN v_c10w
      WHEN '20' THEN v_c20w
      WHEN '50' THEN v_c50w
      ELSE 0
    END;
  ELSE
    v_reward := CASE p_challenge_key
      WHEN '5' THEN v_c5s
      WHEN '10' THEN v_c10s
      WHEN '20' THEN v_c20s
      WHEN '50' THEN v_c50s
      ELSE 0
    END;
  END IF;

  INSERT INTO public.refer_challenge_claims (user_id, claim_date, challenge_key)
  VALUES (v_uid, p_claim_date, p_challenge_key)
  ON CONFLICT (user_id, claim_date, challenge_key) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.refer_challenge_claims
  WHERE user_id = v_uid
    AND claim_date = p_claim_date
    AND challenge_key = p_challenge_key
  FOR UPDATE;

  IF p_reward_type = 'win' AND v_row.win_claimed THEN
    SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'ok', true,
      'claimed_now', false,
      'already_claimed', true,
      'reward_type', p_reward_type,
      'challenge_key', p_challenge_key,
      'reward_rdm', v_reward,
      'rdm', COALESCE(v_new_balance, 0)
    );
  END IF;

  IF p_reward_type = 'share' AND v_row.share_claimed THEN
    SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'ok', true,
      'claimed_now', false,
      'already_claimed', true,
      'reward_type', p_reward_type,
      'challenge_key', p_challenge_key,
      'reward_rdm', v_reward,
      'rdm', COALESCE(v_new_balance, 0)
    );
  END IF;

  SELECT COALESCE(SUM(
    (CASE WHEN c.win_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN v_c5w
        WHEN '10' THEN v_c10w
        WHEN '20' THEN v_c20w
        WHEN '50' THEN v_c50w
        ELSE 0
      END
    ELSE 0 END)
    +
    (CASE WHEN c.share_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN v_c5s
        WHEN '10' THEN v_c10s
        WHEN '20' THEN v_c20s
        WHEN '50' THEN v_c50s
        ELSE 0
      END
    ELSE 0 END)
  ), 0)
  INTO v_daily_earned
  FROM public.refer_challenge_claims c
  WHERE c.user_id = v_uid
    AND c.claim_date = p_claim_date;

  IF v_daily_earned + v_reward > v_daily_cap THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Daily challenge cap exceeded',
      'daily_earned', v_daily_earned,
      'daily_cap', v_daily_cap,
      'reward_rdm', v_reward
    );
  END IF;

  IF p_reward_type = 'win' THEN
    UPDATE public.refer_challenge_claims
    SET win_claimed = true, win_claimed_at = now()
    WHERE user_id = v_uid
      AND claim_date = p_claim_date
      AND challenge_key = p_challenge_key;
  ELSE
    UPDATE public.refer_challenge_claims
    SET share_claimed = true, share_claimed_at = now()
    WHERE user_id = v_uid
      AND claim_date = p_claim_date
      AND challenge_key = p_challenge_key;
  END IF;
  v_claimed_now := true;

  PERFORM public.add_rdm(v_uid, v_reward);
  SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'claimed_now', v_claimed_now,
    'already_claimed', false,
    'reward_type', p_reward_type,
    'challenge_key', p_challenge_key,
    'reward_rdm', v_reward,
    'daily_earned', v_daily_earned + v_reward,
    'daily_cap', v_daily_cap,
    'rdm', COALESCE(v_new_balance, 0)
  );
END;
$$;


ALTER FUNCTION "public"."claim_refer_challenge_reward"("p_challenge_key" "text", "p_reward_type" "text", "p_claim_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_refer_challenge_reward"("p_challenge_key" "text", "p_reward_type" "text", "p_claim_date" "date") IS 'Atomically claims win/share reward once per challenge/day; daily cap and reward sizes from rdm_config; credits profiles.rdm.';



CREATE OR REPLACE FUNCTION "public"."claim_referral_attribution"("p_ref_code" "text", "p_referee_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_referrer_id uuid;
  v_norm text := upper(trim(coalesce(p_ref_code, '')));
  v_week_start date;
  v_cnt bigint;
  v_new_bonus_id uuid;
  v_onboarding boolean;
  
  -- Dynamic config variables
  v_referrer_reward integer;
  v_referee_welcome integer;
  v_weekly_threshold integer;
  v_weekly_bonus_rdm integer;
BEGIN
  IF length(v_norm) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  IF length(v_norm) <> 7 OR v_norm !~ '^[0-9A-F]{7}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_ref');
  END IF;

  SELECT p.id INTO v_referrer_id
  FROM public.profiles p
  WHERE upper(substr(replace(p.id::text, '-', ''), 1, 7)) = v_norm
  ORDER BY p.id
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'referrer_not_found');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  SELECT onboarding_complete INTO v_onboarding FROM public.profiles WHERE id = p_referee_id;
  IF v_onboarding IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_incomplete');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referral_attributions WHERE referee_user_id = p_referee_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  -- Load dynamic configuration
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_referrer_reward'), 50) INTO v_referrer_reward;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_referee_welcome'), 25) INTO v_referee_welcome;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_weekly_bonus_threshold'), 5) INTO v_weekly_threshold;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_weekly_bonus_rdm'), 100) INTO v_weekly_bonus_rdm;

  v_week_start := (now() AT TIME ZONE 'Asia/Kolkata')::date - (extract(isodow FROM (now() AT TIME ZONE 'Asia/Kolkata')::timestamp)::integer - 1);

  INSERT INTO public.referral_attributions (
    referee_user_id,
    referrer_user_id,
    ref_code,
    credited_week_start_ist,
    referrer_rdm,
    referee_rdm
  ) VALUES (
    p_referee_id,
    v_referrer_id,
    v_norm,
    v_week_start,
    v_referrer_reward,
    v_referee_welcome
  );

  PERFORM public.add_rdm(v_referrer_id, v_referrer_reward);
  PERFORM public.add_rdm(p_referee_id, v_referee_welcome);

  SELECT count(*) INTO v_cnt
  FROM public.referral_attributions
  WHERE referrer_user_id = v_referrer_id
    AND credited_week_start_ist = v_week_start;

  IF v_cnt = v_weekly_threshold THEN
    INSERT INTO public.referral_weekly_bonuses (referrer_user_id, week_start_ist, rdm_awarded)
    VALUES (v_referrer_id, v_week_start, v_weekly_bonus_rdm)
    ON CONFLICT (referrer_user_id, week_start_ist) DO NOTHING
    RETURNING id INTO v_new_bonus_id;

    IF v_new_bonus_id IS NOT NULL THEN
      PERFORM public.add_rdm(v_referrer_id, v_weekly_bonus_rdm);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'referrer_credited', true,
    'referee_credited', true,
    'weekly_bonus', (v_new_bonus_id IS NOT NULL)
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
END;
$_$;


ALTER FUNCTION "public"."claim_referral_attribution"("p_ref_code" "text", "p_referee_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_referral_attribution"("p_ref_code" "text", "p_referee_id" "uuid") IS 'Called with service_role only. Credits referral RDM and weekly bonus (5 in IST week).';



CREATE OR REPLACE FUNCTION "public"."claim_topic_quiz_advanced_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ist date := (timezone('Asia/Kolkata', clock_timestamp()))::date;
  v_board_n text := public._norm_content_key(p_board);
  v_subject_n text := public._norm_subject_key(p_subject);
  v_topic_n text := public._norm_content_key(p_topic);
  v_sub_n text := public._norm_content_key(p_subtopic_name);
  v_topic_legacy text := public._legacy_sanitize_lookup(p_topic);
  v_sub_legacy text := public._legacy_sanitize_lookup(p_subtopic_name);
  v_bits jsonb;
  v_n int;
  v_sig text;
  v_s1 int;
  v_s2 int;
  v_s3 int;
  v_store jsonb;
  att1 jsonb;
  att2 jsonb;
  att3 jsonb;
  k1 text;
  k2 text;
  k3 text;
  set_idx int;
  start_i int;
  end_excl int;
  slice_len int;
  att jsonb;
  i int;
  q jsonb;
  opts jsonb;
  si int;
  chosen text;
  ca text;
  corr int := 0;
  tot int := 0;
  sa jsonb;
  key text;
  v_pct int;
  v_award jsonb;
  v_denial text;
  v_quiz_passed boolean := false;
  v_rdm int := 0;
  tc int;
  tw int;
  tq int;
  sig_stored text;
  v_audit_id uuid;
  v_balance int;
  v_out jsonb := NULL;
  v_quiz_rdm int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', NULL,
      'reason', 'not_authenticated'
    );
  END IF;

  IF public.is_gyan_bot_user(v_uid) THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'gyan_bot');
  END IF;

  IF p_class_level IS NULL OR p_class_level NOT IN (11, 12) THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', NULL,
      'reason', 'invalid_class_level'
    );
  END IF;

  IF v_board_n = '' OR v_subject_n = '' OR v_topic_n = '' OR v_sub_n = '' THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', NULL,
      'reason', 'invalid_scope'
    );
  END IF;

  INSERT INTO public.topic_quiz_advanced_rdm_attempts (
    user_id,
    ist_claim_date,
    board,
    subject,
    class_level,
    topic,
    subtopic_name,
    eligible,
    denial_reason,
    rdm_awarded
  )
  VALUES (
    v_uid,
    v_ist,
    left(v_board_n, 80),
    left(v_subject_n, 80),
    p_class_level,
    left(v_topic_n, 400),
    left(v_sub_n, 400),
    false,
    'in_progress',
    0
  )
  RETURNING id INTO v_audit_id;

  v_denial := NULL;

  SELECT sc.bits_questions
  INTO v_bits
  FROM public.subtopic_content sc
  WHERE sc.board = v_board_n
    AND sc.subject = v_subject_n
    AND sc.class_level = p_class_level
    AND sc.topic = v_topic_n
    AND sc.subtopic_name = v_sub_n
    AND sc.level = 'advanced'
  LIMIT 1;

  IF v_bits IS NULL AND (v_topic_legacy <> v_topic_n OR v_sub_legacy <> v_sub_n) THEN
    SELECT sc.bits_questions
    INTO v_bits
    FROM public.subtopic_content sc
    WHERE sc.board = v_board_n
      AND sc.subject = v_subject_n
      AND sc.class_level = p_class_level
      AND sc.topic = v_topic_legacy
      AND sc.subtopic_name = v_sub_legacy
      AND sc.level = 'advanced'
    LIMIT 1;
  END IF;

  IF v_bits IS NULL OR jsonb_typeof(v_bits) <> 'array' THEN
    v_denial := 'content_not_found';
  ELSE
    v_n := jsonb_array_length(v_bits);
    IF v_n <= 10 THEN
      v_denial := 'not_multiset_advanced';
    END IF;
  END IF;

  IF v_denial IS NULL THEN
    v_sig := public.bits_signature_v1(v_bits);
    IF v_sig IS NULL THEN
      v_denial := 'invalid_bits_questions';
    END IF;
  END IF;

  IF v_denial IS NULL THEN
    v_s1 := LEAST(10, v_n);
    v_s2 := LEAST(10, GREATEST(0, v_n - 10));
    v_s3 := GREATEST(0, v_n - 20);

    SELECT p.bits_test_attempts
    INTO v_store
    FROM public.profiles p
    WHERE p.id = v_uid;

    IF v_store IS NULL OR jsonb_typeof(v_store) <> 'object' THEN
      v_denial := 'no_attempts_store';
    END IF;
  END IF;

  IF v_denial IS NULL THEN
    k1 := public._bits_attempt_key(p_board, p_subject, p_class_level, p_topic, p_subtopic_name, 1);
    k2 := public._bits_attempt_key(p_board, p_subject, p_class_level, p_topic, p_subtopic_name, 2);
    k3 := public._bits_attempt_key(p_board, p_subject, p_class_level, p_topic, p_subtopic_name, 3);

    att1 := v_store -> k1;
    att2 := v_store -> k2;
    att3 := v_store -> k3;

    IF v_s1 > 0 AND (att1 IS NULL OR jsonb_typeof(att1) <> 'object') THEN
      v_denial := 'missing_set_1';
    ELSIF v_s2 > 0 AND (att2 IS NULL OR jsonb_typeof(att2) <> 'object') THEN
      v_denial := 'missing_set_2';
    ELSIF v_s3 > 0 AND (att3 IS NULL OR jsonb_typeof(att3) <> 'object') THEN
      v_denial := 'missing_set_3';
    END IF;
  END IF;

  IF v_denial IS NULL THEN
    <<set_loop>>
    FOR set_idx IN 1..3 LOOP
      slice_len := CASE set_idx
        WHEN 1 THEN v_s1
        WHEN 2 THEN v_s2
        ELSE v_s3
      END;
      IF slice_len <= 0 THEN
        CONTINUE;
      END IF;

      start_i := CASE set_idx
        WHEN 1 THEN 0
        WHEN 2 THEN v_s1
        ELSE v_s1 + v_s2
      END;
      end_excl := start_i + slice_len;

      att := CASE set_idx
        WHEN 1 THEN att1
        WHEN 2 THEN att2
        ELSE att3
      END;

      sig_stored := COALESCE(att ->> 'bitsSignature', '');
      IF sig_stored IS DISTINCT FROM v_sig THEN
        v_denial := 'signature_mismatch_set_' || set_idx::text;
        EXIT set_loop;
      END IF;

      tq := COALESCE((att ->> 'totalQuestions')::int, -1);
      tc := COALESCE((att ->> 'correctCount')::int, -1);
      tw := COALESCE((att ->> 'wrongCount')::int, -1);
      IF tq <> slice_len OR tc + tw <> slice_len OR tc < 0 OR tw < 0 THEN
        v_denial := 'incomplete_or_invalid_counts_set_' || set_idx::text;
        EXIT set_loop;
      END IF;

      sa := att -> 'selectedAnswers';
      IF sa IS NULL OR jsonb_typeof(sa) <> 'object' THEN
        v_denial := 'missing_selected_answers_set_' || set_idx::text;
        EXIT set_loop;
      END IF;

      FOR i IN start_i..end_excl - 1 LOOP
        key := i::text;
        IF NOT (sa ? key) THEN
          v_denial := 'missing_answer_index_' || i::text;
          EXIT set_loop;
        END IF;

        si := (sa ->> key)::int;
        IF si IS NULL OR si < 0 OR si > 3 THEN
          v_denial := 'invalid_answer_index_' || i::text;
          EXIT set_loop;
        END IF;

        q := v_bits -> i;
        IF q IS NULL OR jsonb_typeof(q) <> 'object' THEN
          v_denial := 'missing_question_' || i::text;
          EXIT set_loop;
        END IF;

        opts := q -> 'options';
        IF opts IS NULL OR jsonb_typeof(opts) <> 'array' OR si >= jsonb_array_length(opts) THEN
          v_denial := 'invalid_options_' || i::text;
          EXIT set_loop;
        END IF;

        chosen := (opts -> si) #>> '{}';
        ca := COALESCE(q ->> 'correctAnswer', '');
        tot := tot + 1;
        IF chosen IS NOT DISTINCT FROM ca THEN
          corr := corr + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  IF v_denial IS NULL AND tot <= 0 THEN
    v_denial := 'nothing_graded';
  END IF;

  IF v_denial IS NULL THEN
    v_pct := round(100.0 * corr::numeric / tot::numeric)::int;
    IF v_pct < 60 THEN
      v_denial := 'below_threshold';
    END IF;
  END IF;

  IF v_denial IS NULL THEN
    v_quiz_passed := true;
    v_quiz_rdm := GREATEST(1, LEAST(500, COALESCE(
      (SELECT value FROM public.rdm_config WHERE key = 'subtopic_quiz_advanced_rdm' LIMIT 1), 15)));
    v_award := public.award_daily_rdm(v_uid, 'TOPIC_QUIZ_ADVANCED_60', v_quiz_rdm);
    IF COALESCE((v_award ->> 'awarded')::boolean, false) THEN
      v_rdm := COALESCE((v_award ->> 'amount')::int, v_quiz_rdm);
      v_out := v_award || jsonb_build_object('score_percent', v_pct, 'correct', corr, 'total', tot);
    ELSE
      v_denial := COALESCE(v_award ->> 'reason', 'award_failed');
      v_out := jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', v_award -> 'balance',
        'reason', v_denial,
        'claim_date_ist', v_award -> 'claim_date_ist',
        'score_percent', v_pct,
        'correct', corr,
        'total', tot
      );
    END IF;
  END IF;

  IF v_audit_id IS NOT NULL THEN
    UPDATE public.topic_quiz_advanced_rdm_attempts
    SET
      eligible = v_quiz_passed,
      score_percent = CASE WHEN tot > 0 THEN v_pct ELSE NULL END,
      correct_count = CASE WHEN tot > 0 THEN corr ELSE NULL END,
      total_questions = CASE WHEN tot > 0 THEN tot ELSE NULL END,
      denial_reason = CASE WHEN v_rdm > 0 THEN NULL ELSE v_denial END,
      rdm_awarded = v_rdm
    WHERE id = v_audit_id;
  END IF;

  IF v_out IS NOT NULL THEN
    RETURN v_out;
  END IF;

  SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
  RETURN jsonb_build_object(
    'awarded', false,
    'amount', 0,
    'balance', COALESCE(v_balance, 0),
    'reason', COALESCE(v_denial, 'not_eligible'),
    'score_percent', CASE WHEN tot > 0 THEN v_pct ELSE NULL END,
    'correct', CASE WHEN tot > 0 THEN corr ELSE NULL END,
    'total', CASE WHEN tot > 0 THEN tot ELSE NULL END
  );
END;
$$;


ALTER FUNCTION "public"."claim_topic_quiz_advanced_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_topic_quiz_advanced_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text") IS 'Advanced 3-set topic quiz: re-grade from subtopic_content, overall >= 60%, RDM from rdm_config key subtopic_quiz_advanced_rdm (default 15) once per IST day (global).';



CREATE OR REPLACE FUNCTION "public"."create_doubt_with_escrow"("p_title" "text", "p_body" "text", "p_subject" "text", "p_cost_rdm" integer DEFAULT 0, "p_bounty_rdm" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total integer;
  v_new_id uuid;
  v_after_deduct integer;
  v_award jsonb;
  v_post_rdm integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  v_total := GREATEST(0, p_cost_rdm) + GREATEST(0, p_bounty_rdm);
  IF v_total > 0 THEN
    v_after_deduct := public.deduct_rdm(v_user_id, v_total);
    IF v_after_deduct IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Insufficient RDM');
    END IF;
  END IF;
  INSERT INTO public.doubts (user_id, title, body, subject, cost_rdm, bounty_rdm, bounty_escrowed_at)
  VALUES (
    v_user_id,
    p_title,
    COALESCE(p_body, ''),
    NULLIF(trim(p_subject), ''),
    GREATEST(0, p_cost_rdm),
    GREATEST(0, p_bounty_rdm),
    CASE WHEN GREATEST(0, p_bounty_rdm) > 0 THEN now() ELSE NULL END
  )
  RETURNING id INTO v_new_id;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_post_rdm'), 5)
  INTO v_post_rdm;
  v_post_rdm := GREATEST(1, v_post_rdm);
  v_award := public.award_daily_rdm(v_user_id, 'ASK', v_post_rdm);

  RETURN jsonb_build_object('ok', true, 'id', v_new_id, 'daily_rdm', v_award);
END;
$$;


ALTER FUNCTION "public"."create_doubt_with_escrow"("p_title" "text", "p_body" "text", "p_subject" "text", "p_cost_rdm" integer, "p_bounty_rdm" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_doubt_with_escrow"("p_title" "text", "p_body" "text", "p_subject" "text", "p_cost_rdm" integer, "p_bounty_rdm" integer) IS 'Create doubt; deduct cost/bounty; IST daily ASK reward driven by rdm_config.gyan_post_rdm.';



CREATE OR REPLACE FUNCTION "public"."deduct_rdm"("uid" "uuid", "amt" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_balance integer;
  v_prev text;
BEGIN
  v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
  PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
  UPDATE public.profiles
  SET rdm = rdm - amt
  WHERE id = uid AND rdm >= amt
  RETURNING rdm INTO new_balance;
  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;
  RETURN new_balance;
END;
$$;


ALTER FUNCTION "public"."deduct_rdm"("uid" "uuid", "amt" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."deduct_rdm"("uid" "uuid", "amt" integer) IS 'Deduct RDM for a user; returns new balance or NULL if insufficient.';



CREATE OR REPLACE FUNCTION "public"."doubt_answer_daily_rdm_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _unused jsonb;
  v_role text;
  v_points integer;
BEGIN
  IF public.is_gyan_bot_user(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.user_id;
  IF v_role = 'teacher' THEN
    SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_teacher_answer_rdm'), 30)
    INTO v_points;
  ELSE
    SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_comment_rdm'), 5)
    INTO v_points;
  END IF;

  v_points := GREATEST(1, v_points);
  _unused := public.award_daily_rdm(NEW.user_id, 'COMMENT', v_points);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."doubt_answer_daily_rdm_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."doubt_answer_reward_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.add_rdm(NEW.user_id, 5);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."doubt_answer_reward_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."doubt_report_penalty_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
  v_author_id uuid;
  v_prev text;
BEGIN
  SELECT COUNT(DISTINCT reporter_user_id) INTO v_count FROM public.doubt_answer_reports WHERE answer_id = NEW.answer_id;
  IF v_count >= 3 THEN
    SELECT user_id INTO v_author_id FROM public.doubt_answers WHERE id = NEW.answer_id;
    UPDATE public.doubt_answers SET hidden = true WHERE id = NEW.answer_id;
    IF v_author_id IS NOT NULL THEN
      v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
      PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
      UPDATE public.profiles SET rdm = GREATEST(0, rdm - 10) WHERE id = v_author_id;
      IF v_prev IS NULL THEN
        PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
      ELSE
        PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."doubt_report_penalty_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."doubt_save_daily_rdm_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _unused jsonb;
  v_points integer;
BEGIN
  IF public.is_gyan_bot_user(NEW.user_id) THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_save_rdm'), 3)
  INTO v_points;
  v_points := GREATEST(1, v_points);
  _unused := public.award_daily_rdm(NEW.user_id, 'SAVE', v_points);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."doubt_save_daily_rdm_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_buddy uuid;
BEGIN
  SELECT buddy_user_id INTO v_buddy
  FROM public.study_buddies
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  IF v_buddy IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_buddy');
  END IF;

  UPDATE public.study_buddies
     SET status = 'ended', ended_at = now()
   WHERE status = 'active'
     AND ((user_id = p_user_id AND buddy_user_id = v_buddy)
       OR (user_id = v_buddy AND buddy_user_id = p_user_id));

  RETURN jsonb_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid") IS 'Called with service_role. Ends both pair rows for the given user.';



CREATE OR REPLACE FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid", "p_buddy_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_buddy uuid;
BEGIN
  IF p_buddy_user_id IS NOT NULL THEN
    v_buddy := p_buddy_user_id;
  ELSE
    SELECT buddy_user_id INTO v_buddy
    FROM public.study_buddies
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_buddy IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_buddy');
  END IF;

  UPDATE public.study_buddies
     SET status = 'ended', ended_at = now()
   WHERE status = 'active'
     AND ((user_id = p_user_id AND buddy_user_id = v_buddy)
       OR (user_id = v_buddy AND buddy_user_id = p_user_id));

  RETURN jsonb_build_object('ok', true, 'buddyUserId', v_buddy);
END;
$$;


ALTER FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid", "p_buddy_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid", "p_buddy_user_id" "uuid") IS 'Ends one active buddy pair. Pass p_buddy_user_id to end a specific buddy; omit to end most recent.';



CREATE OR REPLACE FUNCTION "public"."enforce_classroom_sections_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.classroom_sections
  WHERE classroom_id = NEW.classroom_id;

  IF cnt >= 6 THEN
    RAISE EXCEPTION 'A classroom can have at most 6 sections';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_classroom_sections_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_dwell_events_partition"("p_month" "date" DEFAULT ("date_trunc"('month'::"text", "now"()))::"date") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  part_name text;
  m_start date;
  m_end date;
BEGIN
  m_start := date_trunc('month', p_month)::date;
  m_end := (m_start + interval '1 month')::date;
  part_name := format('student_learning_dwell_%s', to_char(m_start, 'YYYY_MM'));
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.student_learning_dwell_events FOR VALUES FROM (%L) TO (%L)',
    part_name,
    m_start,
    m_end
  );
  RETURN part_name;
END;
$$;


ALTER FUNCTION "public"."ensure_dwell_events_partition"("p_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_similar_answered_doubt"("p_title" "text", "p_min_similarity" real DEFAULT 0.85) RETURNS TABLE("source_doubt_id" "uuid", "answer_body" "text", "similarity_score" real)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT d.id, da.body, similarity(d.title, trim(coalesce(p_title, '')))::real AS similarity_score
  FROM public.doubts d
  INNER JOIN public.doubt_answers da ON da.doubt_id = d.id AND COALESCE(da.hidden, false) = false
  WHERE trim(coalesce(p_title, '')) <> ''
    AND similarity(d.title, trim(p_title)) >= p_min_similarity
  ORDER BY similarity_score DESC, da.is_accepted DESC, da.upvotes DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."find_similar_answered_doubt"("p_title" "text", "p_min_similarity" real) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_similar_answered_doubt"("p_title" "text", "p_min_similarity" real) IS 'Returns top similar doubt that already has at least one visible answer; for ProfPi answer reuse.';



CREATE OR REPLACE FUNCTION "public"."get_adaptive_play_questions"("p_domain" "text", "p_category" "text", "p_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "content" "jsonb", "options" "jsonb", "correct_answer_index" integer, "explanation" "text", "difficulty_rating" integer, "category" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
DECLARE
  v_user_id uuid := auth.uid();
  v_reset timestamptz;
  v_pool int;
  v_mastered int;
  v_domain_wide boolean := p_category IN (
    'academic_all', 'funbrain_all', 'academic_gauntlet', 'funbrain_gauntlet'
  );
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF v_domain_wide THEN
    IF (p_category IN ('academic_all', 'academic_gauntlet') AND p_domain IS DISTINCT FROM 'academic')
       OR (p_category IN ('funbrain_all', 'funbrain_gauntlet') AND p_domain IS DISTINCT FROM 'funbrain') THEN
      RETURN;
    END IF;
  END IF;

  SELECT s.question_pool_reset_at INTO v_reset
  FROM public.user_play_stats s
  WHERE s.user_id = v_user_id AND s.category = p_category;

  IF NOT FOUND THEN
    INSERT INTO public.user_play_stats (user_id, category, question_pool_reset_at)
    VALUES (v_user_id, p_category, now())
    ON CONFLICT ON CONSTRAINT user_play_stats_pkey DO NOTHING;

    SELECT s.question_pool_reset_at INTO v_reset
    FROM public.user_play_stats s
    WHERE s.user_id = v_user_id AND s.category = p_category;
  END IF;

  v_reset := COALESCE(v_reset, now());

  IF v_domain_wide THEN
    SELECT COUNT(*)::int INTO v_pool
    FROM public.play_questions q
    WHERE q.domain = p_domain;

    IF v_pool = 0 THEN
      RETURN;
    END IF;

    SELECT COUNT(DISTINCT h.question_id)::int INTO v_mastered
    FROM public.play_history h
    INNER JOIN public.play_questions pq ON pq.id = h.question_id
    WHERE h.user_id = v_user_id
      AND h.is_correct = true
      AND pq.domain = p_domain
      AND h.created_at >= v_reset
      AND h.pool_key IS NOT DISTINCT FROM p_category;

    IF v_mastered >= v_pool THEN
      UPDATE public.user_play_stats s
      SET question_pool_reset_at = now(),
          updated_at = now()
      WHERE s.user_id = v_user_id AND s.category = p_category;
      v_reset := now();
    END IF;

    RETURN QUERY
    WITH eligible AS (
      SELECT
        q.id,
        q.content,
        q.options,
        q.correct_answer_index,
        q.explanation,
        q.difficulty_rating,
        q.category,
        row_number() OVER (PARTITION BY q.category ORDER BY random()) AS rn
      FROM public.play_questions q
      WHERE q.domain = p_domain
        AND NOT EXISTS (
          SELECT 1
          FROM public.play_history h
          WHERE h.user_id = v_user_id
            AND h.question_id = q.id
            AND h.is_correct = true
            AND h.created_at >= v_reset
            AND h.pool_key IS NOT DISTINCT FROM p_category
        )
    ),
    cat_list AS (
      SELECT DISTINCT category FROM eligible
    ),
    c_count AS (
      SELECT COUNT(*)::int AS c FROM cat_list
    ),
    per AS (
      SELECT
        CASE WHEN (SELECT c FROM c_count) = 0 THEN 0
             ELSE p_count / (SELECT c FROM c_count) END AS floor_part,
        CASE WHEN (SELECT c FROM c_count) = 0 THEN 0
             ELSE p_count % (SELECT c FROM c_count) END AS rem
    ),
    cat_quota AS (
      SELECT
        cl.category,
        (SELECT floor_part FROM per) + CASE
          WHEN row_number() OVER (ORDER BY random()) <= (SELECT rem FROM per) THEN 1
          ELSE 0
        END AS quota
      FROM cat_list cl
    ),
    first_pick AS (
      SELECT e.id, e.content, e.options, e.correct_answer_index, e.explanation, e.difficulty_rating, e.category
      FROM eligible e
      INNER JOIN cat_quota cq ON cq.category = e.category
      WHERE cq.quota > 0 AND e.rn <= cq.quota
    ),
    deficit AS (
      SELECT GREATEST(0, p_count - (SELECT COUNT(*)::int FROM first_pick)) AS d
    ),
    second_pick AS (
      SELECT e.id, e.content, e.options, e.correct_answer_index, e.explanation, e.difficulty_rating, e.category
      FROM eligible e
      WHERE NOT EXISTS (SELECT 1 FROM first_pick fp WHERE fp.id = e.id)
      ORDER BY random()
      LIMIT (SELECT d FROM deficit)
    ),
    combined AS (
      SELECT fp.id, fp.content, fp.options, fp.correct_answer_index, fp.explanation, fp.difficulty_rating, fp.category, random() AS ord
      FROM first_pick fp
      UNION ALL
      SELECT sp.id, sp.content, sp.options, sp.correct_answer_index, sp.explanation, sp.difficulty_rating, sp.category, random() AS ord
      FROM second_pick sp
    )
    SELECT c.id, c.content, c.options, c.correct_answer_index, c.explanation, c.difficulty_rating, c.category
    FROM combined c
    ORDER BY c.ord
    LIMIT p_count;
    RETURN;
  END IF;

  SELECT COUNT(*)::int INTO v_pool
  FROM public.play_questions q
  WHERE q.domain = p_domain AND q.category = p_category;

  IF v_pool = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT h.question_id)::int INTO v_mastered
  FROM public.play_history h
  INNER JOIN public.play_questions pq ON pq.id = h.question_id
  WHERE h.user_id = v_user_id
    AND h.is_correct = true
    AND pq.domain = p_domain
    AND pq.category = p_category
    AND h.created_at >= v_reset;

  IF v_mastered >= v_pool THEN
    UPDATE public.user_play_stats s
    SET question_pool_reset_at = now(),
        updated_at = now()
    WHERE s.user_id = v_user_id AND s.category = p_category;
    v_reset := now();
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.content,
    q.options,
    q.correct_answer_index,
    q.explanation,
    q.difficulty_rating,
    q.category
  FROM public.play_questions q
  WHERE q.domain = p_domain
    AND q.category = p_category
    AND NOT EXISTS (
      SELECT 1
      FROM public.play_history h
      WHERE h.user_id = v_user_id
        AND h.question_id = q.id
        AND h.is_correct = true
        AND h.created_at >= v_reset
    )
  ORDER BY random()
  LIMIT p_count;
END;
$$;


ALTER FUNCTION "public"."get_adaptive_play_questions"("p_domain" "text", "p_category" "text", "p_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_adaptive_play_questions"("p_domain" "text", "p_category" "text", "p_count" integer) IS 'Domain-wide (*_all, *_gauntlet): stratified by play_questions.category; excludes correct answers whose pool_key matches p_category since question_pool_reset_at; mastery reset counts same pool_key. Single-category path unchanged.';



CREATE OR REPLACE FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date") RETURNS TABLE("rank" bigint, "user_id" "uuid", "display_name" "text", "correct_count" integer, "total_time_ms" integer, "completed_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    row_number() OVER (ORDER BY g.correct_count DESC, g.total_time_ms ASC)::bigint AS rank,
    g.user_id,
    p.name AS display_name,
    g.correct_count,
    g.total_time_ms,
    g.completed_at
  FROM public.daily_gauntlet_attempts g
  LEFT JOIN public.profiles p ON p.id = g.user_id
  WHERE g.gauntlet_date = p_gauntlet_date
  ORDER BY g.correct_count DESC, g.total_time_ms ASC;
END;
$$;


ALTER FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date") IS 'Leaderboard for a date: by correct count desc, then time asc.';



CREATE OR REPLACE FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date", "p_domain" "text" DEFAULT 'funbrain'::"text") RETURNS TABLE("rank" bigint, "user_id" "uuid", "display_name" "text", "correct_count" integer, "total_time_ms" integer, "completed_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    row_number() OVER (ORDER BY g.correct_count DESC, g.total_time_ms ASC)::bigint,
    g.user_id, p.name AS display_name, g.correct_count, g.total_time_ms, g.completed_at
  FROM public.daily_gauntlet_attempts g
  LEFT JOIN public.profiles p ON p.id = g.user_id
  WHERE g.gauntlet_date = p_gauntlet_date AND g.domain = p_domain
  ORDER BY g.correct_count DESC, g.total_time_ms ASC;
END;
$$;


ALTER FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date", "p_domain" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date") RETURNS TABLE("id" "uuid", "content" "jsonb", "options" "jsonb", "correct_answer_index" integer, "explanation" "text", "difficulty_rating" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.content,
    q.options,
    q.correct_answer_index,
    q.explanation,
    q.difficulty_rating
  FROM public.play_questions q
  WHERE q.domain = 'funbrain'
  ORDER BY md5(q.id::text || p_date::text)
  LIMIT 10;
END;
$$;


ALTER FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date") IS 'Returns same 10 funbrain questions for a given date (deterministic).';



CREATE OR REPLACE FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date", "p_domain" "text" DEFAULT 'funbrain'::"text") RETURNS TABLE("id" "uuid", "content" "jsonb", "options" "jsonb", "correct_answer_index" integer, "explanation" "text", "difficulty_rating" integer, "category" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- p_date retained for callers; question set is per-user adaptive mixed pool (gauntlet cycle key).
  RETURN QUERY
  SELECT *
  FROM public.get_adaptive_play_questions(
    p_domain,
    CASE WHEN p_domain = 'academic' THEN 'academic_gauntlet' ELSE 'funbrain_gauntlet' END,
    10
  );
END;
$$;


ALTER FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date", "p_domain" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date", "p_domain" "text") IS '10 questions: domain-wide adaptive pool using academic_gauntlet / funbrain_gauntlet cycle (separate from streak *_all keys). p_date unused but kept for API compatibility.';



CREATE OR REPLACE FUNCTION "public"."get_daily_rdm_earned_ist"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(SUM(c.points_awarded), 0)::integer
  FROM public.daily_reward_claims c
  WHERE c.user_id = auth.uid()
    AND c.claim_date_ist = ((now() AT TIME ZONE 'Asia/Kolkata'))::date;
$$;


ALTER FUNCTION "public"."get_daily_rdm_earned_ist"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_daily_rdm_earned_ist"() IS 'Sum of IST-day daily milestone RDM for current user.';



CREATE OR REPLACE FUNCTION "public"."get_prep_calendar_summary"("p_today" "date") RETURNS json
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  streak_val int := 0;
  d date;
  total_val int;
begin
  if uid is null then
    return json_build_object('streak', 0, 'total_active_days', 0);
  end if;

  select count(*)::int into total_val
  from public.prep_calendar_day_activity
  where user_id = uid
    and (class_count + revision_count + mock_count + doubt_count) > 0;

  d := p_today;
  loop
    exit when not exists (
      select 1
      from public.prep_calendar_day_activity
      where user_id = uid
        and day = d
        and (class_count + revision_count + mock_count + doubt_count) > 0
    );
    streak_val := streak_val + 1;
    d := d - 1;
    exit when streak_val > 10000;
  end loop;

  return json_build_object(
    'streak', streak_val,
    'total_active_days', coalesce(total_val, 0)
  );
end;
$$;


ALTER FUNCTION "public"."get_prep_calendar_summary"("p_today" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_refer_challenge_day_status"("p_claim_date" "date" DEFAULT (("now"() AT TIME ZONE 'utc'::"text"))::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_daily_earned integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_daily_cap integer;
  v_c5w integer;
  v_c5s integer;
  v_c10w integer;
  v_c10s integer;
  v_c20w integer;
  v_c20s integer;
  v_c50w integer;
  v_c50s integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'refer_challenge_daily_rdm_cap'), 50) INTO v_daily_cap;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_5_win'), 3) INTO v_c5w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_5_share'), 2) INTO v_c5s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_10_win'), 7) INTO v_c10w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_10_share'), 3) INTO v_c10s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_20_win'), 15) INTO v_c20w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_20_share'), 5) INTO v_c20s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_50_win'), 30) INTO v_c50w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_50_share'), 20) INTO v_c50s;

  SELECT COALESCE(SUM(
    (CASE WHEN c.win_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN v_c5w
        WHEN '10' THEN v_c10w
        WHEN '20' THEN v_c20w
        WHEN '50' THEN v_c50w
        ELSE 0
      END
    ELSE 0 END)
    +
    (CASE WHEN c.share_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN v_c5s
        WHEN '10' THEN v_c10s
        WHEN '20' THEN v_c20s
        WHEN '50' THEN v_c50s
        ELSE 0
      END
    ELSE 0 END)
  ), 0)
  INTO v_daily_earned
  FROM public.refer_challenge_claims c
  WHERE c.user_id = v_uid
    AND c.claim_date = p_claim_date;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'challenge_key', c.challenge_key,
        'win_claimed', c.win_claimed,
        'share_claimed', c.share_claimed
      )
      ORDER BY c.challenge_key
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM public.refer_challenge_claims c
  WHERE c.user_id = v_uid
    AND c.claim_date = p_claim_date;

  RETURN jsonb_build_object(
    'ok', true,
    'claim_date', p_claim_date,
    'daily_earned', v_daily_earned,
    'daily_cap', v_daily_cap,
    'claims', v_rows
  );
END;
$$;


ALTER FUNCTION "public"."get_refer_challenge_day_status"("p_claim_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_refer_challenge_day_status"("p_claim_date" "date") IS 'Returns current user daily refer challenge rewards + claim states (amounts from rdm_config).';



CREATE OR REPLACE FUNCTION "public"."get_study_streak_summary"("p_today" "date") RETURNS json
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  streak_val int := 0;
  d date;
  d_anchor date;
  month_start date := date_trunc('month', p_today::timestamp)::date;
  month_end date := (date_trunc('month', p_today::timestamp) + interval '1 month - 1 day')::date;
  active_month int := 0;
BEGIN
  if uid is null then
    return json_build_object('streak', 0, 'activeDaysThisMonth', 0);
  end if;

  select count(*)::int into active_month
  from public.user_study_day_totals
  where user_id = uid
    and day >= month_start
    and day <= month_end
    and presence_ms >= 1800000;

  select max(day) into d_anchor
  from public.user_study_day_totals
  where user_id = uid
    and day <= p_today
    and presence_ms >= 1800000;

  if d_anchor is null then
    return json_build_object(
      'streak', 0,
      'activeDaysThisMonth', coalesce(active_month, 0)
    );
  end if;

  d := d_anchor;
  loop
    exit when not exists (
      select 1
      from public.user_study_day_totals
      where user_id = uid
        and day = d
        and presence_ms >= 1800000
    );
    streak_val := streak_val + 1;
    d := d - 1;
    exit when streak_val > 10000;
  end loop;

  return json_build_object(
    'streak', streak_val,
    'activeDaysThisMonth', coalesce(active_month, 0)
  );
end;
$$;


ALTER FUNCTION "public"."get_study_streak_summary"("p_today" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_mock_subject_score_averages"() RETURNS TABLE("subject" "text", "avg_pct" integer, "paper_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH latest_per_paper AS (
    SELECT DISTINCT ON (m.paper_id)
      m.paper_id,
      m.score_percent
    FROM public.mock_rdm_bonus_attempts m
    WHERE m.user_id = auth.uid()
      AND m.score_percent IS NOT NULL
      AND m.score_percent >= 0
      AND m.score_percent <= 100
    ORDER BY m.paper_id, m.created_at DESC
  ),
  labeled AS (
    SELECT
      CASE
        WHEN mp.subjects_covered IS NOT NULL AND array_length(mp.subjects_covered, 1) >= 1 THEN
          lower(trim(mp.subjects_covered[1]))
        ELSE 'math'
      END AS subj,
      l.score_percent::numeric AS pct
    FROM latest_per_paper l
    INNER JOIN public.mock_papers mp ON mp.id = l.paper_id
  )
  SELECT
    labeled.subj AS subject,
    ROUND(AVG(labeled.pct))::integer AS avg_pct,
    COUNT(*)::bigint AS paper_count
  FROM labeled
  WHERE labeled.subj IN ('physics', 'chemistry', 'math')
  GROUP BY labeled.subj;
$$;


ALTER FUNCTION "public"."get_user_mock_subject_score_averages"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_mock_subject_score_averages"() IS 'Student profile: mean catalog mock % per subject — latest attempt per paper, primary subject from subjects_covered[1].';



CREATE OR REPLACE FUNCTION "public"."get_user_saved_item_counts"("p_user_id" "uuid") RETURNS TABLE("item_type" "text", "cnt" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT item_type, count(*) as cnt
  FROM public.user_saved_items
  WHERE user_id = p_user_id
  GROUP BY item_type;
$$;


ALTER FUNCTION "public"."get_user_saved_item_counts"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  default_class_id uuid;
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    avatar_url,
    role,
    onboarding_complete,
    google_connected,
    rdm
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'User'
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'student',
    false,
    COALESCE((NEW.raw_app_meta_data ->> 'provider') = 'google', false),
    0
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO default_class_id FROM public.classrooms WHERE name = 'Class' LIMIT 1;
  IF default_class_id IS NOT NULL THEN
    INSERT INTO public.classroom_members (classroom_id, user_id, role)
    VALUES (default_class_id, NEW.id, 'student')
    ON CONFLICT (classroom_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_doubt_views"("p_doubt_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.doubts SET views = views + 1 WHERE id = p_doubt_id;
END;
$$;


ALTER FUNCTION "public"."increment_doubt_views"("p_doubt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_prep_calendar_day"("p_day" "date", "p_field" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  d int := case when p_field = 'class' then 1 else 0 end;
  r int := case when p_field = 'revision' then 1 else 0 end;
  m int := case when p_field = 'mock' then 1 else 0 end;
  b int := case when p_field = 'doubt' then 1 else 0 end;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_field is null or p_field not in ('class', 'revision', 'mock', 'doubt') then
    raise exception 'invalid p_field';
  end if;

  insert into public.prep_calendar_day_activity (user_id, day, class_count, revision_count, mock_count, doubt_count)
  values (uid, p_day, d, r, m, b)
  on conflict (user_id, day) do update set
    class_count = prep_calendar_day_activity.class_count + excluded.class_count,
    revision_count = prep_calendar_day_activity.revision_count + excluded.revision_count,
    mock_count = prep_calendar_day_activity.mock_count + excluded.mock_count,
    doubt_count = prep_calendar_day_activity.doubt_count + excluded.doubt_count,
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."increment_prep_calendar_day"("p_day" "date", "p_field" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_gyan_bot_user"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT p_user_id IN (
    'f2a00000-0000-4000-8000-000000000001'::uuid,
    'f2a00000-0000-4000-8000-000000000002'::uuid,
    'f2a00000-0000-4000-8000-000000000003'::uuid,
    'f2a00000-0000-4000-8000-000000000004'::uuid,
    'f2a00000-0000-4000-8000-000000000005'::uuid,
    'f2a00000-0000-4000-8000-000000000006'::uuid,
    'f2a00000-0000-4000-8000-000000000007'::uuid,
    'f2a00000-0000-4000-8000-000000000008'::uuid,
    'f2a00000-0000-4000-8000-000000000009'::uuid,
    'f2a00000-0000-4000-8000-00000000000a'::uuid,
    'f2a00000-0000-4000-8000-00000000000b'::uuid,
    'f2a00000-0000-4000-8000-00000000000c'::uuid,
    'f2a00000-0000-4000-8000-00000000000d'::uuid
  );
$$;


ALTER FUNCTION "public"."is_gyan_bot_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_owner_prefixed_storage_path"("path" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select
    split_part(coalesce(path, ''), '/', 1) = auth.uid()::text;
$$;


ALTER FUNCTION "public"."is_owner_prefixed_storage_path"("path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."maintain_student_section_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  now_ts timestamptz := now();
BEGIN
  -- Handle Delete operations
  IF TG_OP = 'DELETE' THEN
    -- Only track students (never teachers)
    IF (COALESCE(OLD.role, 'student')) = 'teacher' THEN
      RETURN OLD;
    END IF;

    UPDATE public.student_section_history
    SET left_at = now_ts
    WHERE classroom_id = OLD.classroom_id
      AND user_id = OLD.user_id
      AND left_at IS NULL;

    RETURN OLD;
  END IF;

  -- Only track students (never teachers) for insert/update
  IF (COALESCE(NEW.role, 'student')) = 'teacher' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.student_section_history (classroom_id, user_id, section_id, joined_at, left_at)
    SELECT NEW.classroom_id,
           NEW.user_id,
           NEW.section_id,
           COALESCE(NEW.joined_at, now_ts),
           NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.student_section_history ssh
      WHERE ssh.classroom_id = NEW.classroom_id
        AND ssh.user_id = NEW.user_id
        AND ssh.left_at IS NULL
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- If a row flips to teacher, close the open interval (best effort) and stop tracking
    IF (COALESCE(OLD.role, 'student')) <> 'teacher' AND (COALESCE(NEW.role, 'student')) = 'teacher' THEN
      UPDATE public.student_section_history
      SET left_at = now_ts
      WHERE classroom_id = NEW.classroom_id
        AND user_id = NEW.user_id
        AND left_at IS NULL;
      RETURN NEW;
    END IF;

    -- Track section transfers (including to/from NULL)
    IF (OLD.section_id IS DISTINCT FROM NEW.section_id) THEN
      -- Close current open interval
      UPDATE public.student_section_history
      SET left_at = now_ts
      WHERE classroom_id = NEW.classroom_id
        AND user_id = NEW.user_id
        AND left_at IS NULL;

      -- Open new interval for the new section
      INSERT INTO public.student_section_history (classroom_id, user_id, section_id, joined_at, left_at)
      VALUES (NEW.classroom_id, NEW.user_id, NEW.section_id, now_ts, NULL);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."maintain_student_section_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_episodic_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") RETURNS TABLE("id" "uuid", "chunk_text" "text", "similarity" double precision)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    em.id,
    em.chunk_text,
    (1 - (em.embedding <=> query_embedding))::double precision AS similarity
  FROM public.episodic_memory em
  WHERE em.user_id = p_user_id
    AND (1 - (em.embedding <=> query_embedding)) > match_threshold
  ORDER BY em.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_episodic_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."match_episodic_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") IS 'Top episodic chunks for a user by cosine similarity; threshold on similarity in [0,1].';



CREATE OR REPLACE FUNCTION "public"."match_episodic_memory_scoped"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid", "p_context_key" "text") RETURNS TABLE("id" "uuid", "chunk_text" "text", "similarity" double precision)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    em.id,
    em.chunk_text,
    (1 - (em.embedding <=> query_embedding))::double precision AS similarity
  FROM public.episodic_memory em
  WHERE em.user_id = p_user_id
    AND em.context_key = p_context_key
    AND (1 - (em.embedding <=> query_embedding)) > match_threshold
  ORDER BY em.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_episodic_memory_scoped"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid", "p_context_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."match_episodic_memory_scoped"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid", "p_context_key" "text") IS 'Top episodic chunks for a user filtered by context key and cosine similarity.';



CREATE OR REPLACE FUNCTION "public"."news_blog_posts_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."news_blog_posts_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_duplicate_subtopic_names"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.name := btrim(NEW.name);

  IF EXISTS (
    SELECT 1
    FROM public.curriculum_subtopics s
    WHERE s.topic_id = NEW.topic_id
      AND lower(btrim(s.name)) = lower(NEW.name)
      AND (NEW.id IS NULL OR s.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Duplicate subtopic "%" for topic_id %', NEW.name, NEW.topic_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_duplicate_subtopic_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_academics_enforce_verified"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(
    auth.jwt() ->> 'role',
    nullif(trim(coalesce(current_setting('request.jwt.claim.role', true), '')), '')
  );

  IF coalesce(NEW.verified, '') <> 'verified' THEN
    RETURN NEW;
  END IF;

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND coalesce(OLD.verified, '') = 'verified' AND NEW.verified = 'verified' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only administrators can mark academic records as verified'
    USING ERRCODE = 'check_violation';
END;
$$;


ALTER FUNCTION "public"."profile_academics_enforce_verified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profile_achievements_enforce_verified"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(
    auth.jwt() ->> 'role',
    nullif(trim(coalesce(current_setting('request.jwt.claim.role', true), '')), '')
  );

  IF coalesce(NEW.verified, '') <> 'verified' THEN
    RETURN NEW;
  END IF;

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND coalesce(OLD.verified, '') = 'verified' AND NEW.verified = 'verified' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only administrators can mark achievements as verified'
    USING ERRCODE = 'check_violation';
END;
$$;


ALTER FUNCTION "public"."profile_achievements_enforce_verified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_enforce_rdm_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_default_rdm integer := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.profiles_rdm_mutation_allowed() THEN
      IF NOT public.is_gyan_bot_user(NEW.id) AND NEW.rdm IS DISTINCT FROM v_default_rdm THEN
        NEW.rdm := v_default_rdm;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.rdm IS DISTINCT FROM NEW.rdm
       AND NOT public.profiles_rdm_mutation_allowed()
       AND NOT public.is_gyan_bot_user(NEW.id) THEN
      RAISE EXCEPTION 'RDM balance cannot be modified directly';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."profiles_enforce_rdm_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_rdm_mutation_allowed"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(NULLIF(current_setting('app.allow_profile_rdm_mutation', true), ''), '0') = '1';
$$;


ALTER FUNCTION "public"."profiles_rdm_mutation_allowed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_empty_dwell_partitions"("p_months_ahead" integer DEFAULT 12, "p_months_behind" integer DEFAULT 6) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $_$
DECLARE
  r record;
  part_month date;
  window_start date;
  window_end date;
  row_count bigint;
  dropped text[] := '{}';
  kept text[] := '{}';
  skipped_nonempty text[] := '{}';
BEGIN
  IF p_months_ahead < 1 OR p_months_ahead > 24 THEN
    RAISE EXCEPTION 'p_months_ahead must be between 1 and 24';
  END IF;
  IF p_months_behind < 1 OR p_months_behind > 24 THEN
    RAISE EXCEPTION 'p_months_behind must be between 1 and 24';
  END IF;

  window_start := (date_trunc('month', now()) - make_interval(months => p_months_behind))::date;
  window_end := (date_trunc('month', now()) + make_interval(months => p_months_ahead + 1))::date;

  PERFORM public.ensure_dwell_events_partition(date_trunc('month', now())::date);
  PERFORM public.ensure_dwell_events_partition((date_trunc('month', now()) + interval '1 month')::date);

  FOR r IN
    SELECT c.relname AS part_name
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.relname = 'student_learning_dwell_events'
      AND c.relname ~ '^student_learning_dwell_[0-9]{4}_[0-9]{2}$'
  LOOP
    part_month := to_date(substring(r.part_name from '([0-9]{4}_[0-9]{2})$'), 'YYYY_MM');

    EXECUTE format('SELECT count(*)::bigint FROM public.%I', r.part_name) INTO row_count;

    IF row_count > 0 THEN
      skipped_nonempty := array_append(skipped_nonempty, r.part_name);
      CONTINUE;
    END IF;

    IF part_month >= window_start AND part_month < window_end THEN
      kept := array_append(kept, r.part_name);
      CONTINUE;
    END IF;

    EXECUTE format('DROP TABLE public.%I', r.part_name);
    dropped := array_append(dropped, r.part_name);
  END LOOP;

  RETURN jsonb_build_object(
    'dropped', dropped,
    'dropped_count', coalesce(array_length(dropped, 1), 0),
    'kept_empty_in_window', kept,
    'kept_nonempty', skipped_nonempty,
    'window_start', window_start,
    'window_end_exclusive', window_end,
    'months_ahead', p_months_ahead,
    'months_behind', p_months_behind
  );
END;
$_$;


ALTER FUNCTION "public"."prune_empty_dwell_partitions"("p_months_ahead" integer, "p_months_behind" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prune_empty_dwell_partitions"("p_months_ahead" integer, "p_months_behind" integer) IS 'Drop empty student_learning_dwell_* monthly partitions outside rolling window. Skips any partition with rows.';



CREATE OR REPLACE FUNCTION "public"."prune_telemetry_logs"("p_ai_token_days" integer DEFAULT 90, "p_dwell_days" integer DEFAULT 180) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_ai bigint := 0;
  v_dwell bigint := 0;
BEGIN
  IF p_ai_token_days < 7 OR p_ai_token_days > 365 THEN
    RAISE EXCEPTION 'p_ai_token_days must be between 7 and 365';
  END IF;
  IF p_dwell_days < 7 OR p_dwell_days > 730 THEN
    RAISE EXCEPTION 'p_dwell_days must be between 7 and 730';
  END IF;

  DELETE FROM public.ai_token_logs
  WHERE created_at < now() - make_interval(days => p_ai_token_days);
  GET DIAGNOSTICS v_ai = ROW_COUNT;

  DELETE FROM public.student_learning_dwell_events
  WHERE occurred_at < now() - make_interval(days => p_dwell_days);
  GET DIAGNOSTICS v_dwell = ROW_COUNT;

  RETURN jsonb_build_object(
    'ai_token_logs_deleted', v_ai,
    'dwell_events_deleted', v_dwell,
    'ai_token_retention_days', p_ai_token_days,
    'dwell_retention_days', p_dwell_days
  );
END;
$$;


ALTER FUNCTION "public"."prune_telemetry_logs"("p_ai_token_days" integer, "p_dwell_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconcile_inactive_day_penalties"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_plan_tier text;
  v_free_trial_activated boolean;
  v_activated_at timestamptz;
  v_subscription_started_at timestamptz;
  v_subscription_expires_at timestamptz;
  v_created_at timestamptz;
  v_start_date date;
  v_end_date date := (now() - interval '1 day')::date;
  v_date date;
  v_presence bigint;
  v_penalty integer := 0;
  v_penalties_applied integer := 0;
  v_total_deducted integer := 0;
  v_guc_prev text;

  v_milestone_days integer;
  v_milestone_rdm integer;
  v_d_anchor date;
  v_streak_val integer := 0;
  v_streak_start_date date;
  v_milestone_credited boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT
    plan_tier,
    free_trial_activated,
    free_trial_activated_at,
    subscription_started_at,
    subscription_expires_at,
    created_at
  INTO
    v_plan_tier,
    v_free_trial_activated,
    v_activated_at,
    v_subscription_started_at,
    v_subscription_expires_at,
    v_created_at
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  v_plan_tier := lower(coalesce(v_plan_tier, 'free'));

  -- Match app normalizePlanTier: expired paid grants revert to free / free_trial.
  IF v_subscription_expires_at IS NOT NULL AND v_subscription_expires_at <= now() THEN
    IF coalesce(v_free_trial_activated, false) THEN
      v_plan_tier := 'free_trial';
    ELSE
      v_plan_tier := 'free';
    END IF;
  ELSIF v_plan_tier = 'scholar' THEN
    v_plan_tier := 'starter';
  ELSIF v_plan_tier IN ('champion', 'pro_plus') THEN
    v_plan_tier := 'pro';
  END IF;

  CASE v_plan_tier
    WHEN 'free_trial' THEN
      SELECT COALESCE(
        (SELECT value::integer FROM public.rdm_config WHERE key = 'free_trial_inactive_penalty_rdm'),
        50
      ) INTO v_penalty;
      IF v_activated_at IS NOT NULL THEN
        v_start_date := (v_activated_at + interval '1 day')::date;
      ELSE
        v_start_date := (v_created_at + interval '1 day')::date;
      END IF;
    WHEN 'free' THEN
      SELECT COALESCE(
        (SELECT value::integer FROM public.rdm_config WHERE key = 'free_inactive_penalty_rdm'),
        50
      ) INTO v_penalty;
      v_start_date := greatest((v_created_at + interval '1 day')::date, '2026-05-01'::date);
    WHEN 'starter' THEN
      SELECT COALESCE(
        (SELECT value::integer FROM public.rdm_config WHERE key = 'starter_inactive_penalty_rdm'),
        50
      ) INTO v_penalty;
      v_start_date := greatest(
        (coalesce(v_subscription_started_at, v_created_at) + interval '1 day')::date,
        '2026-05-01'::date
      );
    WHEN 'pro' THEN
      SELECT COALESCE(
        (SELECT value::integer FROM public.rdm_config WHERE key = 'pro_inactive_penalty_rdm'),
        25
      ) INTO v_penalty;
      v_start_date := greatest(
        (coalesce(v_subscription_started_at, v_created_at) + interval '1 day')::date,
        '2026-05-01'::date
      );
    ELSE
      v_penalty := 0;
      v_start_date := v_end_date + 1;
  END CASE;

  v_penalty := greatest(0, coalesce(v_penalty, 0));

  IF v_penalty > 0 AND v_start_date <= v_end_date THEN
    v_date := v_start_date;
    WHILE v_date <= v_end_date LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.inactive_day_penalties
        WHERE user_id = v_user_id AND day = v_date
      ) THEN
        SELECT COALESCE(
          (SELECT presence_ms FROM public.user_study_day_totals WHERE user_id = v_user_id AND day = v_date),
          0
        ) INTO v_presence;

        IF v_presence < 1800000 THEN
          INSERT INTO public.inactive_day_penalties (user_id, day, penalty_rdm, penalized_at)
          VALUES (v_user_id, v_date, v_penalty, now())
          ON CONFLICT (user_id, day) DO NOTHING;

          v_total_deducted := v_total_deducted + v_penalty;
          v_penalties_applied := v_penalties_applied + 1;
        END IF;
      END IF;

      v_date := v_date + 1;
    END LOOP;

    IF v_total_deducted > 0 THEN
      v_guc_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
      PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
      UPDATE public.profiles
      SET rdm = greatest(0, rdm - v_total_deducted)
      WHERE id = v_user_id;
      IF v_guc_prev IS NULL THEN
        PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
      ELSE
        PERFORM set_config('app.allow_profile_rdm_mutation', v_guc_prev, true);
      END IF;
    END IF;
  END IF;

  SELECT COALESCE(
    (SELECT value::integer FROM public.rdm_config WHERE key = 'study_streak_bonus_days'),
    90
  ) INTO v_milestone_days;

  SELECT COALESCE(
    (SELECT value::integer FROM public.rdm_config WHERE key = 'study_streak_bonus_rdm'),
    500
  ) INTO v_milestone_rdm;

  SELECT max(day) INTO v_d_anchor
  FROM public.user_study_day_totals
  WHERE user_id = v_user_id
    AND day <= now()::date
    AND presence_ms >= 1800000;

  IF v_d_anchor IS NOT NULL THEN
    v_streak_val := 0;
    v_date := v_d_anchor;
    LOOP
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.user_study_day_totals
        WHERE user_id = v_user_id
          AND day = v_date
          AND presence_ms >= 1800000
      );
      v_streak_val := v_streak_val + 1;
      v_date := v_date - 1;
      EXIT WHEN v_streak_val > 10000;
    END LOOP;
    v_streak_start_date := v_date + 1;

    IF v_streak_val >= v_milestone_days THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.study_streak_milestone_claims
        WHERE user_id = v_user_id
          AND streak_start_date = v_streak_start_date
          AND milestone_days = v_milestone_days
      ) THEN
        INSERT INTO public.study_streak_milestone_claims (user_id, streak_start_date, milestone_days, claimed_rdm, claimed_at)
        VALUES (v_user_id, v_streak_start_date, v_milestone_days, v_milestone_rdm, now());

        PERFORM public.add_rdm(v_user_id, v_milestone_rdm);
        v_milestone_credited := true;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'penalties_applied', v_penalties_applied,
    'total_deducted', v_total_deducted,
    'milestone_credited', v_milestone_credited,
    'current_streak', v_streak_val
  );
END;
$$;


ALTER FUNCTION "public"."reconcile_inactive_day_penalties"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_mock_test_attempt"("p_attempt_key" "text", "p_session_kind" "text", "p_catalog_paper_id" "uuid", "p_past_paper_id" "uuid", "p_paper_slug" "text", "p_paper_title" "text", "p_score_percent" smallint, "p_correct_count" integer, "p_total_questions" integer, "p_subject_breakdown" "jsonb", "p_duration_seconds" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF p_attempt_key IS NULL OR length(trim(p_attempt_key)) < 3 OR length(trim(p_attempt_key)) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_attempt_key');
  END IF;

  IF p_session_kind NOT IN ('mock_paper', 'past_paper', 'quick_mock', 'mcq_chapter') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session_kind');
  END IF;

  IF p_total_questions IS NULL OR p_total_questions <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_total');
  END IF;

  INSERT INTO public.mock_test_attempts (
    user_id,
    attempt_key,
    session_kind,
    catalog_paper_id,
    past_paper_id,
    paper_slug,
    paper_title,
    score_percent,
    correct_count,
    total_questions,
    subject_breakdown,
    duration_seconds
  )
  VALUES (
    v_uid,
    trim(p_attempt_key),
    p_session_kind,
    p_catalog_paper_id,
    p_past_paper_id,
    NULLIF(trim(COALESCE(p_paper_slug, '')), ''),
    COALESCE(NULLIF(trim(p_paper_title), ''), 'Mock session'),
    p_score_percent,
    p_correct_count,
    p_total_questions,
    COALESCE(p_subject_breakdown, '[]'::jsonb),
    p_duration_seconds
  )
  ON CONFLICT (user_id, attempt_key) DO UPDATE SET
    session_kind = EXCLUDED.session_kind,
    catalog_paper_id = EXCLUDED.catalog_paper_id,
    past_paper_id = EXCLUDED.past_paper_id,
    paper_slug = EXCLUDED.paper_slug,
    paper_title = EXCLUDED.paper_title,
    score_percent = EXCLUDED.score_percent,
    correct_count = EXCLUDED.correct_count,
    total_questions = EXCLUDED.total_questions,
    subject_breakdown = EXCLUDED.subject_breakdown,
    duration_seconds = EXCLUDED.duration_seconds
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;


ALTER FUNCTION "public"."record_mock_test_attempt"("p_attempt_key" "text", "p_session_kind" "text", "p_catalog_paper_id" "uuid", "p_past_paper_id" "uuid", "p_paper_slug" "text", "p_paper_title" "text", "p_score_percent" smallint, "p_correct_count" integer, "p_total_questions" integer, "p_subject_breakdown" "jsonb", "p_duration_seconds" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_mock_test_attempt"("p_attempt_key" "text", "p_session_kind" "text", "p_catalog_paper_id" "uuid", "p_past_paper_id" "uuid", "p_paper_slug" "text", "p_paper_title" "text", "p_score_percent" smallint, "p_correct_count" integer, "p_total_questions" integer, "p_subject_breakdown" "jsonb", "p_duration_seconds" integer) IS 'Authenticated: upsert one finished mock session (overall + subject_breakdown json array).';



CREATE OR REPLACE FUNCTION "public"."record_play_result"("p_question_id" "uuid", "p_is_correct" boolean, "p_time_taken_ms" integer DEFAULT NULL::integer, "p_category" "text" DEFAULT NULL::"text", "p_pool_key" "text" DEFAULT NULL::"text", "p_selected_answer_index" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cat text;
  v_k int := 32;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_category IS NULL THEN
    SELECT q.category INTO v_cat FROM public.play_questions q WHERE q.id = p_question_id;
  ELSE
    v_cat := p_category;
  END IF;

  INSERT INTO public.play_history (user_id, question_id, is_correct, time_taken_ms, pool_key, selected_answer_index)
  VALUES (v_user_id, p_question_id, p_is_correct, p_time_taken_ms, p_pool_key, p_selected_answer_index);

  IF v_cat = 'mental_math' THEN
    RETURN;
  END IF;

  INSERT INTO public.user_play_stats (user_id, category, current_rating, questions_answered, win_streak)
  VALUES (v_user_id, v_cat, 1000, 0, 0)
  ON CONFLICT (user_id, category) DO UPDATE SET
    questions_answered = user_play_stats.questions_answered + 1,
    win_streak = CASE WHEN p_is_correct THEN user_play_stats.win_streak + 1 ELSE 0 END,
    current_rating = GREATEST(100, LEAST(3000,
      user_play_stats.current_rating + (CASE WHEN p_is_correct THEN v_k ELSE -v_k END)
    )),
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."record_play_result"("p_question_id" "uuid", "p_is_correct" boolean, "p_time_taken_ms" integer, "p_category" "text", "p_pool_key" "text", "p_selected_answer_index" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_play_result"("p_question_id" "uuid", "p_is_correct" boolean, "p_time_taken_ms" integer, "p_category" "text", "p_pool_key" "text", "p_selected_answer_index" integer) IS 'Inserts play_history (optional selected_answer_index, pool_key); upserts user_play_stats except mental_math.';



CREATE OR REPLACE FUNCTION "public"."refund_expired_doubt_bounties"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r record;
  v_refunded integer := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, bounty_rdm FROM public.doubts
    WHERE bounty_rdm > 0 AND is_resolved = false
      AND bounty_escrowed_at IS NOT NULL
      AND bounty_escrowed_at + interval '7 days' < now()
  LOOP
    PERFORM public.add_rdm(r.user_id, r.bounty_rdm);
    UPDATE public.doubts SET bounty_rdm = 0, bounty_escrowed_at = NULL WHERE id = r.id;
    v_refunded := v_refunded + 1;
  END LOOP;
  RETURN v_refunded;
END;
$$;


ALTER FUNCTION "public"."refund_expired_doubt_bounties"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refund_expired_doubt_bounties"() IS 'Refund bounty to asker for unresolved doubts after 7 days; returns count refunded.';



CREATE OR REPLACE FUNCTION "public"."reset_free_trial_daily_streak_day"("p_day" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_state jsonb;
  v_day_key text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_day IS NULL OR p_day < 2 OR p_day > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  SELECT free_trial_daily_streak
  INTO v_state
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  v_state := COALESCE(v_state, '{}'::jsonb);
  v_day_key := p_day::text;

  IF COALESCE(v_state -> v_day_key ->> 'claimed_at', '') <> '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'day_already_claimed');
  END IF;

  v_state := v_state - v_day_key;

  UPDATE public.profiles
  SET free_trial_daily_streak = v_state
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'trial_day', p_day);
END;
$$;


ALTER FUNCTION "public"."reset_free_trial_daily_streak_day"("p_day" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_subscription_plan_key"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN lower(coalesce(p.plan_tier, 'free')) = 'free_trial' THEN 'free_trial'
    WHEN lower(coalesce(p.plan_tier, 'free')) IN ('starter', 'scholar') THEN 'starter'
    WHEN lower(coalesce(p.plan_tier, 'free')) IN ('pro', 'champion', 'pro_plus') THEN 'pro'
    WHEN lower(coalesce(p.plan_tier, 'free')) = 'free'
      AND coalesce(p.free_trial_activated, false) THEN 'free_trial'
    ELSE 'free'
  END
  FROM public.profiles p
  WHERE p.id = p_user_id;
$$;


ALTER FUNCTION "public"."resolve_subscription_plan_key"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolve_subscription_plan_key"("p_user_id" "uuid") IS 'Maps profiles.plan_tier (+ free_trial_activated) to subscription config prefix: free_trial | free | starter | pro.';



CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_doubt_duplicates"("p_title" "text") RETURNS TABLE("id" "uuid", "title" "text", "similarity_score" real)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.title, similarity(d.title, trim(coalesce(p_title, ''))) AS similarity_score
  FROM public.doubts d
  WHERE trim(coalesce(p_title, '')) <> ''
    AND similarity(d.title, trim(p_title)) > 0.3
  ORDER BY similarity(d.title, trim(p_title)) DESC
  LIMIT 5;
END;
$$;


ALTER FUNCTION "public"."search_doubt_duplicates"("p_title" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_doubt_duplicates"("p_title" "text") IS 'Returns doubts with title similar to p_title; use similarity_score >= 0.9 for "match".';



CREATE OR REPLACE FUNCTION "public"."set_classroom_assignment_responses_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_classroom_assignment_responses_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_gyan_bot_config_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_gyan_bot_config_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_lessons_raw_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_lessons_raw_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_rdm_config_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_rdm_config_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_teacher_profile_details_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_teacher_profile_details_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_can_read_post_via_teacher_nudge"("p_post_id" "uuid", "p_classroom_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts m
    WHERE m.type = 'motivation'
      AND m.classroom_id = p_classroom_id
      AND COALESCE(m.content_json->>'relatedPostId', '') = p_post_id::text
      AND COALESCE(jsonb_typeof(m.content_json->'targetStudentIds'), '') = 'array'
      AND COALESCE(jsonb_array_length(m.content_json->'targetStudentIds'), 0) > 0
      AND (m.content_json->'targetStudentIds') ? ((select auth.uid())::text)
  );
$$;


ALTER FUNCTION "public"."student_can_read_post_via_teacher_nudge"("p_post_id" "uuid", "p_classroom_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."student_can_read_post_via_teacher_nudge"("p_post_id" "uuid", "p_classroom_id" "uuid") IS 'True when the current user was nudged (motivation post) about p_post_id; used by posts SELECT RLS without recursion.';



CREATE OR REPLACE FUNCTION "public"."student_has_active_grant_for_assignment"("p_post_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_motivation_rdm_grants g
    WHERE g.student_id = (select auth.uid())
      AND g.assignment_post_id = p_post_id
      AND g.status IN ('pending', 'paid')
  );
$$;


ALTER FUNCTION "public"."student_has_active_grant_for_assignment"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.submit_daily_gauntlet(p_gauntlet_date, p_results, 'funbrain'::text);
$$;


ALTER FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb") IS 'Records gauntlet attempt; p_results is array of { question_id, is_correct, time_taken_ms }.';



CREATE OR REPLACE FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb", "p_domain" "text" DEFAULT 'funbrain'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  r jsonb;
  v_total_ms int := 0;
  v_correct int := 0;
  v_question_id uuid;
  v_ok boolean;
  v_time_ms int;
  v_pool text;
  v_sel int;
  v_n int;
  v_prev_streak int;
  v_last_pair_day date;
  v_new_streak int;
  v_domains int;
  v_rdm_academic int;
  v_rdm_funbrain int;
  v_rdm_streak_7 int;
  v_rdm_streak_30 int;
  v_min_q int;
  v_plan text;
  v_plan_limit int;
  v_global_min int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  v_pool := CASE WHEN p_domain = 'academic' THEN 'academic_gauntlet' ELSE 'funbrain_gauntlet' END;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'play_dailydose_academic_rdm'), 15)
  INTO v_rdm_academic;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'play_dailydose_funbrain_rdm'), 10)
  INTO v_rdm_funbrain;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'play_dual_streak_7_rdm'), 50)
  INTO v_rdm_streak_7;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'play_dual_streak_30_rdm'), 200)
  INTO v_rdm_streak_30;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'play_dailydose_min_questions_for_rdm'), 10)
  INTO v_global_min;

  SELECT public.resolve_subscription_plan_key(v_user_id) INTO v_plan;

  SELECT COALESCE(
    (SELECT value FROM public.rdm_config WHERE key = v_plan || '_daily_dose_questions_per_day'),
    5
  )
  INTO v_plan_limit;

  IF v_plan_limit < 0 THEN
    v_min_q := LEAST(50, GREATEST(1, v_global_min));
  ELSE
    v_min_q := LEAST(50, GREATEST(1, v_plan_limit));
  END IF;

  v_rdm_academic := GREATEST(1, v_rdm_academic);
  v_rdm_funbrain := GREATEST(1, v_rdm_funbrain);
  v_rdm_streak_7 := GREATEST(1, v_rdm_streak_7);
  v_rdm_streak_30 := GREATEST(1, v_rdm_streak_30);

  v_n := COALESCE(jsonb_array_length(p_results), 0);

  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_question_id := (r->>'question_id')::uuid;
    v_ok := (r->>'is_correct')::boolean;
    v_time_ms := (r->>'time_taken_ms')::int;
    v_total_ms := v_total_ms + COALESCE(v_time_ms, 0);
    IF v_ok THEN v_correct := v_correct + 1; END IF;

    IF (r ? 'selected_answer_index') AND jsonb_typeof(r->'selected_answer_index') = 'number' THEN
      v_sel := (r->>'selected_answer_index')::int;
    ELSE
      v_sel := NULL;
    END IF;

    PERFORM public.record_play_result(v_question_id, v_ok, v_time_ms, NULL, v_pool, v_sel);
  END LOOP;

  INSERT INTO public.daily_gauntlet_attempts (user_id, gauntlet_date, domain, total_time_ms, correct_count)
  VALUES (v_user_id, p_gauntlet_date, p_domain, v_total_ms, v_correct)
  ON CONFLICT (user_id, gauntlet_date, domain) DO UPDATE SET
    total_time_ms = EXCLUDED.total_time_ms,
    correct_count = EXCLUDED.correct_count,
    completed_at = now();

  IF v_n >= v_min_q THEN
    IF p_domain = 'academic' THEN
      PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_ACADEMIC', v_rdm_academic);
    ELSE
      PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_FUNBRAIN', v_rdm_funbrain);
    END IF;
  END IF;

  SELECT COUNT(DISTINCT g.domain)::int
  INTO v_domains
  FROM public.daily_gauntlet_attempts g
  WHERE g.user_id = v_user_id
    AND g.gauntlet_date = p_gauntlet_date;

  IF v_domains = 2 THEN
    SELECT p.daily_dose_streak, p.last_daily_dose_streak_date
    INTO v_prev_streak, v_last_pair_day
    FROM public.profiles p
    WHERE p.id = v_user_id
    FOR UPDATE;

    IF FOUND AND v_last_pair_day IS DISTINCT FROM p_gauntlet_date THEN
      IF v_last_pair_day IS NULL THEN
        v_new_streak := 1;
      ELSIF p_gauntlet_date = v_last_pair_day + 1 THEN
        v_new_streak := COALESCE(v_prev_streak, 0) + 1;
      ELSE
        v_new_streak := 1;
      END IF;

      UPDATE public.profiles p
      SET
        daily_dose_streak = v_new_streak,
        last_daily_dose_streak_date = p_gauntlet_date,
        updated_at = now()
      WHERE p.id = v_user_id;

      IF v_new_streak > 0 AND v_new_streak % 30 = 0 THEN
        PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_STREAK_30', v_rdm_streak_30);
      ELSIF v_new_streak > 0 AND v_new_streak % 7 = 0 THEN
        PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_STREAK_7', v_rdm_streak_7);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'correct_count', v_correct, 'total_time_ms', v_total_ms);
END;
$$;


ALTER FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb", "p_domain" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb", "p_domain" "text") IS 'Records DailyDose attempt; RDM min-question gate uses {plan}_daily_dose_questions_per_day from rdm_config (admin subscriptions). Unlimited plans fall back to play_dailydose_min_questions_for_rdm.';



CREATE OR REPLACE FUNCTION "public"."sync_free_trial_daily_streak_task"("p_day" integer, "p_task_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_site_claimed timestamptz;
  v_state jsonb;
  v_day_key text;
  v_now timestamptz := now();
  v_expected_day integer;
  v_day jsonb;
  v_task_ids text[];
  v_tasks jsonb;
  v_already boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_day IS NULL OR p_day < 2 OR p_day > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  IF p_task_id IS NULL OR NOT (p_task_id = ANY (public._free_trial_daily_task_ids())) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_task_id');
  END IF;

  SELECT onboarding_reward_claimed_at, free_trial_daily_streak
  INTO v_site_claimed, v_state
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  IF v_site_claimed IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'site_tour_not_claimed');
  END IF;

  v_state := COALESCE(v_state, '{}'::jsonb);
  v_day_key := p_day::text;
  v_day := COALESCE(v_state -> v_day_key, '{}'::jsonb);

  IF COALESCE(v_day ->> 'claimed_at', '') <> '' THEN
    v_task_ids := public._free_trial_streak_day_task_ids(v_state, v_day_key);
    RETURN jsonb_build_object(
      'ok', true,
      'noop', true,
      'already_claimed', true,
      'task_ids', to_jsonb(v_task_ids),
      'trial_day', p_day
    );
  END IF;

  v_expected_day := public._free_trial_streak_active_day(v_state);
  IF v_expected_day IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'all_days_complete');
  END IF;

  IF p_day <> v_expected_day THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'wrong_day',
      'expected_day', v_expected_day
    );
  END IF;

  v_task_ids := public._free_trial_streak_day_task_ids(v_state, v_day_key);
  v_already := p_task_id = ANY (v_task_ids);

  IF NOT v_already THEN
    v_task_ids := array_append(v_task_ids, p_task_id);
  END IF;

  v_tasks := COALESCE(v_day -> 'tasks', '{}'::jsonb);
  IF COALESCE(v_tasks -> p_task_id ->> 'completed_at', '') = '' THEN
    v_tasks := jsonb_set(
      v_tasks,
      ARRAY[p_task_id],
      jsonb_build_object('completed_at', v_now),
      true
    );
  END IF;

  v_day := jsonb_build_object(
    'task_ids', to_jsonb(v_task_ids),
    'tasks', v_tasks
  );

  IF COALESCE((v_state -> v_day_key) ->> 'claimed_at', '') = '' THEN
    v_state := jsonb_set(v_state, ARRAY[v_day_key], v_day, true);
  END IF;

  UPDATE public.profiles
  SET free_trial_daily_streak = v_state
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'noop', v_already,
    'task_ids', to_jsonb(v_task_ids),
    'trial_day', p_day
  );
END;
$$;


ALTER FUNCTION "public"."sync_free_trial_daily_streak_task"("p_day" integer, "p_task_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_free_trial_daily_streak_task"("p_day" integer, "p_task_id" "text") IS 'Record one Day-2+ daily checklist task (t1–t6) on profiles.free_trial_daily_streak for the active streak day.';



CREATE OR REPLACE FUNCTION "public"."teacher_owns_motivation_post"("p_motivation_post_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = p_motivation_post_id
      AND p.teacher_id = (select auth.uid())
  );
$$;


ALTER FUNCTION "public"."teacher_owns_motivation_post"("p_motivation_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_lessons_raw_post_boost"("p_post_id" "uuid") RETURNS TABLE("boosted" boolean, "boost_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.lessons_raw_post_boosts b
    WHERE b.post_id = p_post_id
      AND b.user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.lessons_raw_post_boosts
    WHERE post_id = p_post_id
      AND user_id = v_user_id;

    UPDATE public.lessons_raw_posts lr
    SET boost_count = GREATEST(0, lr.boost_count - 1)
    WHERE lr.id = p_post_id;

    RETURN QUERY
    SELECT false, p.boost_count
    FROM public.lessons_raw_posts p
    WHERE p.id = p_post_id;
  ELSE
    INSERT INTO public.lessons_raw_post_boosts (post_id, user_id)
    VALUES (p_post_id, v_user_id)
    ON CONFLICT (post_id, user_id) DO NOTHING;

    UPDATE public.lessons_raw_posts lr
    SET boost_count = lr.boost_count + 1
    WHERE lr.id = p_post_id;

    RETURN QUERY
    SELECT true, p.boost_count
    FROM public.lessons_raw_posts p
    WHERE p.id = p_post_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_lessons_raw_post_boost"("p_post_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."toggle_lessons_raw_post_boost"("p_post_id" "uuid") IS 'Atomic toggle for boost/unboost + count sync';



CREATE OR REPLACE FUNCTION "public"."touch_refer_challenge_claims_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_refer_challenge_claims_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_member_of_classroom"("cid" "uuid", "uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_members m
    WHERE m.classroom_id = cid AND m.user_id = uid
  );
$$;


ALTER FUNCTION "public"."user_is_member_of_classroom"("cid" "uuid", "uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vote_lessons_raw_post"("p_post_id" "uuid", "p_click" smallint) RETURNS TABLE("score" integer, "up_count" integer, "down_count" integer, "my_vote" smallint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_old smallint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_click IS DISTINCT FROM 1 AND p_click IS DISTINCT FROM -1 THEN
    RAISE EXCEPTION 'Invalid vote';
  END IF;

  SELECT v.vote INTO v_old
  FROM public.lessons_raw_post_votes v
  WHERE v.post_id = p_post_id AND v.user_id = v_user;

  IF v_old IS NULL THEN
    INSERT INTO public.lessons_raw_post_votes (post_id, user_id, vote)
    VALUES (p_post_id, v_user, p_click);
    IF p_click = 1 THEN
      UPDATE public.lessons_raw_posts SET upvote_count = upvote_count + 1 WHERE id = p_post_id;
    ELSE
      UPDATE public.lessons_raw_posts SET downvote_count = downvote_count + 1 WHERE id = p_post_id;
    END IF;
  ELSIF v_old = p_click THEN
    DELETE FROM public.lessons_raw_post_votes WHERE post_id = p_post_id AND user_id = v_user;
    IF p_click = 1 THEN
      UPDATE public.lessons_raw_posts SET upvote_count = GREATEST(0, upvote_count - 1) WHERE id = p_post_id;
    ELSE
      UPDATE public.lessons_raw_posts SET downvote_count = GREATEST(0, downvote_count - 1) WHERE id = p_post_id;
    END IF;
  ELSE
    UPDATE public.lessons_raw_post_votes SET vote = p_click WHERE post_id = p_post_id AND user_id = v_user;
    IF p_click = 1 THEN
      UPDATE public.lessons_raw_posts
      SET upvote_count = upvote_count + 1, downvote_count = GREATEST(0, downvote_count - 1)
      WHERE id = p_post_id;
    ELSE
      UPDATE public.lessons_raw_posts
      SET downvote_count = downvote_count + 1, upvote_count = GREATEST(0, upvote_count - 1)
      WHERE id = p_post_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p.upvote_count - p.downvote_count,
    p.upvote_count,
    p.downvote_count,
    COALESCE((SELECT vv.vote FROM public.lessons_raw_post_votes vv WHERE vv.post_id = p_post_id AND vv.user_id = v_user), 0::smallint)::smallint
  FROM public.lessons_raw_posts p
  WHERE p.id = p_post_id;
END;
$$;


ALTER FUNCTION "public"."vote_lessons_raw_post"("p_post_id" "uuid", "p_click" smallint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."vote_lessons_raw_post"("p_post_id" "uuid", "p_click" smallint) IS 'Toggle or flip vote; returns score and counts';



CREATE OR REPLACE FUNCTION "public"."vote_on_doubt"("p_target_type" "text", "p_target_id" "uuid", "p_vote_type" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prev_vote integer;
  v_answer_user_id uuid;
  v_owner_id uuid;
  v_prev_count_up integer;
  v_prev_count_down integer;
  v_voter_award jsonb;
  v_upvote_rdm integer;
  v_new_user_vote integer := 0;
BEGIN
  IF v_user_id IS NULL OR p_vote_type NOT IN (1, -1) OR p_target_type NOT IN ('doubt', 'answer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_upvote_rdm'), 2)
  INTO v_upvote_rdm;
  v_upvote_rdm := GREATEST(1, v_upvote_rdm);

  IF p_target_type = 'doubt' THEN
    SELECT user_id INTO v_owner_id FROM public.doubts WHERE id = p_target_id;
    IF v_owner_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Doubt not found');
    END IF;
    SELECT COALESCE(vote_type, 0) INTO v_prev_vote FROM public.doubt_votes
      WHERE user_id = v_user_id AND target_type = 'doubt' AND target_id = p_target_id;
    v_prev_vote := COALESCE(v_prev_vote, 0);
    SELECT upvotes, downvotes INTO v_prev_count_up, v_prev_count_down FROM public.doubts WHERE id = p_target_id;

    DELETE FROM public.doubt_votes WHERE user_id = v_user_id AND target_type = 'doubt' AND target_id = p_target_id;

    IF v_prev_vote = p_vote_type THEN
      IF v_prev_vote = 1 THEN
        PERFORM public.add_rdm(v_owner_id, -1);
        v_prev_count_up := v_prev_count_up - 1;
      ELSIF v_prev_vote = -1 THEN
        v_prev_count_down := v_prev_count_down - 1;
      END IF;
      v_new_user_vote := 0;
    ELSE
      INSERT INTO public.doubt_votes (user_id, target_type, target_id, vote_type)
      VALUES (v_user_id, 'doubt', p_target_id, p_vote_type);

      IF v_prev_vote = 1 THEN
        PERFORM public.add_rdm(v_owner_id, -1);
        v_prev_count_up := v_prev_count_up - 1;
      ELSIF v_prev_vote = -1 THEN
        v_prev_count_down := v_prev_count_down - 1;
      END IF;
      IF p_vote_type = 1 THEN
        v_prev_count_up := v_prev_count_up + 1;
        PERFORM public.add_rdm(v_owner_id, 1);
        IF v_prev_vote IS DISTINCT FROM 1 THEN
          v_voter_award := public.award_daily_rdm(v_user_id, 'UPVOTE', v_upvote_rdm);
        END IF;
      ELSE
        v_prev_count_down := v_prev_count_down + 1;
      END IF;
      v_new_user_vote := p_vote_type;
    END IF;

    UPDATE public.doubts SET upvotes = v_prev_count_up, downvotes = v_prev_count_down WHERE id = p_target_id;

    RETURN jsonb_build_object(
      'ok', true,
      'upvotes', v_prev_count_up,
      'downvotes', v_prev_count_down,
      'user_vote', v_new_user_vote,
      'voter_daily_rdm', COALESCE(v_voter_award, jsonb_build_object('awarded', false))
    );
  END IF;

  SELECT da.user_id INTO v_answer_user_id FROM public.doubt_answers da WHERE da.id = p_target_id;
  IF v_answer_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Answer not found');
  END IF;

  SELECT COALESCE(vote_type, 0) INTO v_prev_vote FROM public.doubt_votes
    WHERE user_id = v_user_id AND target_type = 'answer' AND target_id = p_target_id;
  v_prev_vote := COALESCE(v_prev_vote, 0);
  SELECT upvotes, downvotes INTO v_prev_count_up, v_prev_count_down FROM public.doubt_answers WHERE id = p_target_id;

  DELETE FROM public.doubt_votes WHERE user_id = v_user_id AND target_type = 'answer' AND target_id = p_target_id;

  IF v_prev_vote = p_vote_type THEN
    IF v_prev_vote = 1 THEN
      PERFORM public.add_rdm(v_answer_user_id, -2);
      v_prev_count_up := v_prev_count_up - 1;
    ELSIF v_prev_vote = -1 THEN
      PERFORM public.add_rdm(v_answer_user_id, 1);
      v_prev_count_down := v_prev_count_down - 1;
    END IF;
    v_new_user_vote := 0;
  ELSE
    INSERT INTO public.doubt_votes (user_id, target_type, target_id, vote_type)
    VALUES (v_user_id, 'answer', p_target_id, p_vote_type);

    IF v_prev_vote = 1 THEN
      PERFORM public.add_rdm(v_answer_user_id, -2);
      v_prev_count_up := v_prev_count_up - 1;
    ELSIF v_prev_vote = -1 THEN
      PERFORM public.add_rdm(v_answer_user_id, 1);
      v_prev_count_down := v_prev_count_down - 1;
    END IF;
    IF p_vote_type = 1 THEN
      v_prev_count_up := v_prev_count_up + 1;
      PERFORM public.add_rdm(v_answer_user_id, 2);
      IF v_prev_vote IS DISTINCT FROM 1 THEN
        v_voter_award := public.award_daily_rdm(v_user_id, 'UPVOTE', v_upvote_rdm);
      END IF;
    ELSE
      v_prev_count_down := v_prev_count_down + 1;
      PERFORM public.add_rdm(v_answer_user_id, -1);
    END IF;
    v_new_user_vote := p_vote_type;
  END IF;

  UPDATE public.doubt_answers SET upvotes = v_prev_count_up, downvotes = v_prev_count_down WHERE id = p_target_id;

  RETURN jsonb_build_object(
    'ok', true,
    'upvotes', v_prev_count_up,
    'downvotes', v_prev_count_down,
    'user_vote', v_new_user_vote,
    'voter_daily_rdm', COALESCE(v_voter_award, jsonb_build_object('awarded', false))
  );
END;
$$;


ALTER FUNCTION "public"."vote_on_doubt"("p_target_type" "text", "p_target_id" "uuid", "p_vote_type" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."vote_on_doubt"("p_target_type" "text", "p_target_id" "uuid", "p_vote_type" integer) IS 'Vote or toggle off (same type again removes vote). Returns user_vote (0 = none).';



CREATE OR REPLACE FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."allow_only_operation"("expected_operation" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION "storage"."allow_only_operation"("expected_operation" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text", "sort_order" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."protect_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."protect_delete"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accepted_answer_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "answer_id" "uuid" NOT NULL,
    "rdm_paid" integer NOT NULL,
    "paid_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."accepted_answer_payouts" OWNER TO "postgres";


COMMENT ON TABLE "public"."accepted_answer_payouts" IS 'Log of RDM paid on accept for farming cap and leaderboard.';



CREATE TABLE IF NOT EXISTS "public"."admin_analytics_cache" (
    "key" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "refreshed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_analytics_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid",
    "action" "text" NOT NULL,
    "reason" "text",
    "payload" "jsonb"
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_user_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "reason" "text",
    "old_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "new_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_user_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_token_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "model_id" "text" DEFAULT ''::"text" NOT NULL,
    "backend" "text" DEFAULT ''::"text" NOT NULL,
    "prompt_tokens" integer DEFAULT 0 NOT NULL,
    "candidates_tokens" integer DEFAULT 0 NOT NULL,
    "total_tokens" integer DEFAULT 0 NOT NULL,
    "cost_usd" numeric(12,8) DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."ai_token_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_token_logs" IS 'Per-request AI usage telemetry: model, tokens, backend, cost, and metadata.';



CREATE TABLE IF NOT EXISTS "public"."approved_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "waitlist_submission_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "approved_by" "uuid",
    "approved_via" "text",
    CONSTRAINT "approved_emails_approved_via_check" CHECK ((("approved_via" IS NULL) OR ("approved_via" = ANY (ARRAY['waitlist_approve'::"text", 'manual'::"text"])))),
    CONSTRAINT "approved_emails_email_check" CHECK (("email" = "lower"("email"))),
    CONSTRAINT "approved_emails_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'teacher'::"text"])))
);


ALTER TABLE "public"."approved_emails" OWNER TO "postgres";


COMMENT ON COLUMN "public"."approved_emails"."approved_by" IS 'Admin user who granted whitelist access';



COMMENT ON COLUMN "public"."approved_emails"."approved_via" IS 'How access was granted: waitlist_approve or manual';



CREATE TABLE IF NOT EXISTS "public"."buddy_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "inviter_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "accepted_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    CONSTRAINT "buddy_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'revoked'::"text"]))),
    CONSTRAINT "buddy_invites_token_min" CHECK (("char_length"("token") >= 8))
);


ALTER TABLE "public"."buddy_invites" OWNER TO "postgres";


COMMENT ON TABLE "public"."buddy_invites" IS 'Learning Buddy invite tokens shared via WhatsApp. Accepted via accept_buddy_invite RPC.';



CREATE TABLE IF NOT EXISTS "public"."cbse_mcq_chapters" (
    "chapter_id" "text" NOT NULL,
    "board" "text" DEFAULT 'CBSE'::"text" NOT NULL,
    "class_level" smallint DEFAULT 12 NOT NULL,
    "subject" "text" NOT NULL,
    "chapter_name" "text" NOT NULL,
    "sort_order" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cbse_mcq_chapters_board_check" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "cbse_mcq_chapters_class_level_check" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "cbse_mcq_chapters_sort_order_check" CHECK (("sort_order" > 0)),
    CONSTRAINT "cbse_mcq_chapters_subject_check" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."cbse_mcq_chapters" OWNER TO "postgres";


COMMENT ON TABLE "public"."cbse_mcq_chapters" IS 'CBSE NCERT chapter index for Mock Test → MCQ browser. chapter_id matches UI slug (p12-1, c12-1, m12-1).';



CREATE TABLE IF NOT EXISTS "public"."cbse_mcq_community_share_rdm_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "attempt_key" "text" NOT NULL,
    "rdm_amount" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cbse_mcq_community_share_rdm_claims_rdm_amount_check" CHECK (("rdm_amount" > 0))
);


ALTER TABLE "public"."cbse_mcq_community_share_rdm_claims" OWNER TO "postgres";


COMMENT ON TABLE "public"."cbse_mcq_community_share_rdm_claims" IS 'One CBSE chapter MCQ community-share RDM grant per user per attempt_key.';



CREATE TABLE IF NOT EXISTS "public"."cbse_mcq_score_bonus_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "paper_id" "uuid" NOT NULL,
    "attempt_key" "text" NOT NULL,
    "correct_count" integer NOT NULL,
    "total_questions" integer NOT NULL,
    "accuracy_pct" integer NOT NULL,
    "rdm_amount" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eligible" boolean DEFAULT false NOT NULL,
    CONSTRAINT "cbse_mcq_score_bonus_claims_accuracy_pct_check" CHECK ((("accuracy_pct" >= 0) AND ("accuracy_pct" <= 100))),
    CONSTRAINT "cbse_mcq_score_bonus_claims_correct_count_check" CHECK (("correct_count" >= 0)),
    CONSTRAINT "cbse_mcq_score_bonus_claims_rdm_amount_check" CHECK (("rdm_amount" >= 0)),
    CONSTRAINT "cbse_mcq_score_bonus_claims_total_questions_check" CHECK (("total_questions" > 0))
);


ALTER TABLE "public"."cbse_mcq_score_bonus_claims" OWNER TO "postgres";


COMMENT ON TABLE "public"."cbse_mcq_score_bonus_claims" IS 'CBSE chapter MCQ completion RDM by accuracy tier (once per attempt_key).';



CREATE TABLE IF NOT EXISTS "public"."class_exploration_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."class_exploration_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."class_exploration_sessions" IS 'Tracks when a non-member started exploring a class; 10-minute window is enforced server-side.';



CREATE TABLE IF NOT EXISTS "public"."classroom_assignment_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "task_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "response_text" "text",
    "links" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."classroom_assignment_responses" OWNER TO "postgres";


COMMENT ON TABLE "public"."classroom_assignment_responses" IS 'Optional student submissions (text + links) for assignment tasks stored on posts.content_json.tasks';



CREATE TABLE IF NOT EXISTS "public"."classroom_assignment_task_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "task_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."classroom_assignment_task_progress" OWNER TO "postgres";


COMMENT ON TABLE "public"."classroom_assignment_task_progress" IS 'Student checklist completion for assignment tasks stored on posts.content_json.tasks';



CREATE TABLE IF NOT EXISTS "public"."classroom_generated_test_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "answers_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "total" integer DEFAULT 0 NOT NULL,
    "submitted_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."classroom_generated_test_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."classroom_generated_test_attempts" IS 'Student attempts for teacher-generated MCQ assignment tests.';



CREATE TABLE IF NOT EXISTS "public"."classroom_join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    "responded_by" "uuid",
    CONSTRAINT "classroom_join_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."classroom_join_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."classroom_join_requests" IS 'Student requests to join a classroom; teacher approves or rejects.';



CREATE TABLE IF NOT EXISTS "public"."classroom_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "google_synced" boolean DEFAULT false NOT NULL,
    "section_id" "uuid"
);


ALTER TABLE "public"."classroom_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classroom_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text",
    "video_rating" smallint,
    "voice_rating" smallint,
    "is_explorer" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "classroom_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "classroom_reviews_video_rating_check" CHECK ((("video_rating" >= 1) AND ("video_rating" <= 5))),
    CONSTRAINT "classroom_reviews_voice_rating_check" CHECK ((("voice_rating" >= 1) AND ("voice_rating" <= 5)))
);


ALTER TABLE "public"."classroom_reviews" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."classroom_rating_summary" WITH ("security_invoker"='true') AS
 SELECT "classroom_id",
    ("count"(*))::integer AS "review_count",
    "round"("avg"("rating"), 1) AS "avg_rating",
    "round"("avg"("video_rating"), 1) AS "avg_video_rating",
    "round"("avg"("voice_rating"), 1) AS "avg_voice_rating"
   FROM "public"."classroom_reviews"
  GROUP BY "classroom_id";


ALTER VIEW "public"."classroom_rating_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classroom_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "google_calendar_list_id" "text" DEFAULT 'primary'::"text" NOT NULL,
    "google_recurring_event_id" "text",
    "google_meet_link" "text",
    "google_rrule" "text",
    "google_time_zone" "text",
    "google_recurrence_end_date" "text",
    "schedule_date" "text",
    "schedule_time" "text",
    "duration_minutes" integer,
    "repeat_days" "text"[] DEFAULT '{}'::"text"[],
    "schedule_end_date" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."classroom_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classrooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "join_code" "text" DEFAULT ''::"text" NOT NULL,
    "type" "text" DEFAULT 'standard'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "section" "text",
    "subject" "text",
    "google_classroom_id" "text",
    "invite_link" "text",
    "intro_video_url" "text",
    "google_calendar_list_id" "text" DEFAULT 'primary'::"text",
    "google_recurring_event_id" "text",
    "google_meet_link" "text",
    "google_rrule" "text",
    "google_time_zone" "text",
    "google_recurrence_end_date" "date",
    "allow_adhoc_trial" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."classrooms" OWNER TO "postgres";


COMMENT ON COLUMN "public"."classrooms"."intro_video_url" IS 'Optional YouTube/Vimeo URL for class intro/demo video.';



COMMENT ON COLUMN "public"."classrooms"."google_calendar_list_id" IS 'Calendar id (usually primary) where the series lives.';



COMMENT ON COLUMN "public"."classrooms"."google_recurring_event_id" IS 'Google Calendar event id for the recurring master.';



COMMENT ON COLUMN "public"."classrooms"."google_meet_link" IS 'Hangouts Meet join URL from conferenceData.';



COMMENT ON COLUMN "public"."classrooms"."google_rrule" IS 'RFC5545 RRULE sent to Google (debug/display).';



COMMENT ON COLUMN "public"."classrooms"."google_time_zone" IS 'IANA timezone used for the series.';



COMMENT ON COLUMN "public"."classrooms"."google_recurrence_end_date" IS 'Optional last calendar day of recurrence (matches teacher end-date UI).';



CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "rdm_amount" integer NOT NULL,
    "restricted_to_teacher_ids" "uuid"[],
    "is_purchased" boolean DEFAULT false NOT NULL,
    "bought_by_teacher_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "redeemed_at" timestamp with time zone,
    "redeemed_by_teacher_id" "uuid",
    "order_id" "text",
    "payment_method" "text",
    CONSTRAINT "coupons_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'redeemed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curriculum_chapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."curriculum_chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curriculum_subtopics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."curriculum_subtopics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curriculum_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chapter_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."curriculum_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."curriculum_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "unit_label" "text" NOT NULL,
    "unit_title" "text" NOT NULL,
    "exam_relevance" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."curriculum_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_gauntlet_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "gauntlet_date" "date" NOT NULL,
    "total_time_ms" integer NOT NULL,
    "correct_count" integer NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "domain" "text" DEFAULT 'funbrain'::"text" NOT NULL
);


ALTER TABLE "public"."daily_gauntlet_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_gauntlet_attempts" IS 'One attempt per user per day for Daily Gauntlet leaderboard.';



CREATE TABLE IF NOT EXISTS "public"."daily_reward_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "claim_date_ist" "date" NOT NULL,
    "points_awarded" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_reward_claims_action_type_check" CHECK (("action_type" = ANY (ARRAY['ASK'::"text", 'COMMENT'::"text", 'UPVOTE'::"text", 'SAVE'::"text", 'INSTACUE_CREATE'::"text", 'TOPIC_QUIZ_ADVANCED_60'::"text", 'NUMERALS_PACK_COMPLETE'::"text", 'DAILY_DOSE_ACADEMIC'::"text", 'DAILY_DOSE_FUNBRAIN'::"text", 'DAILY_DOSE_STREAK_7'::"text", 'DAILY_DOSE_STREAK_30'::"text"])))
);


ALTER TABLE "public"."daily_reward_claims" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_reward_claims" IS 'IST-day-first reward claims; unique constraint prevents race duplicates.';



CREATE TABLE IF NOT EXISTS "public"."doubt_answer_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "answer_id" "uuid" NOT NULL,
    "reporter_user_id" "uuid" NOT NULL,
    "reason" "text" DEFAULT 'ai_spam'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."doubt_answer_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."doubt_answer_reports" IS 'One report per user per answer; 3 reports trigger penalty.';



CREATE TABLE IF NOT EXISTS "public"."doubt_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doubt_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "upvotes" integer DEFAULT 0 NOT NULL,
    "downvotes" integer DEFAULT 0 NOT NULL,
    "is_accepted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hidden" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."doubt_answers" OWNER TO "postgres";


COMMENT ON TABLE "public"."doubt_answers" IS 'Answers to doubts; is_accepted set by question author.';



COMMENT ON COLUMN "public"."doubt_answers"."hidden" IS 'Set true when 3+ reports; answer hidden and author penalized.';



CREATE TABLE IF NOT EXISTS "public"."doubt_saves" (
    "user_id" "uuid" NOT NULL,
    "doubt_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."doubt_saves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doubt_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "vote_type" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "doubt_votes_target_type_check" CHECK (("target_type" = ANY (ARRAY['doubt'::"text", 'answer'::"text"]))),
    CONSTRAINT "doubt_votes_vote_type_check" CHECK (("vote_type" = ANY (ARRAY[1, '-1'::integer])))
);


ALTER TABLE "public"."doubt_votes" OWNER TO "postgres";


COMMENT ON TABLE "public"."doubt_votes" IS 'One vote per user per doubt or answer; vote_type 1=up, -1=down.';



CREATE TABLE IF NOT EXISTS "public"."doubts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "subject" "text",
    "upvotes" integer DEFAULT 0 NOT NULL,
    "downvotes" integer DEFAULT 0 NOT NULL,
    "is_resolved" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bounty_rdm" integer DEFAULT 0 NOT NULL,
    "cost_rdm" integer DEFAULT 0 NOT NULL,
    "bounty_escrowed_at" timestamp with time zone,
    "views" integer DEFAULT 0 NOT NULL,
    "gyan_curriculum_node_id" "uuid"
);


ALTER TABLE "public"."doubts" OWNER TO "postgres";


COMMENT ON TABLE "public"."doubts" IS 'Student Q&A questions; upvotes/downvotes and RDM rewards via RPC.';



COMMENT ON COLUMN "public"."doubts"."bounty_rdm" IS 'User-funded bounty in escrow; paid to answerer on accept.';



COMMENT ON COLUMN "public"."doubts"."cost_rdm" IS 'Cost to post (e.g. 5 RDM; 0 during beta).';



COMMENT ON COLUMN "public"."doubts"."bounty_escrowed_at" IS 'When bounty was deducted for 7-day refund rule.';



COMMENT ON COLUMN "public"."doubts"."gyan_curriculum_node_id" IS 'When set by Gyan++ bot, links doubt to curriculum cell for coverage / dedupe.';



CREATE TABLE IF NOT EXISTS "public"."episodic_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "chunk_text" "text" NOT NULL,
    "embedding" "public"."vector"(1024) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "context_key" "text" DEFAULT 'global'::"text" NOT NULL
);


ALTER TABLE "public"."episodic_memory" OWNER TO "postgres";


COMMENT ON TABLE "public"."episodic_memory" IS 'Episodic memory chunks with BGE-M3-sized embeddings for RAG-style recall.';



CREATE TABLE IF NOT EXISTS "public"."explorer_live_joins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."explorer_live_joins" OWNER TO "postgres";


COMMENT ON TABLE "public"."explorer_live_joins" IS 'Non-members joining live during class exploration; 8-minute cap enforced server-side.';



CREATE TABLE IF NOT EXISTS "public"."gyan_bot_config" (
    "id" smallint DEFAULT 1 NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "interval_minutes" integer DEFAULT 10 NOT NULL,
    "current_student_index" integer DEFAULT 0 NOT NULL,
    "last_post_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "curriculum_sequence_index" integer DEFAULT 0 NOT NULL,
    "curriculum_batch_slot" smallint DEFAULT 1 NOT NULL,
    CONSTRAINT "gyan_bot_config_current_student_index_check" CHECK ((("current_student_index" >= 0) AND ("current_student_index" < 12))),
    CONSTRAINT "gyan_bot_config_curriculum_batch_slot_check" CHECK ((("curriculum_batch_slot" >= 1) AND ("curriculum_batch_slot" <= 5))),
    CONSTRAINT "gyan_bot_config_id_check" CHECK (("id" = 1)),
    CONSTRAINT "gyan_bot_config_interval_minutes_check" CHECK ((("interval_minutes" >= 1) AND ("interval_minutes" <= 1440)))
);


ALTER TABLE "public"."gyan_bot_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."gyan_bot_config" IS 'Singleton (id=1): automated student persona doubt posting for Gyan++.';



COMMENT ON COLUMN "public"."gyan_bot_config"."curriculum_sequence_index" IS 'Increments each bot post; modulo persona curriculum pool size picks the next cell.';



COMMENT ON COLUMN "public"."gyan_bot_config"."curriculum_batch_slot" IS '1–5 within a coverage cycle; slot 5 forces a numerical / exam-setup style doubt.';



CREATE TABLE IF NOT EXISTS "public"."gyan_curriculum_nodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" smallint NOT NULL,
    "sort_order" integer NOT NULL,
    "chapter_key" "text" NOT NULL,
    "chapter_label" "text" NOT NULL,
    "topic_key" "text" NOT NULL,
    "topic_label" "text" NOT NULL,
    "subtopic_key" "text",
    "subtopic_label" "text",
    "rag_query_hint" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gyan_curriculum_nodes_class_level_check" CHECK (("class_level" = ANY (ARRAY[11, 12])))
);


ALTER TABLE "public"."gyan_curriculum_nodes" OWNER TO "postgres";


COMMENT ON TABLE "public"."gyan_curriculum_nodes" IS 'CBSE-aligned curriculum cells for bot doubt rotation; rag_query_hint seeds RAG retrieval.';



CREATE TABLE IF NOT EXISTS "public"."inactive_day_penalties" (
    "user_id" "uuid" NOT NULL,
    "day" "date" NOT NULL,
    "penalty_rdm" integer NOT NULL,
    "penalized_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inactive_day_penalties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lessons_raw_post_boosts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lessons_raw_post_boosts" OWNER TO "postgres";


COMMENT ON TABLE "public"."lessons_raw_post_boosts" IS 'One boost per user per raw post';



CREATE TABLE IF NOT EXISTS "public"."lessons_raw_post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lessons_raw_post_comments_body_len" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 2000)))
);


ALTER TABLE "public"."lessons_raw_post_comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."lessons_raw_post_comments" IS 'Threaded comments on raw feed posts; parent_id for replies';



CREATE TABLE IF NOT EXISTS "public"."lessons_raw_post_votes" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vote" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lessons_raw_post_votes_vote_check" CHECK (("vote" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."lessons_raw_post_votes" OWNER TO "postgres";


COMMENT ON TABLE "public"."lessons_raw_post_votes" IS 'One vote per user per post: +1 or -1';



CREATE TABLE IF NOT EXISTS "public"."lessons_raw_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "content" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "subject" "text",
    "chapter_ref" "text",
    "boost_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "upvote_count" integer DEFAULT 0 NOT NULL,
    "downvote_count" integer DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "board_ref" "text",
    "grade_ref" "text",
    "unit_ref" "text",
    "topic_ref" "text",
    "subtopic_ref" "text",
    "source_type" "text",
    "source_payload" "jsonb",
    CONSTRAINT "lessons_raw_posts_kind_check" CHECK (("kind" = ANY (ARRAY['post'::"text", 'doubt'::"text", 'instacue'::"text"]))),
    CONSTRAINT "lessons_raw_posts_title_body_len" CHECK ((("char_length"(TRIM(BOTH FROM "title")) >= 3) AND ("char_length"(TRIM(BOTH FROM COALESCE("content", ''::"text"))) <= 2000)))
);


ALTER TABLE "public"."lessons_raw_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."lessons_raw_posts" IS 'Raw social feed posts on Lessons hub (non-Gyan++)';



COMMENT ON COLUMN "public"."lessons_raw_posts"."title" IS 'Short headline; body lives in content';



COMMENT ON COLUMN "public"."lessons_raw_posts"."board_ref" IS 'Origin board slug for contextual posts (e.g. cbse, icse)';



COMMENT ON COLUMN "public"."lessons_raw_posts"."grade_ref" IS 'Origin class/grade slug for contextual posts';



COMMENT ON COLUMN "public"."lessons_raw_posts"."unit_ref" IS 'Origin curriculum unit slug for contextual posts';



COMMENT ON COLUMN "public"."lessons_raw_posts"."topic_ref" IS 'Origin topic slug/title for contextual posts';



COMMENT ON COLUMN "public"."lessons_raw_posts"."subtopic_ref" IS 'Origin subtopic slug/title for contextual posts';



COMMENT ON COLUMN "public"."lessons_raw_posts"."source_type" IS 'Origin of post creation flow (e.g. quiz_post)';



COMMENT ON COLUMN "public"."lessons_raw_posts"."source_payload" IS 'Structured origin payload (score/accuracy/template metadata)';



CREATE TABLE IF NOT EXISTS "public"."live_session_joins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credits_deducted" integer DEFAULT 5 NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."live_session_joins" OWNER TO "postgres";


COMMENT ON TABLE "public"."live_session_joins" IS 'One row per user per session; first join deducts credits, re-joins are free.';



CREATE TABLE IF NOT EXISTS "public"."live_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meet_link" "text",
    "attendance_code" "text",
    "recording_url" "text",
    "recap_post_id" "uuid",
    "plan_json" "jsonb",
    "pre_assignment_post_id" "uuid",
    "post_assignment_post_id" "uuid",
    "section_id" "uuid"
);


ALTER TABLE "public"."live_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."live_sessions"."plan_json" IS 'Session plan: pre/post modes, custom text, concept refs, delay, trial (authoritative for teacher portal).';



COMMENT ON COLUMN "public"."live_sessions"."pre_assignment_post_id" IS 'Post id of auto-created pre-work assignment for this live session.';



COMMENT ON COLUMN "public"."live_sessions"."post_assignment_post_id" IS 'Post id of auto-created post-work assignment for this live session.';



CREATE TABLE IF NOT EXISTS "public"."magic_wall_basket_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "topic_key" "text" NOT NULL,
    "board" "text" DEFAULT 'CBSE'::"text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "exam_type" "text",
    "unit_name" "text",
    "chapter_title" "text",
    "topic_name" "text" NOT NULL,
    "source" "text" DEFAULT 'magic_wall'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "magic_wall_basket_items_board_check" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "magic_wall_basket_items_class_level_check" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "magic_wall_basket_items_exam_type_check" CHECK (("exam_type" = ANY (ARRAY['JEE'::"text", 'JEE_Mains'::"text", 'JEE_Advance'::"text", 'NEET'::"text", 'KCET'::"text", 'other'::"text"]))),
    CONSTRAINT "magic_wall_basket_items_subject_check" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text", 'biology'::"text"])))
);


ALTER TABLE "public"."magic_wall_basket_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."magic_wall_basket_items" IS 'Magic Wall reading basket selections persisted per user.';



CREATE TABLE IF NOT EXISTS "public"."magic_wall_topic_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "topic_key" "text" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."magic_wall_topic_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mock_community_share_rdm_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "attempt_key" "text" NOT NULL,
    "rdm_amount" integer DEFAULT 40 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mock_community_share_rdm_claims" OWNER TO "postgres";


COMMENT ON TABLE "public"."mock_community_share_rdm_claims" IS '+40 RDM for verified mock_test community post; one row per user per attempt_key.';



CREATE TABLE IF NOT EXISTS "public"."mock_papers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "exam_name" "text",
    "exam_set_name" "text",
    "paper_type" "text" DEFAULT 'pyq'::"text" NOT NULL,
    "duration_minutes" integer DEFAULT 180 NOT NULL,
    "total_marks" integer DEFAULT 360 NOT NULL,
    "question_count" integer DEFAULT 0 NOT NULL,
    "marking_scheme" "text" DEFAULT '+4 for each correct response, −1 for each incorrect response, 0 if unattempted.'::"text" NOT NULL,
    "class_level" smallint DEFAULT 12 NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "subjects_covered" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text",
    "chapter_id" "text",
    CONSTRAINT "mock_papers_class_level_check" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "mock_papers_paper_type_check" CHECK (("paper_type" = ANY (ARRAY['ncert'::"text", 'chapter'::"text", 'full'::"text", 'mock'::"text"]))),
    CONSTRAINT "mock_papers_subjects_check" CHECK (("subjects_covered" <@ ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text", 'biology'::"text"]))
);


ALTER TABLE "public"."mock_papers" OWNER TO "postgres";


COMMENT ON TABLE "public"."mock_papers" IS 'Curated timed mock exams (PYQ, NCERT, etc.); questions in mock_questions.';



COMMENT ON COLUMN "public"."mock_papers"."board" IS 'Board for chapter MCQs (e.g. CBSE). Null for legacy JEE institute mocks.';



COMMENT ON COLUMN "public"."mock_papers"."chapter_id" IS 'FK to cbse_mcq_chapters when paper_type = chapter.';



CREATE TABLE IF NOT EXISTS "public"."mock_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paper_id" "uuid" NOT NULL,
    "sort_order" integer NOT NULL,
    "source_question_id" "text",
    "subject" "text" NOT NULL,
    "topic" "text",
    "chapter" "text",
    "difficulty" "text",
    "question_html" "text" NOT NULL,
    "solution_html" "text",
    "correct_letter" character(1) NOT NULL,
    "options_json" "jsonb" NOT NULL,
    CONSTRAINT "mock_questions_correct_letter_check" CHECK (("correct_letter" = ANY (ARRAY['A'::"bpchar", 'B'::"bpchar", 'C'::"bpchar", 'D'::"bpchar"]))),
    CONSTRAINT "mock_questions_subject_check" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text", 'biology'::"text"])))
);


ALTER TABLE "public"."mock_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."mock_questions" IS 'Per-question rows for a mock_papers row; options_json is length-4 array.';



CREATE TABLE IF NOT EXISTS "public"."mock_rdm_bonus_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "paper_id" "uuid" NOT NULL,
    "ist_claim_date" "date" NOT NULL,
    "eligible" boolean DEFAULT false NOT NULL,
    "score_percent" integer,
    "correct_count" integer,
    "total_questions" integer,
    "denial_reason" "text",
    "rdm_awarded" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mock_rdm_bonus_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."mock_rdm_bonus_attempts" IS 'Audit log for mock 60% RDM bonus API; includes denials and successful grants.';



CREATE TABLE IF NOT EXISTS "public"."mock_rdm_bonus_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "paper_id" "uuid" NOT NULL,
    "ist_claim_date" "date" NOT NULL,
    "score_percent" integer NOT NULL,
    "correct_count" integer NOT NULL,
    "total_questions" integer NOT NULL,
    "rdm_amount" integer DEFAULT 50 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mock_rdm_bonus_claims" OWNER TO "postgres";


COMMENT ON TABLE "public"."mock_rdm_bonus_claims" IS 'Successful +50 RDM mock bonus: at most one row per user per IST date and one per user per catalog paper.';



CREATE TABLE IF NOT EXISTS "public"."mock_test_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "attempt_key" "text" NOT NULL,
    "session_kind" "text" NOT NULL,
    "catalog_paper_id" "uuid",
    "past_paper_id" "uuid",
    "paper_slug" "text",
    "paper_title" "text" NOT NULL,
    "score_percent" smallint,
    "correct_count" integer,
    "total_questions" integer,
    "subject_breakdown" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "duration_seconds" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mock_test_attempts_paper_ref_check" CHECK (((("session_kind" = 'quick_mock'::"text") AND ("catalog_paper_id" IS NULL) AND ("past_paper_id" IS NULL)) OR (("session_kind" = 'past_paper'::"text") AND ("past_paper_id" IS NOT NULL)) OR (("session_kind" = ANY (ARRAY['mock_paper'::"text", 'mcq_chapter'::"text"])) AND ("catalog_paper_id" IS NOT NULL)))),
    CONSTRAINT "mock_test_attempts_session_kind_check" CHECK (("session_kind" = ANY (ARRAY['mock_paper'::"text", 'past_paper'::"text", 'quick_mock'::"text", 'mcq_chapter'::"text"])))
);


ALTER TABLE "public"."mock_test_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."mock_test_attempts" IS 'Student mock attempt log: every completed session with overall score and per-subject breakdown; one row per user per attempt_key.';



CREATE TABLE IF NOT EXISTS "public"."news_blog_posts" (
    "id" "text" NOT NULL,
    "portal" "text" NOT NULL,
    "section" "text" NOT NULL,
    "exam" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "author" "text" DEFAULT ''::"text" NOT NULL,
    "role" "text" DEFAULT ''::"text" NOT NULL,
    "exam_date" "text" DEFAULT ''::"text" NOT NULL,
    "source_link" "text" DEFAULT ''::"text" NOT NULL,
    "hero_image_url" "text" DEFAULT ''::"text" NOT NULL,
    "inline_image_url" "text" DEFAULT ''::"text" NOT NULL,
    "hero_image_caption" "text" DEFAULT ''::"text" NOT NULL,
    "inline_image_caption" "text" DEFAULT ''::"text" NOT NULL,
    "revision_plan" "text" DEFAULT ''::"text" NOT NULL,
    "featured" "text" DEFAULT 'feed'::"text" NOT NULL,
    "publish_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_format" "text" DEFAULT 'text'::"text" NOT NULL,
    "raw_html" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "news_blog_posts_content_format_check" CHECK (("content_format" = ANY (ARRAY['text'::"text", 'html'::"text"]))),
    CONSTRAINT "news_blog_posts_featured_check" CHECK (("featured" = ANY (ARRAY['feed'::"text", 'hero'::"text", 'sidebar'::"text"]))),
    CONSTRAINT "news_blog_posts_portal_check" CHECK (("portal" = ANY (ARRAY['news'::"text", 'blog'::"text"])))
);


ALTER TABLE "public"."news_blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."numerals_community_share_rdm_claims" (
    "user_id" "uuid" NOT NULL,
    "topic_ref" "text" NOT NULL,
    "subtopic_ref" "text" NOT NULL,
    "formula_index" integer NOT NULL,
    "post_id" "uuid" NOT NULL,
    "rdm_amount" integer NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "numerals_community_share_rdm_claims_formula_index_check" CHECK (("formula_index" >= 0)),
    CONSTRAINT "numerals_community_share_rdm_claims_rdm_amount_check" CHECK (("rdm_amount" > 0))
);


ALTER TABLE "public"."numerals_community_share_rdm_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."past_paper_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paper_id" "uuid" NOT NULL,
    "sort_order" integer NOT NULL,
    "source_question_id" "text",
    "subject" "text" NOT NULL,
    "topic" "text",
    "chapter" "text",
    "difficulty" "text",
    "question_html" "text" NOT NULL,
    "solution_html" "text",
    "correct_letter" character(1) NOT NULL,
    "options_json" "jsonb" NOT NULL,
    CONSTRAINT "past_paper_questions_correct_letter_check" CHECK (("correct_letter" = ANY (ARRAY['A'::"bpchar", 'B'::"bpchar", 'C'::"bpchar", 'D'::"bpchar"]))),
    CONSTRAINT "past_paper_questions_subject_check" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text", 'biology'::"text"])))
);


ALTER TABLE "public"."past_paper_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."past_paper_questions" IS 'Per-question rows for past_papers.';



CREATE TABLE IF NOT EXISTS "public"."past_papers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "exam_name" "text",
    "exam_set_name" "text",
    "paper_type" "text" DEFAULT 'pyq'::"text" NOT NULL,
    "duration_minutes" integer DEFAULT 180 NOT NULL,
    "total_marks" integer DEFAULT 360 NOT NULL,
    "question_count" integer DEFAULT 0 NOT NULL,
    "marking_scheme" "text" DEFAULT '+4 for each correct response, -1 for each incorrect response, 0 if unattempted.'::"text" NOT NULL,
    "class_level" smallint DEFAULT 12 NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "subjects_covered" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "past_papers_class_level_check" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "past_papers_paper_type_check" CHECK (("paper_type" = 'pyq'::"text")),
    CONSTRAINT "past_papers_subjects_check" CHECK (("subjects_covered" <@ ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text", 'biology'::"text"]))
);


ALTER TABLE "public"."past_papers" OWNER TO "postgres";


COMMENT ON TABLE "public"."past_papers" IS 'Past papers catalog (PYQ only).';



CREATE TABLE IF NOT EXISTS "public"."platform_feedback_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "role" "text" NOT NULL,
    "overall_rating" smallint NOT NULL,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "extra_value" "text",
    "specific_ratings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "nps" smallint,
    "issue_category" "text",
    "issue_text" "text" DEFAULT ''::"text" NOT NULL,
    "suggestion" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'settings_feedback'::"text" NOT NULL,
    "user_email" "text",
    "user_display_name" "text",
    "admin_status" "text" DEFAULT 'new'::"text" NOT NULL,
    "admin_note" "text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "platform_feedback_submissions_admin_status_check" CHECK (("admin_status" = ANY (ARRAY['new'::"text", 'reviewed'::"text", 'resolved'::"text"]))),
    CONSTRAINT "platform_feedback_submissions_nps_check" CHECK ((("nps" IS NULL) OR (("nps" >= 0) AND ("nps" <= 10)))),
    CONSTRAINT "platform_feedback_submissions_overall_rating_check" CHECK ((("overall_rating" >= 1) AND ("overall_rating" <= 5))),
    CONSTRAINT "platform_feedback_submissions_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'teacher'::"text", 'parent'::"text"])))
);


ALTER TABLE "public"."platform_feedback_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_feedback_submissions" IS 'Structured product feedback from Settings survey (investor form spec).';



COMMENT ON COLUMN "public"."platform_feedback_submissions"."source" IS 'Form origin: settings_feedback, contact, etc.';



COMMENT ON COLUMN "public"."platform_feedback_submissions"."admin_status" IS 'Admin triage: new | reviewed | resolved';



CREATE TABLE IF NOT EXISTS "public"."play_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "is_correct" boolean NOT NULL,
    "time_taken_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pool_key" "text",
    "selected_answer_index" integer
);


ALTER TABLE "public"."play_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."play_history" IS 'Answer history; used to exclude correct repeats and update rating.';



COMMENT ON COLUMN "public"."play_history"."pool_key" IS 'Adaptive cycle sentinel (e.g. academic_all, academic_gauntlet) when set; used by get_adaptive_play_questions to scope exclusions.';



COMMENT ON COLUMN "public"."play_history"."selected_answer_index" IS '0-based index into play_questions.options at submit time. NULL for legacy rows, timeouts, or uncaptured attempts.';



CREATE TABLE IF NOT EXISTS "public"."play_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "domain" "text" NOT NULL,
    "category" "text" NOT NULL,
    "difficulty_rating" integer DEFAULT 1000 NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "correct_answer_index" integer NOT NULL,
    "explanation" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "play_questions_domain_check" CHECK (("domain" = ANY (ARRAY['academic'::"text", 'funbrain'::"text"])))
);


ALTER TABLE "public"."play_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."play_questions" IS 'Play questions: academic and funbrain. Bank was wiped 20260430310000; repopulate via new migrations or admin.';



COMMENT ON COLUMN "public"."play_questions"."category" IS 'Bucket: academic — physics, chemistry, math, biology, cs; funbrain — puzzles, verbal, quantitative, analytical, mental_math (rapid CBSE-style drills, separate from academic Mathematics).';



CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" NOT NULL,
    "visibility" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_json" "jsonb",
    "description" "text",
    "due_date" timestamp with time zone,
    "google_classroom_synced" boolean DEFAULT false NOT NULL,
    "tags" "text"[],
    "section_id" "uuid"
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prep_calendar_day_activity" (
    "user_id" "uuid" NOT NULL,
    "day" "date" NOT NULL,
    "class_count" integer DEFAULT 0 NOT NULL,
    "revision_count" integer DEFAULT 0 NOT NULL,
    "mock_count" integer DEFAULT 0 NOT NULL,
    "doubt_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "prep_calendar_day_activity_class_count_check" CHECK (("class_count" >= 0)),
    CONSTRAINT "prep_calendar_day_activity_doubt_count_check" CHECK (("doubt_count" >= 0)),
    CONSTRAINT "prep_calendar_day_activity_mock_count_check" CHECK (("mock_count" >= 0)),
    CONSTRAINT "prep_calendar_day_activity_revision_count_check" CHECK (("revision_count" >= 0))
);


ALTER TABLE "public"."prep_calendar_day_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_academics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "exam" "text" NOT NULL,
    "board" "text" DEFAULT ''::"text" NOT NULL,
    "score" "text" DEFAULT ''::"text" NOT NULL,
    "verified" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "marksheet_path" "text",
    "academic_year" "text",
    "record_status" "text" DEFAULT 'complete'::"text" NOT NULL,
    CONSTRAINT "profile_academics_record_status_check" CHECK (("record_status" = ANY (ARRAY['complete'::"text", 'in_progress'::"text"]))),
    CONSTRAINT "profile_academics_verified_check" CHECK (("verified" = ANY (ARRAY['verified'::"text", 'pending'::"text", 'unverified'::"text"])))
);


ALTER TABLE "public"."profile_academics" OWNER TO "postgres";


COMMENT ON TABLE "public"."profile_academics" IS 'Academic exam records (Class 10, 12, etc.) for public profile.';



COMMENT ON COLUMN "public"."profile_academics"."marksheet_path" IS 'Private storage path in academic-marksheets bucket.';



COMMENT ON COLUMN "public"."profile_academics"."academic_year" IS 'Calendar or academic year (e.g. 2024).';



COMMENT ON COLUMN "public"."profile_academics"."record_status" IS 'complete = final marks; in_progress = e.g. Class XII ongoing.';



CREATE TABLE IF NOT EXISTS "public"."profile_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "year" integer NOT NULL,
    "result" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "percentage" "text" DEFAULT ''::"text" NOT NULL,
    "marksheet_path" "text",
    "verified" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "profile_achievements_level_check" CHECK (("level" = ANY (ARRAY['School'::"text", 'District'::"text", 'State'::"text", 'National'::"text", 'International'::"text"]))),
    CONSTRAINT "profile_achievements_verified_check" CHECK (("verified" = ANY (ARRAY['verified'::"text", 'pending'::"text", 'unverified'::"text"])))
);


ALTER TABLE "public"."profile_achievements" OWNER TO "postgres";


COMMENT ON TABLE "public"."profile_achievements" IS 'Achievements and competitions for public profile.';



COMMENT ON COLUMN "public"."profile_achievements"."percentage" IS 'Score or percentage text shown on profile when verified.';



COMMENT ON COLUMN "public"."profile_achievements"."marksheet_path" IS 'Private storage object path in achievement-marksheets bucket.';



COMMENT ON COLUMN "public"."profile_achievements"."verified" IS 'verified | pending | unverified; only admins set verified.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "avatar_url" "text",
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "onboarding_complete" boolean DEFAULT false NOT NULL,
    "google_connected" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bio" "text",
    "class_level" integer,
    "stream" "text",
    "subject_combo" "text",
    "subjects" "text"[],
    "exam_tags" "text"[],
    "teaching_levels" integer[],
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "rdm" integer DEFAULT 0 NOT NULL,
    "lifetime_answer_rdm" integer DEFAULT 0 NOT NULL,
    "saved_bits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "saved_formulas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "saved_revision_cards" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "bits_test_attempts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "target_exam" "text",
    "subtopic_engagement" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "saved_revision_units" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "saved_community_posts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "daily_checklist_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "signup_google" boolean DEFAULT false NOT NULL,
    "daily_dose_streak" integer DEFAULT 0 NOT NULL,
    "last_daily_dose_streak_date" "date",
    "first_name" "text",
    "last_name" "text",
    "state" "text",
    "city" "text",
    "phone" "text",
    "gender" "text",
    "category" "text",
    "date_of_birth" "date",
    "institution_name" "text",
    "board" "text",
    "current_class_label" "text",
    "academic_record_extras" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "plan_tier" "text" DEFAULT 'free'::"text" NOT NULL,
    "buddy_privacy_settings" "jsonb" DEFAULT '{"share_rdm": true, "share_gyan": true, "share_play": true, "share_mocks": true, "share_streak": true, "share_classes": false, "share_edufund": true, "share_instacue": false, "share_community": true, "share_subtopics": true}'::"jsonb" NOT NULL,
    "free_trial_activated" boolean DEFAULT false NOT NULL,
    "free_trial_activated_at" timestamp with time zone,
    "trial_onboarding_answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "onboarding_reward_progress" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "onboarding_reward_claimed_at" timestamp with time zone,
    "time_travel_enabled" boolean DEFAULT false NOT NULL,
    "time_travel_offset_ms" bigint DEFAULT 0 NOT NULL,
    "free_trial_daily_streak" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "subscription_started_at" timestamp with time zone,
    "trial_second_round_activated" boolean DEFAULT false,
    "payment_card_details" "jsonb",
    "card_added_at" timestamp with time zone,
    "trial_end_bonus_activated" boolean DEFAULT false,
    "trial_streak_at_day_14" integer,
    "trial_original_ended_at" timestamp with time zone,
    "welcome_email_sent_at" timestamp with time zone,
    "subscription_expires_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."google_connected" IS 'True after explicit Google Calendar OAuth (refresh token stored in teacher_google_calendar_tokens). Not the same as signing in with Google.';



COMMENT ON COLUMN "public"."profiles"."rdm" IS 'User RDM balance. New accounts default to 0; free_trial_welcome_rdm is credited on trial activation via add_rdm.';



COMMENT ON COLUMN "public"."profiles"."saved_bits" IS 'User saved Bits (MCQ questions) from Deep Dive, persisted for revision.';



COMMENT ON COLUMN "public"."profiles"."saved_formulas" IS 'User saved formula practice sets from Deep Dive, persisted for revision.';



COMMENT ON COLUMN "public"."profiles"."saved_revision_cards" IS 'User-saved InstaCue revision cards; seeded catalog cards are not stored here.';



COMMENT ON COLUMN "public"."profiles"."bits_test_attempts" IS 'Per-user Bits test attempts keyed by board|subject|class|topic|subtopic|level for score recall and retake flow.';



COMMENT ON COLUMN "public"."profiles"."target_exam" IS 'Student exam focus: cbse | jee_mains | jee_advance | kcet | other. class_level may be null to mean both 11 & 12.';



COMMENT ON COLUMN "public"."profiles"."subtopic_engagement" IS 'Per-subtopic-level learning progress: quiz drafts, formula numerals drafts, InstaCue navigation/flip coverage, concepts pages visited. Keyed like bits_test_attempts.';



COMMENT ON COLUMN "public"."profiles"."saved_revision_units" IS 'User-saved Deep Dive revision units shown in Revision > Unit Revision.';



COMMENT ON COLUMN "public"."profiles"."saved_community_posts" IS 'User-saved lessons community posts shown in Revision > Community Posts.';



COMMENT ON COLUMN "public"."profiles"."daily_checklist_state" IS 'JSON map dateKey (YYYY-MM-DD) -> { instacueSessionAck?: bool, doubtsFocusMs?: number } for dashboard daily checklist.';



COMMENT ON COLUMN "public"."profiles"."signup_google" IS 'True when the user originally authenticated via Google (Supabase auth provider).';



COMMENT ON COLUMN "public"."profiles"."daily_dose_streak" IS 'Consecutive days (by gauntlet_date) completing BOTH academic and funbrain DailyDose.';



COMMENT ON COLUMN "public"."profiles"."last_daily_dose_streak_date" IS 'Last gauntlet_date when both DailyDoses were completed and streak was advanced (idempotency).';



COMMENT ON COLUMN "public"."profiles"."phone" IS '10-digit Indian mobile number without country code; UI shows +91.';



COMMENT ON COLUMN "public"."profiles"."current_class_label" IS 'Display label e.g. PUC I, PUC II, Class X; may map to class_level.';



COMMENT ON COLUMN "public"."profiles"."academic_record_extras" IS 'Optional subject-wise Class X marks and coaching; JSON shape defined by app.';



COMMENT ON COLUMN "public"."profiles"."plan_tier" IS 'Subscription plan tier: free (50 saves/type), scholar (500), champion (unlimited). Used for save cap enforcement.';



COMMENT ON COLUMN "public"."profiles"."buddy_privacy_settings" IS 'What this user shares with study buddies (Learning Buddy Advanced).';



COMMENT ON COLUMN "public"."profiles"."free_trial_activated" IS 'Tracks if the user has activated their 14-day free trial.';



COMMENT ON COLUMN "public"."profiles"."free_trial_activated_at" IS 'Timestamp when the free trial was activated.';



COMMENT ON COLUMN "public"."profiles"."trial_onboarding_answers" IS 'Persisted JSON answers from the student free trial onboarding questionnaire.';



COMMENT ON COLUMN "public"."profiles"."onboarding_reward_progress" IS 'Free-trial onboarding checklist task completion map (task id -> true).';



COMMENT ON COLUMN "public"."profiles"."onboarding_reward_claimed_at" IS 'Timestamp when the student claimed the free-trial checklist/lib checklist RDM reward.';



COMMENT ON COLUMN "public"."profiles"."free_trial_daily_streak" IS 'Per streak day ("2".."10"): task_ids + tasks.{tN}.completed_at while in progress; claimed_at when 6/6 RDM paid.';



COMMENT ON COLUMN "public"."profiles"."subscription_started_at" IS 'Timestamp when the student first activated a paid subscription (starter or pro). Used to calculate loyalty month index for dynamic RDM multipliers: Starter M1-3 = 0.5x, M4+ = 1.0x | Pro M1-5 = 1.0x, M6-11 = 1.5x, M12+ = 2.0x';



COMMENT ON COLUMN "public"."profiles"."trial_second_round_activated" IS 'Tracks if the student activated the additional 2-week free trial.';



COMMENT ON COLUMN "public"."profiles"."payment_card_details" IS 'Stores dummy card details and the selected plan.';



COMMENT ON COLUMN "public"."profiles"."card_added_at" IS 'Tracks when card details were saved (used to check the 24-hour bonus window).';



COMMENT ON COLUMN "public"."profiles"."trial_end_bonus_activated" IS 'Tracks if the student claimed the 1-month free bonus.';



COMMENT ON COLUMN "public"."profiles"."trial_streak_at_day_14" IS 'Stores their streak count when the 14-day trial completed.';



COMMENT ON COLUMN "public"."profiles"."trial_original_ended_at" IS 'Tracks when the initial 14-day trial officially expired.';



COMMENT ON COLUMN "public"."profiles"."welcome_email_sent_at" IS 'When the post-signup welcome letter was emailed to the user (IST-aware app logic).';



CREATE TABLE IF NOT EXISTS "public"."quiz_community_share_rdm_claims" (
    "user_id" "uuid" NOT NULL,
    "topic_ref" "text" NOT NULL,
    "subtopic_ref" "text" NOT NULL,
    "quiz_set" integer NOT NULL,
    "post_id" "uuid" NOT NULL,
    "rdm_amount" integer NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quiz_community_share_rdm_claims_quiz_set_check" CHECK (("quiz_set" >= 1)),
    CONSTRAINT "quiz_community_share_rdm_claims_rdm_amount_check" CHECK (("rdm_amount" > 0))
);


ALTER TABLE "public"."quiz_community_share_rdm_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rdm_config" (
    "key" "text" NOT NULL,
    "value" integer NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rdm_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."rdm_config" IS 'Dynamic configuration for RDM rewards (referrals, challenges, etc.). Editable by admins.';



CREATE TABLE IF NOT EXISTS "public"."refer_challenge_claims" (
    "user_id" "uuid" NOT NULL,
    "claim_date" "date" NOT NULL,
    "challenge_key" "text" NOT NULL,
    "win_claimed" boolean DEFAULT false NOT NULL,
    "share_claimed" boolean DEFAULT false NOT NULL,
    "win_claimed_at" timestamp with time zone,
    "share_claimed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "refer_challenge_claims_challenge_key_check" CHECK (("challenge_key" = ANY (ARRAY['5'::"text", '10'::"text", '20'::"text", '50'::"text"])))
);


ALTER TABLE "public"."refer_challenge_claims" OWNER TO "postgres";


COMMENT ON TABLE "public"."refer_challenge_claims" IS 'Per-user daily challenge reward claims (win + share) for refer challenges.';



COMMENT ON COLUMN "public"."refer_challenge_claims"."win_claimed" IS 'True when win reward is already claimed for this challenge/day.';



COMMENT ON COLUMN "public"."refer_challenge_claims"."share_claimed" IS 'True when share reward is already claimed for this challenge/day.';



CREATE TABLE IF NOT EXISTS "public"."referral_attributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referee_user_id" "uuid" NOT NULL,
    "referrer_user_id" "uuid" NOT NULL,
    "ref_code" "text" NOT NULL,
    "credited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "credited_week_start_ist" "date" NOT NULL,
    "referrer_rdm" integer DEFAULT 50 NOT NULL,
    "referee_rdm" integer DEFAULT 25 NOT NULL,
    CONSTRAINT "referral_attributions_ref_code_hex" CHECK (("char_length"("ref_code") = 7))
);


ALTER TABLE "public"."referral_attributions" OWNER TO "postgres";


COMMENT ON TABLE "public"."referral_attributions" IS 'One row per invited user (referee) ever. Inserts only via claim_referral_attribution (service_role).';



COMMENT ON COLUMN "public"."referral_attributions"."credited_week_start_ist" IS 'Monday (IST calendar) of the referral week for weekly bonus / leaderboard grouping.';



CREATE TABLE IF NOT EXISTS "public"."referral_weekly_bonuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referrer_user_id" "uuid" NOT NULL,
    "week_start_ist" "date" NOT NULL,
    "rdm_awarded" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."referral_weekly_bonuses" OWNER TO "postgres";


COMMENT ON TABLE "public"."referral_weekly_bonuses" IS 'Guards +100 RDM weekly bonus once per IST Monday-week per referrer.';



CREATE TABLE IF NOT EXISTS "public"."saved_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "saved_questions_source_type_check" CHECK (("source_type" = ANY (ARRAY['mock'::"text", 'past_paper'::"text", 'static'::"text"])))
);


ALTER TABLE "public"."saved_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."saved_questions" IS 'Student bookmarks for mock/past-paper/static practice questions; one row per user+question+source.';



CREATE TABLE IF NOT EXISTS "public"."student_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "page" "text",
    "session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_gyan_presence" (
    "user_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_gyan_presence" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_gyan_presence" IS 'Latest Gyan++ (/doubts) focus heartbeat for Learning Buddy right-now display.';



CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
)
PARTITION BY RANGE ("occurred_at");


ALTER TABLE "public"."student_learning_dwell_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_learning_dwell_events" IS 'Heartbeat-derived active dwell samples per subtopic panel (monthly partitions).';



CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2025_12" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2025_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_01" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_02" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_03" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_04" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_05" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_06" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_07" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_08" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_09" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_10" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_11" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2026_12" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2026_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2027_01" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2027_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2027_02" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2027_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2027_03" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2027_03" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2027_04" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2027_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2027_05" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2027_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_dwell_2027_06" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "delta_ms" integer NOT NULL,
    "bits_question_index" integer,
    "client_session_id" "text",
    CONSTRAINT "student_learning_dwell_events_board_check1" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_class_level_check1" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_dwell_events_delta_ms_check1" CHECK ((("delta_ms" > 0) AND ("delta_ms" <= 3600000))),
    CONSTRAINT "student_learning_dwell_events_level_check1" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_panel_check1" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_dwell_events_subject_check1" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_dwell_2027_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_learning_presence" (
    "user_id" "uuid" NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "panel" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_learning_presence_board_check" CHECK (("board" = ANY (ARRAY['CBSE'::"text", 'ICSE'::"text"]))),
    CONSTRAINT "student_learning_presence_class_level_check" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_learning_presence_level_check" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_learning_presence_panel_check" CHECK (("panel" = ANY (ARRAY['theory'::"text", 'bits'::"text", 'numerals'::"text", 'instacue'::"text"]))),
    CONSTRAINT "student_learning_presence_subject_check" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_learning_presence" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_learning_presence" IS 'Latest subtopic panel per student for Learning Buddy right-now display.';



CREATE TABLE IF NOT EXISTS "public"."student_lesson_mark_completions" (
    "user_id" "uuid" NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" smallint NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic" "text" NOT NULL,
    "level" "text" NOT NULL,
    "marked_complete_at" timestamp with time zone NOT NULL,
    CONSTRAINT "student_lesson_mark_completions_class_level_check" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "student_lesson_mark_completions_level_check" CHECK (("level" = ANY (ARRAY['basics'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "student_lesson_mark_completions_subject_check" CHECK (("lower"(TRIM(BOTH FROM "subject")) = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."student_lesson_mark_completions" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_lesson_mark_completions" IS 'Per-user lesson checklist completion (lessonChecklistMarkedCompleteAt). Advanced rows are written from /api/user/subtopic-engagement; used for chapter/topic rollups and UI ticks.';



CREATE TABLE IF NOT EXISTS "public"."student_section_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "section_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "left_at" timestamp with time zone
);


ALTER TABLE "public"."student_section_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_site_presence" (
    "user_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_site_presence" OWNER TO "postgres";


COMMENT ON TABLE "public"."student_site_presence" IS 'Latest site-wide focus heartbeat for Learning Buddy right-now display.';



CREATE TABLE IF NOT EXISTS "public"."study_buddies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "buddy_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    CONSTRAINT "study_buddies_no_self" CHECK (("user_id" <> "buddy_user_id")),
    CONSTRAINT "study_buddies_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."study_buddies" OWNER TO "postgres";


COMMENT ON TABLE "public"."study_buddies" IS 'Symmetric buddy pair rows (one row per side). At most one active buddy per user.';



CREATE TABLE IF NOT EXISTS "public"."study_streak_milestone_claims" (
    "user_id" "uuid" NOT NULL,
    "streak_start_date" "date" NOT NULL,
    "milestone_days" integer NOT NULL,
    "claimed_rdm" integer NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."study_streak_milestone_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subject_topic_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "context_key" "text" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subject_topic_chat_messages_content_len" CHECK (("char_length"("content") <= 8000)),
    CONSTRAINT "subject_topic_chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."subject_topic_chat_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."subject_topic_chat_messages" IS 'Append-only topic chat messages; RLS restricts to owning user.';



CREATE TABLE IF NOT EXISTS "public"."subscription_coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "plan_tier" "text" NOT NULL,
    "duration_months" integer NOT NULL,
    "restricted_to_user_ids" "uuid"[],
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "redeemed_at" timestamp with time zone,
    "redeemed_by_user_id" "uuid",
    CONSTRAINT "subscription_coupons_duration_months_check" CHECK (("duration_months" > 0)),
    CONSTRAINT "subscription_coupons_plan_tier_check" CHECK (("plan_tier" = ANY (ARRAY['starter'::"text", 'pro'::"text"]))),
    CONSTRAINT "subscription_coupons_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'redeemed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."subscription_coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subtopic_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "subtopic_name" "text" NOT NULL,
    "level" "text" NOT NULL,
    "theory" "text" DEFAULT ''::"text" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reading_references" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "did_you_know" "text" DEFAULT ''::"text" NOT NULL,
    "instacue_cards" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "bits_questions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "practice_formulas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "display_title" "text"
);


ALTER TABLE "public"."subtopic_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."subtopic_content" IS 'Global editable subtopic theory content (admin-managed).';



COMMENT ON COLUMN "public"."subtopic_content"."theory" IS 'Rendered markdown for topic page left-panel theory.';



COMMENT ON COLUMN "public"."subtopic_content"."reading_references" IS 'JSON array of {type,title,url,description?} for video and reading links.';



COMMENT ON COLUMN "public"."subtopic_content"."did_you_know" IS 'Optional short fact shown in Did you know dialog.';



COMMENT ON COLUMN "public"."subtopic_content"."instacue_cards" IS 'JSON array of {type, frontContent, backContent} flashcards generated by AI.';



COMMENT ON COLUMN "public"."subtopic_content"."bits_questions" IS 'JSON array of {question, options[], correctAnswer, solution} MCQs generated by AI.';



COMMENT ON COLUMN "public"."subtopic_content"."practice_formulas" IS 'JSON array of {name, formulaLatex, description, bitsQuestions[]} formula practice sets generated by AI.';



COMMENT ON COLUMN "public"."subtopic_content"."display_title" IS 'Optional heading shown on subtopic deep dive; NULL uses curriculum subtopic name.';



CREATE TABLE IF NOT EXISTS "public"."teacher_generated_test_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid",
    "board" "text" DEFAULT 'CBSE'::"text" NOT NULL,
    "class_level" integer NOT NULL,
    "subject" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "chapter_title" "text",
    "topic_title" "text",
    "unit_title" "text",
    "questions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "question_count" integer DEFAULT 0 NOT NULL,
    "duration_minutes" integer,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "used_question_ids" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "teacher_generated_test_history_class_level_check" CHECK (("class_level" = ANY (ARRAY[11, 12]))),
    CONSTRAINT "teacher_generated_test_history_scope_check" CHECK (("scope" = ANY (ARRAY['Topic-wise'::"text", 'Unit-wise'::"text", 'Chapter-wise'::"text", 'Full paper'::"text"]))),
    CONSTRAINT "teacher_generated_test_history_subject_check" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text"])))
);


ALTER TABLE "public"."teacher_generated_test_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_google_calendar_tokens" (
    "user_id" "uuid" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "access_token" "text",
    "access_token_expires_at" timestamp with time zone,
    "scope" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teacher_google_calendar_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."teacher_google_calendar_tokens" IS 'Google OAuth refresh tokens for Calendar API; never expose to client.';



CREATE TABLE IF NOT EXISTS "public"."teacher_motivation_rdm_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "motivation_post_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "assignment_post_id" "uuid",
    "amount" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "teacher_motivation_rdm_grants_amount_check" CHECK (("amount" > 0)),
    CONSTRAINT "teacher_motivation_rdm_grants_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."teacher_motivation_rdm_grants" OWNER TO "postgres";


COMMENT ON TABLE "public"."teacher_motivation_rdm_grants" IS 'Per-student RDM bonus from teacher motivation; paid when assignment_post_id work is complete.';



CREATE TABLE IF NOT EXISTS "public"."teacher_profile_details" (
    "teacher_id" "uuid" NOT NULL,
    "location" "text",
    "qualification" "text",
    "experience" "text",
    "email" "text",
    "phone" "text",
    "youtube_or_social" "text",
    "aadhar_photo_url" "text",
    "aadhar_share_link" "text",
    "institute_certificate_photo_url" "text",
    "institute_certificate_share_link" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_email_verified_at" timestamp with time zone,
    "verified_contact_email" "text",
    "verification_status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "admin_notes" "text",
    "submitted_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    CONSTRAINT "teacher_profile_details_doc_presence_chk" CHECK (((COALESCE(NULLIF(TRIM(BOTH FROM "aadhar_photo_url"), ''::"text"), NULLIF(TRIM(BOTH FROM "aadhar_share_link"), ''::"text")) IS NOT NULL) AND (COALESCE(NULLIF(TRIM(BOTH FROM "institute_certificate_photo_url"), ''::"text"), NULLIF(TRIM(BOTH FROM "institute_certificate_share_link"), ''::"text")) IS NOT NULL))),
    CONSTRAINT "teacher_profile_details_email_format_chk" CHECK ((("email" IS NULL) OR (TRIM(BOTH FROM "email") = ''::"text") OR ("email" ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'::"text"))),
    CONSTRAINT "teacher_profile_details_verification_status_chk" CHECK (("verification_status" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."teacher_profile_details" OWNER TO "postgres";


COMMENT ON TABLE "public"."teacher_profile_details" IS 'Extended teacher profile fields including optional KYC/verification links and professional details.';



COMMENT ON COLUMN "public"."teacher_profile_details"."teacher_id" IS 'Maps 1:1 to profiles.id for teacher accounts.';



COMMENT ON COLUMN "public"."teacher_profile_details"."aadhar_photo_url" IS 'Direct URL to Aadhaar photo/proof (optional if share link exists).';



COMMENT ON COLUMN "public"."teacher_profile_details"."aadhar_share_link" IS 'Shareable link to Aadhaar proof (optional if photo URL exists).';



COMMENT ON COLUMN "public"."teacher_profile_details"."institute_certificate_photo_url" IS 'Direct URL to institute/study certificate proof (optional if share link exists).';



COMMENT ON COLUMN "public"."teacher_profile_details"."institute_certificate_share_link" IS 'Shareable link to institute/study certificate proof (optional if photo URL exists).';



COMMENT ON COLUMN "public"."teacher_profile_details"."contact_email_verified_at" IS 'Timestamp when the teacher completed Supabase email OTP verification for the contact email.';



COMMENT ON COLUMN "public"."teacher_profile_details"."verified_contact_email" IS 'Lowercase email string last verified; must match email column to show verified.';



COMMENT ON COLUMN "public"."teacher_profile_details"."verification_status" IS 'Teacher verification workflow status: unverified, pending, approved, rejected.';



COMMENT ON COLUMN "public"."teacher_profile_details"."admin_notes" IS 'Admin feedback for rejected/correction-required profiles.';



COMMENT ON COLUMN "public"."teacher_profile_details"."submitted_at" IS 'When teacher submitted full verification details for review.';



COMMENT ON COLUMN "public"."teacher_profile_details"."reviewed_at" IS 'When admin reviewed the latest verification submission.';



COMMENT ON COLUMN "public"."teacher_profile_details"."approved_at" IS 'When verification was approved by an admin.';



COMMENT ON COLUMN "public"."teacher_profile_details"."rejected_at" IS 'When verification was rejected by an admin.';



CREATE TABLE IF NOT EXISTS "public"."topic_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "level" "text" NOT NULL,
    "why_study" "text" DEFAULT ''::"text" NOT NULL,
    "what_learn" "text" DEFAULT ''::"text" NOT NULL,
    "real_world" "text" DEFAULT ''::"text" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hub_scope" "text" DEFAULT 'topic'::"text" NOT NULL,
    "subtopic_previews" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "topic_content_hub_scope_check" CHECK (("hub_scope" = ANY (ARRAY['topic'::"text", 'chapter'::"text"])))
);


ALTER TABLE "public"."topic_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."topic_content" IS 'Topic hub overview sections (admin-managed, RAG+LLM generated).';



COMMENT ON COLUMN "public"."topic_content"."why_study" IS 'Markdown: why study this topic/chapter.';



COMMENT ON COLUMN "public"."topic_content"."what_learn" IS 'Markdown: learning outcomes.';



COMMENT ON COLUMN "public"."topic_content"."real_world" IS 'Markdown: real-world importance.';



COMMENT ON COLUMN "public"."topic_content"."hub_scope" IS 'topic = one syllabus topic hub (e.g. Coulomb''s Law); chapter = whole-chapter landing in Explore (topic column holds chapter title).';



COMMENT ON COLUMN "public"."topic_content"."subtopic_previews" IS 'Agent-generated array of { subtopicName: string, preview: string }.';



CREATE TABLE IF NOT EXISTS "public"."topic_content_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_level" integer NOT NULL,
    "topic" "text" NOT NULL,
    "level" "text" NOT NULL,
    "run_type" "text" NOT NULL,
    "feedback_text" "text" DEFAULT ''::"text" NOT NULL,
    "liked_points" "text" DEFAULT ''::"text" NOT NULL,
    "disliked_points" "text" DEFAULT ''::"text" NOT NULL,
    "instructions" "text" DEFAULT ''::"text" NOT NULL,
    "previous_content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rag_chunk_count" integer DEFAULT 0 NOT NULL,
    "model_id" "text" DEFAULT ''::"text" NOT NULL,
    "output_content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hub_scope" "text" DEFAULT 'topic'::"text" NOT NULL,
    CONSTRAINT "topic_content_runs_hub_scope_check" CHECK (("hub_scope" = ANY (ARRAY['topic'::"text", 'chapter'::"text"]))),
    CONSTRAINT "topic_content_runs_run_type_check" CHECK (("run_type" = ANY (ARRAY['generate'::"text", 'regenerate'::"text"])))
);


ALTER TABLE "public"."topic_content_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."topic_content_runs" IS 'History of topic_content AI generations and regenerations with optional user feedback.';



COMMENT ON COLUMN "public"."topic_content_runs"."hub_scope" IS 'Matches topic_content.hub_scope for the run.';



CREATE TABLE IF NOT EXISTS "public"."topic_quiz_advanced_rdm_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ist_claim_date" "date" NOT NULL,
    "board" "text",
    "subject" "text",
    "class_level" integer,
    "topic" "text",
    "subtopic_name" "text",
    "eligible" boolean DEFAULT false NOT NULL,
    "score_percent" integer,
    "correct_count" integer,
    "total_questions" integer,
    "denial_reason" "text",
    "rdm_awarded" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."topic_quiz_advanced_rdm_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."topic_quiz_advanced_rdm_attempts" IS 'Audit log for claim_topic_quiz_advanced_daily_rdm (success + denials).';



CREATE TABLE IF NOT EXISTS "public"."transactional_email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ist_date" "date" NOT NULL,
    "kind" "text" NOT NULL,
    "recipient" "text" NOT NULL,
    "user_id" "uuid",
    "subject" "text" NOT NULL,
    "status" "text" NOT NULL,
    "message_id" "text",
    "error_message" "text",
    CONSTRAINT "transactional_email_logs_kind_check" CHECK (("kind" = ANY (ARRAY['welcome'::"text", 'login'::"text", 'approval'::"text", 'other'::"text"]))),
    CONSTRAINT "transactional_email_logs_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text", 'blocked_cap'::"text"])))
);


ALTER TABLE "public"."transactional_email_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."transactional_email_logs" IS 'Outbound SMTP sends (welcome/login). ist_date is Asia/Kolkata calendar day for admin daily totals.';



CREATE TABLE IF NOT EXISTS "public"."user_memory_profile" (
    "user_id" "uuid" NOT NULL,
    "canonical_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_memory_profile" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_memory_profile" IS 'Per-user canonical memory profile (JSONB); async updates from Modal.';



CREATE TABLE IF NOT EXISTS "public"."user_play_stats" (
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "current_rating" integer DEFAULT 1000 NOT NULL,
    "questions_answered" integer DEFAULT 0 NOT NULL,
    "win_streak" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "question_pool_reset_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_play_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_play_stats" IS 'Per-user per-category rating and streak for adaptive play.';



COMMENT ON COLUMN "public"."user_play_stats"."question_pool_reset_at" IS 'Start of current question cycle: correct answers after this time suppress repeats until the whole pool is mastered, then time resets.';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_saved_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "content_id" "text" NOT NULL,
    "subject" "text",
    "status" "text",
    "saved_at" timestamp with time zone,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_saved_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['saved_bit'::"text", 'saved_formula'::"text", 'saved_revision_card'::"text", 'saved_revision_unit'::"text", 'saved_community_post'::"text"])))
);


ALTER TABLE "public"."user_saved_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_study_day_totals" (
    "user_id" "uuid" NOT NULL,
    "day" "date" NOT NULL,
    "active_ms" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "presence_ms" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "user_study_day_totals_active_ms_check" CHECK (("active_ms" >= 0)),
    CONSTRAINT "user_study_day_totals_presence_ms_check" CHECK (("presence_ms" >= 0))
);


ALTER TABLE "public"."user_study_day_totals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "waitlist_id" "text" NOT NULL,
    "role" "text",
    "first_name" "text",
    "last_name" "text",
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "city" "text",
    "state" "text",
    "student_class" "text",
    "school" "text",
    "exam" "text",
    "coaching" "text",
    "study_hours" "text",
    "grade10_marks" "text",
    "primary_subject" "text",
    "experience" "text",
    "students_count" "text",
    "linkedin" "text",
    "child_class" "text",
    "child_exam" "text",
    "organisation" "text",
    "organisation_role" "text",
    "website" "text",
    "interests" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "why_join" "text",
    "referral" "text",
    "refcode" "text",
    "consent_terms" boolean DEFAULT false NOT NULL,
    "consent_updates" boolean DEFAULT false NOT NULL,
    "admin_status" "text" DEFAULT 'new'::"text" NOT NULL,
    "admin_note" "text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "signup_tier" "text" DEFAULT 'ambassador'::"text" NOT NULL,
    "ambassador_applied_at" timestamp with time zone,
    CONSTRAINT "waitlist_submissions_admin_status_check" CHECK (("admin_status" = ANY (ARRAY['new'::"text", 'reviewed'::"text", 'resolved'::"text"]))),
    CONSTRAINT "waitlist_submissions_role_check" CHECK ((("role" IS NULL) OR ("role" = ANY (ARRAY['student'::"text", 'teacher'::"text", 'parent'::"text", 'other'::"text"])))),
    CONSTRAINT "waitlist_submissions_signup_tier_check" CHECK (("signup_tier" = ANY (ARRAY['waitlist'::"text", 'ambassador'::"text"])))
);


ALTER TABLE "public"."waitlist_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."waitlist_submissions" IS 'Submissions from public waitlist form with structured student/teacher/parent details.';



COMMENT ON COLUMN "public"."waitlist_submissions"."signup_tier" IS 'waitlist = Step 1 only (email + phone); ambassador = full application submitted';



CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb",
    "metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2025_12" FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_01" FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_02" FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_03" FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_04" FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_05" FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_06" FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_07" FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_08" FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_09" FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_10" FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_11" FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2026_12" FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2027_01" FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2027_02" FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2027_03" FOR VALUES FROM ('2027-03-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2027_04" FOR VALUES FROM ('2027-04-01 00:00:00+00') TO ('2027-05-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2027_05" FOR VALUES FROM ('2027-05-01 00:00:00+00') TO ('2027-06-01 00:00:00+00');



ALTER TABLE ONLY "public"."student_learning_dwell_events" ATTACH PARTITION "public"."student_learning_dwell_2027_06" FOR VALUES FROM ('2027-06-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');



ALTER TABLE ONLY "public"."accepted_answer_payouts"
    ADD CONSTRAINT "accepted_answer_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_analytics_cache"
    ADD CONSTRAINT "admin_analytics_cache_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_user_actions"
    ADD CONSTRAINT "admin_user_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_token_logs"
    ADD CONSTRAINT "ai_token_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approved_emails"
    ADD CONSTRAINT "approved_emails_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."approved_emails"
    ADD CONSTRAINT "approved_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_invites"
    ADD CONSTRAINT "buddy_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buddy_invites"
    ADD CONSTRAINT "buddy_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."cbse_mcq_chapters"
    ADD CONSTRAINT "cbse_mcq_chapters_class_subject_sort" UNIQUE ("board", "class_level", "subject", "sort_order");



ALTER TABLE ONLY "public"."cbse_mcq_chapters"
    ADD CONSTRAINT "cbse_mcq_chapters_pkey" PRIMARY KEY ("chapter_id");



ALTER TABLE ONLY "public"."cbse_mcq_community_share_rdm_claims"
    ADD CONSTRAINT "cbse_mcq_community_share_rdm_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cbse_mcq_community_share_rdm_claims"
    ADD CONSTRAINT "cbse_mcq_community_share_rdm_claims_user_id_attempt_key_key" UNIQUE ("user_id", "attempt_key");



ALTER TABLE ONLY "public"."cbse_mcq_score_bonus_claims"
    ADD CONSTRAINT "cbse_mcq_score_bonus_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cbse_mcq_score_bonus_claims"
    ADD CONSTRAINT "cbse_mcq_score_bonus_claims_user_id_attempt_key_key" UNIQUE ("user_id", "attempt_key");



ALTER TABLE ONLY "public"."class_exploration_sessions"
    ADD CONSTRAINT "class_exploration_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_exploration_sessions"
    ADD CONSTRAINT "class_exploration_sessions_user_id_classroom_id_key" UNIQUE ("user_id", "classroom_id");



ALTER TABLE ONLY "public"."classroom_assignment_responses"
    ADD CONSTRAINT "classroom_assignment_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_assignment_responses"
    ADD CONSTRAINT "classroom_assignment_responses_unique" UNIQUE ("post_id", "task_id", "user_id");



ALTER TABLE ONLY "public"."classroom_assignment_task_progress"
    ADD CONSTRAINT "classroom_assignment_task_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_assignment_task_progress"
    ADD CONSTRAINT "classroom_assignment_task_progress_unique" UNIQUE ("post_id", "task_id", "user_id");



ALTER TABLE ONLY "public"."classroom_generated_test_attempts"
    ADD CONSTRAINT "classroom_generated_test_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_generated_test_attempts"
    ADD CONSTRAINT "classroom_generated_test_attempts_unique" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."classroom_join_requests"
    ADD CONSTRAINT "classroom_join_requests_classroom_id_user_id_key" UNIQUE ("classroom_id", "user_id");



ALTER TABLE ONLY "public"."classroom_join_requests"
    ADD CONSTRAINT "classroom_join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_members"
    ADD CONSTRAINT "classroom_members_classroom_id_user_id_key" UNIQUE ("classroom_id", "user_id");



ALTER TABLE ONLY "public"."classroom_members"
    ADD CONSTRAINT "classroom_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_reviews"
    ADD CONSTRAINT "classroom_reviews_classroom_id_user_id_key" UNIQUE ("classroom_id", "user_id");



ALTER TABLE ONLY "public"."classroom_reviews"
    ADD CONSTRAINT "classroom_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_sections"
    ADD CONSTRAINT "classroom_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classrooms"
    ADD CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."curriculum_chapters"
    ADD CONSTRAINT "curriculum_chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."curriculum_chapters"
    ADD CONSTRAINT "curriculum_chapters_title_nonempty" CHECK (("length"("btrim"("title")) > 0)) NOT VALID;



ALTER TABLE ONLY "public"."curriculum_chapters"
    ADD CONSTRAINT "curriculum_chapters_unit_id_title_key" UNIQUE ("unit_id", "title");



ALTER TABLE "public"."curriculum_subtopics"
    ADD CONSTRAINT "curriculum_subtopics_name_nonempty" CHECK (("length"("btrim"("name")) > 0)) NOT VALID;



ALTER TABLE ONLY "public"."curriculum_subtopics"
    ADD CONSTRAINT "curriculum_subtopics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."curriculum_topics"
    ADD CONSTRAINT "curriculum_topics_chapter_id_title_key" UNIQUE ("chapter_id", "title");



ALTER TABLE ONLY "public"."curriculum_topics"
    ADD CONSTRAINT "curriculum_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."curriculum_topics"
    ADD CONSTRAINT "curriculum_topics_title_nonempty" CHECK (("length"("btrim"("title")) > 0)) NOT VALID;



ALTER TABLE "public"."curriculum_units"
    ADD CONSTRAINT "curriculum_units_class_level_allowed" CHECK (("class_level" = ANY (ARRAY[11, 12]))) NOT VALID;



ALTER TABLE ONLY "public"."curriculum_units"
    ADD CONSTRAINT "curriculum_units_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."curriculum_units"
    ADD CONSTRAINT "curriculum_units_subject_allowed" CHECK (("subject" = ANY (ARRAY['physics'::"text", 'chemistry'::"text", 'math'::"text", 'biology'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."curriculum_units"
    ADD CONSTRAINT "curriculum_units_subject_class_level_unit_label_key" UNIQUE ("subject", "class_level", "unit_label");



ALTER TABLE "public"."curriculum_units"
    ADD CONSTRAINT "curriculum_units_unit_label_nonempty" CHECK (("length"("btrim"("unit_label")) > 0)) NOT VALID;



ALTER TABLE "public"."curriculum_units"
    ADD CONSTRAINT "curriculum_units_unit_title_nonempty" CHECK (("length"("btrim"("unit_title")) > 0)) NOT VALID;



ALTER TABLE ONLY "public"."daily_gauntlet_attempts"
    ADD CONSTRAINT "daily_gauntlet_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_gauntlet_attempts"
    ADD CONSTRAINT "daily_gauntlet_attempts_user_id_gauntlet_date_domain_key" UNIQUE ("user_id", "gauntlet_date", "domain");



ALTER TABLE ONLY "public"."daily_reward_claims"
    ADD CONSTRAINT "daily_reward_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_reward_claims"
    ADD CONSTRAINT "daily_reward_claims_user_id_action_type_claim_date_ist_key" UNIQUE ("user_id", "action_type", "claim_date_ist");



ALTER TABLE ONLY "public"."doubt_answer_reports"
    ADD CONSTRAINT "doubt_answer_reports_answer_id_reporter_user_id_key" UNIQUE ("answer_id", "reporter_user_id");



ALTER TABLE ONLY "public"."doubt_answer_reports"
    ADD CONSTRAINT "doubt_answer_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doubt_answers"
    ADD CONSTRAINT "doubt_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doubt_saves"
    ADD CONSTRAINT "doubt_saves_pkey" PRIMARY KEY ("user_id", "doubt_id");



ALTER TABLE ONLY "public"."doubt_votes"
    ADD CONSTRAINT "doubt_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doubt_votes"
    ADD CONSTRAINT "doubt_votes_user_id_target_type_target_id_key" UNIQUE ("user_id", "target_type", "target_id");



ALTER TABLE ONLY "public"."doubts"
    ADD CONSTRAINT "doubts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."episodic_memory"
    ADD CONSTRAINT "episodic_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."explorer_live_joins"
    ADD CONSTRAINT "explorer_live_joins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."explorer_live_joins"
    ADD CONSTRAINT "explorer_live_joins_session_id_user_id_key" UNIQUE ("session_id", "user_id");



ALTER TABLE ONLY "public"."gyan_bot_config"
    ADD CONSTRAINT "gyan_bot_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gyan_curriculum_nodes"
    ADD CONSTRAINT "gyan_curriculum_nodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gyan_curriculum_nodes"
    ADD CONSTRAINT "gyan_curriculum_nodes_sort_order_key" UNIQUE ("sort_order");



ALTER TABLE ONLY "public"."inactive_day_penalties"
    ADD CONSTRAINT "inactive_day_penalties_pkey" PRIMARY KEY ("user_id", "day");



ALTER TABLE ONLY "public"."lessons_raw_post_boosts"
    ADD CONSTRAINT "lessons_raw_post_boosts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lessons_raw_post_boosts"
    ADD CONSTRAINT "lessons_raw_post_boosts_unique" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."lessons_raw_post_comments"
    ADD CONSTRAINT "lessons_raw_post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lessons_raw_post_votes"
    ADD CONSTRAINT "lessons_raw_post_votes_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."lessons_raw_posts"
    ADD CONSTRAINT "lessons_raw_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_session_joins"
    ADD CONSTRAINT "live_session_joins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_session_joins"
    ADD CONSTRAINT "live_session_joins_session_id_user_id_key" UNIQUE ("session_id", "user_id");



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."magic_wall_basket_items"
    ADD CONSTRAINT "magic_wall_basket_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."magic_wall_basket_items"
    ADD CONSTRAINT "magic_wall_basket_items_user_id_topic_key_key" UNIQUE ("user_id", "topic_key");



ALTER TABLE ONLY "public"."magic_wall_topic_attempts"
    ADD CONSTRAINT "magic_wall_topic_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mock_community_share_rdm_claims"
    ADD CONSTRAINT "mock_comm_share_user_attempt" UNIQUE ("user_id", "attempt_key");



ALTER TABLE ONLY "public"."mock_community_share_rdm_claims"
    ADD CONSTRAINT "mock_comm_share_user_post" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."mock_community_share_rdm_claims"
    ADD CONSTRAINT "mock_community_share_rdm_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mock_papers"
    ADD CONSTRAINT "mock_papers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mock_papers"
    ADD CONSTRAINT "mock_papers_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."mock_questions"
    ADD CONSTRAINT "mock_questions_paper_sort" UNIQUE ("paper_id", "sort_order");



ALTER TABLE ONLY "public"."mock_questions"
    ADD CONSTRAINT "mock_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mock_rdm_bonus_attempts"
    ADD CONSTRAINT "mock_rdm_bonus_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mock_rdm_bonus_claims"
    ADD CONSTRAINT "mock_rdm_bonus_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mock_rdm_bonus_claims"
    ADD CONSTRAINT "mock_rdm_bonus_claims_user_ist_day" UNIQUE ("user_id", "ist_claim_date");



ALTER TABLE ONLY "public"."mock_rdm_bonus_claims"
    ADD CONSTRAINT "mock_rdm_bonus_claims_user_paper" UNIQUE ("user_id", "paper_id");



ALTER TABLE ONLY "public"."mock_test_attempts"
    ADD CONSTRAINT "mock_test_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mock_test_attempts"
    ADD CONSTRAINT "mock_test_attempts_user_attempt_key" UNIQUE ("user_id", "attempt_key");



ALTER TABLE ONLY "public"."news_blog_posts"
    ADD CONSTRAINT "news_blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."numerals_community_share_rdm_claims"
    ADD CONSTRAINT "numerals_community_share_rdm_claims_pkey" PRIMARY KEY ("user_id", "topic_ref", "subtopic_ref", "formula_index");



ALTER TABLE ONLY "public"."past_paper_questions"
    ADD CONSTRAINT "past_paper_questions_paper_sort" UNIQUE ("paper_id", "sort_order");



ALTER TABLE ONLY "public"."past_paper_questions"
    ADD CONSTRAINT "past_paper_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."past_papers"
    ADD CONSTRAINT "past_papers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."past_papers"
    ADD CONSTRAINT "past_papers_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."platform_feedback_submissions"
    ADD CONSTRAINT "platform_feedback_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."play_history"
    ADD CONSTRAINT "play_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."play_questions"
    ADD CONSTRAINT "play_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prep_calendar_day_activity"
    ADD CONSTRAINT "prep_calendar_day_activity_pkey" PRIMARY KEY ("user_id", "day");



ALTER TABLE ONLY "public"."profile_academics"
    ADD CONSTRAINT "profile_academics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_achievements"
    ADD CONSTRAINT "profile_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_community_share_rdm_claims"
    ADD CONSTRAINT "quiz_community_share_rdm_claims_pkey" PRIMARY KEY ("user_id", "topic_ref", "subtopic_ref", "quiz_set");



ALTER TABLE ONLY "public"."rdm_config"
    ADD CONSTRAINT "rdm_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."refer_challenge_claims"
    ADD CONSTRAINT "refer_challenge_claims_pkey" PRIMARY KEY ("user_id", "claim_date", "challenge_key");



ALTER TABLE ONLY "public"."referral_attributions"
    ADD CONSTRAINT "referral_attributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_attributions"
    ADD CONSTRAINT "referral_attributions_referee_user_id_key" UNIQUE ("referee_user_id");



ALTER TABLE ONLY "public"."referral_weekly_bonuses"
    ADD CONSTRAINT "referral_weekly_bonuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_weekly_bonuses"
    ADD CONSTRAINT "referral_weekly_bonuses_referrer_user_id_week_start_ist_key" UNIQUE ("referrer_user_id", "week_start_ist");



ALTER TABLE ONLY "public"."saved_questions"
    ADD CONSTRAINT "saved_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_questions"
    ADD CONSTRAINT "saved_questions_user_id_question_id_source_type_key" UNIQUE ("user_id", "question_id", "source_type");



ALTER TABLE ONLY "public"."student_events"
    ADD CONSTRAINT "student_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_gyan_presence"
    ADD CONSTRAINT "student_gyan_presence_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."student_learning_dwell_events"
    ADD CONSTRAINT "student_learning_dwell_events_pkey1" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2025_12"
    ADD CONSTRAINT "student_learning_dwell_2025_12_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_01"
    ADD CONSTRAINT "student_learning_dwell_2026_01_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_02"
    ADD CONSTRAINT "student_learning_dwell_2026_02_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_03"
    ADD CONSTRAINT "student_learning_dwell_2026_03_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_04"
    ADD CONSTRAINT "student_learning_dwell_2026_04_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_05"
    ADD CONSTRAINT "student_learning_dwell_2026_05_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_06"
    ADD CONSTRAINT "student_learning_dwell_2026_06_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_07"
    ADD CONSTRAINT "student_learning_dwell_2026_07_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_08"
    ADD CONSTRAINT "student_learning_dwell_2026_08_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_09"
    ADD CONSTRAINT "student_learning_dwell_2026_09_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_10"
    ADD CONSTRAINT "student_learning_dwell_2026_10_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_11"
    ADD CONSTRAINT "student_learning_dwell_2026_11_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2026_12"
    ADD CONSTRAINT "student_learning_dwell_2026_12_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2027_01"
    ADD CONSTRAINT "student_learning_dwell_2027_01_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2027_02"
    ADD CONSTRAINT "student_learning_dwell_2027_02_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2027_03"
    ADD CONSTRAINT "student_learning_dwell_2027_03_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2027_04"
    ADD CONSTRAINT "student_learning_dwell_2027_04_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2027_05"
    ADD CONSTRAINT "student_learning_dwell_2027_05_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_dwell_2027_06"
    ADD CONSTRAINT "student_learning_dwell_2027_06_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."student_learning_presence"
    ADD CONSTRAINT "student_learning_presence_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."student_lesson_mark_completions"
    ADD CONSTRAINT "student_lesson_mark_completions_pkey" PRIMARY KEY ("user_id", "board", "subject", "class_level", "topic", "subtopic", "level");



ALTER TABLE ONLY "public"."student_section_history"
    ADD CONSTRAINT "student_section_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_site_presence"
    ADD CONSTRAINT "student_site_presence_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."study_buddies"
    ADD CONSTRAINT "study_buddies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_buddies"
    ADD CONSTRAINT "study_buddies_user_id_buddy_user_id_key" UNIQUE ("user_id", "buddy_user_id");



ALTER TABLE ONLY "public"."study_streak_milestone_claims"
    ADD CONSTRAINT "study_streak_milestone_claims_pkey" PRIMARY KEY ("user_id", "streak_start_date", "milestone_days");



ALTER TABLE ONLY "public"."subject_topic_chat_messages"
    ADD CONSTRAINT "subject_topic_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_coupons"
    ADD CONSTRAINT "subscription_coupons_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."subscription_coupons"
    ADD CONSTRAINT "subscription_coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subtopic_content"
    ADD CONSTRAINT "subtopic_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subtopic_content"
    ADD CONSTRAINT "subtopic_content_unique_key" UNIQUE ("board", "subject", "class_level", "topic", "subtopic_name", "level");



ALTER TABLE ONLY "public"."teacher_generated_test_history"
    ADD CONSTRAINT "teacher_generated_test_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_google_calendar_tokens"
    ADD CONSTRAINT "teacher_google_calendar_tokens_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."teacher_motivation_rdm_grants"
    ADD CONSTRAINT "teacher_motivation_rdm_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_motivation_rdm_grants"
    ADD CONSTRAINT "teacher_motivation_rdm_grants_unique" UNIQUE ("motivation_post_id", "student_id");



ALTER TABLE ONLY "public"."teacher_profile_details"
    ADD CONSTRAINT "teacher_profile_details_pkey" PRIMARY KEY ("teacher_id");



ALTER TABLE ONLY "public"."topic_content"
    ADD CONSTRAINT "topic_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topic_content_runs"
    ADD CONSTRAINT "topic_content_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topic_content"
    ADD CONSTRAINT "topic_content_unique_key" UNIQUE ("board", "subject", "class_level", "topic", "level", "hub_scope");



ALTER TABLE ONLY "public"."topic_quiz_advanced_rdm_attempts"
    ADD CONSTRAINT "topic_quiz_advanced_rdm_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactional_email_logs"
    ADD CONSTRAINT "transactional_email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_memory_profile"
    ADD CONSTRAINT "user_memory_profile_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_play_stats"
    ADD CONSTRAINT "user_play_stats_pkey" PRIMARY KEY ("user_id", "category");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_saved_items"
    ADD CONSTRAINT "user_saved_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_saved_items"
    ADD CONSTRAINT "user_saved_items_user_id_item_type_content_id_key" UNIQUE ("user_id", "item_type", "content_id");



ALTER TABLE ONLY "public"."user_study_day_totals"
    ADD CONSTRAINT "user_study_day_totals_pkey" PRIMARY KEY ("user_id", "day");



ALTER TABLE ONLY "public"."waitlist_submissions"
    ADD CONSTRAINT "waitlist_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist_submissions"
    ADD CONSTRAINT "waitlist_submissions_waitlist_id_key" UNIQUE ("waitlist_id");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



CREATE INDEX "admin_audit_log_actor_idx" ON "public"."admin_audit_log" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "admin_audit_log_created_at_idx" ON "public"."admin_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "admin_audit_log_target_idx" ON "public"."admin_audit_log" USING "btree" ("target_user_id", "created_at" DESC);



CREATE INDEX "ai_token_logs_created_at_idx" ON "public"."ai_token_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "ai_token_logs_user_id_idx" ON "public"."ai_token_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "approved_emails_email_idx" ON "public"."approved_emails" USING "btree" ("email");



CREATE INDEX "buddy_invites_inviter_status_idx" ON "public"."buddy_invites" USING "btree" ("inviter_user_id", "status");



CREATE INDEX "buddy_invites_token_idx" ON "public"."buddy_invites" USING "btree" ("token");



CREATE INDEX "classroom_members_section_id_idx" ON "public"."classroom_members" USING "btree" ("section_id");



CREATE INDEX "classroom_sections_classroom_id_idx" ON "public"."classroom_sections" USING "btree" ("classroom_id");



CREATE INDEX "curriculum_units_sort_order_idx" ON "public"."curriculum_units" USING "btree" ("sort_order");



CREATE INDEX "doubt_answers_created_at_idx1" ON "public"."doubt_answers" USING "btree" ("created_at");



CREATE INDEX "doubt_saves_created_at_idx" ON "public"."doubt_saves" USING "btree" ("created_at");



CREATE INDEX "idx_accepted_answer_payouts_user_paid_at" ON "public"."accepted_answer_payouts" USING "btree" ("user_id", "paid_at");



CREATE INDEX "idx_admin_user_actions_actor_created" ON "public"."admin_user_actions" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "idx_admin_user_actions_target_created" ON "public"."admin_user_actions" USING "btree" ("target_user_id", "created_at" DESC);



CREATE INDEX "idx_car_post_id" ON "public"."classroom_assignment_responses" USING "btree" ("post_id");



CREATE INDEX "idx_car_user_post" ON "public"."classroom_assignment_responses" USING "btree" ("post_id", "user_id");



CREATE INDEX "idx_catp_post_id" ON "public"."classroom_assignment_task_progress" USING "btree" ("post_id");



CREATE INDEX "idx_catp_user_post" ON "public"."classroom_assignment_task_progress" USING "btree" ("post_id", "user_id");



CREATE INDEX "idx_cbse_mcq_chapters_list" ON "public"."cbse_mcq_chapters" USING "btree" ("board", "class_level", "subject", "sort_order");



CREATE INDEX "idx_cbse_mcq_comm_share_user_created" ON "public"."cbse_mcq_community_share_rdm_claims" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_cbse_mcq_score_bonus_user_created" ON "public"."cbse_mcq_score_bonus_claims" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_cgta_classroom_id" ON "public"."classroom_generated_test_attempts" USING "btree" ("classroom_id");



CREATE INDEX "idx_cgta_post_id" ON "public"."classroom_generated_test_attempts" USING "btree" ("post_id");



CREATE INDEX "idx_cgta_user_id" ON "public"."classroom_generated_test_attempts" USING "btree" ("user_id");



CREATE INDEX "idx_class_exploration_sessions_classroom_id" ON "public"."class_exploration_sessions" USING "btree" ("classroom_id");



CREATE INDEX "idx_class_exploration_sessions_user_id" ON "public"."class_exploration_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_classroom_assignment_responses_classroom_id" ON "public"."classroom_assignment_responses" USING "btree" ("classroom_id");



CREATE INDEX "idx_classroom_join_requests_classroom_id" ON "public"."classroom_join_requests" USING "btree" ("classroom_id");



CREATE INDEX "idx_classroom_join_requests_status" ON "public"."classroom_join_requests" USING "btree" ("classroom_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_classroom_join_requests_user_id" ON "public"."classroom_join_requests" USING "btree" ("user_id");



CREATE INDEX "idx_classrooms_teacher_id" ON "public"."classrooms" USING "btree" ("teacher_id");



CREATE INDEX "idx_curriculum_chapters_unit" ON "public"."curriculum_chapters" USING "btree" ("unit_id");



CREATE INDEX "idx_curriculum_subtopics_topic" ON "public"."curriculum_subtopics" USING "btree" ("topic_id");



CREATE INDEX "idx_curriculum_topics_chapter" ON "public"."curriculum_topics" USING "btree" ("chapter_id");



CREATE INDEX "idx_curriculum_units_subject_class" ON "public"."curriculum_units" USING "btree" ("subject", "class_level");



CREATE INDEX "idx_daily_gauntlet_date_time" ON "public"."daily_gauntlet_attempts" USING "btree" ("gauntlet_date", "total_time_ms");



CREATE INDEX "idx_daily_reward_claims_user_ist_date" ON "public"."daily_reward_claims" USING "btree" ("user_id", "claim_date_ist");



CREATE INDEX "idx_doubt_answer_reports_answer_id" ON "public"."doubt_answer_reports" USING "btree" ("answer_id");



CREATE INDEX "idx_doubt_answers_doubt_id" ON "public"."doubt_answers" USING "btree" ("doubt_id");



CREATE INDEX "idx_doubt_answers_hidden" ON "public"."doubt_answers" USING "btree" ("hidden") WHERE ("hidden" = false);



CREATE INDEX "idx_doubt_answers_user_id" ON "public"."doubt_answers" USING "btree" ("user_id");



CREATE INDEX "idx_doubt_saves_user_id" ON "public"."doubt_saves" USING "btree" ("user_id");



CREATE INDEX "idx_doubts_bot_curriculum_dedupe" ON "public"."doubts" USING "btree" ("gyan_curriculum_node_id", "user_id");



CREATE INDEX "idx_doubts_bounty_resolved" ON "public"."doubts" USING "btree" ("bounty_rdm" DESC, "is_resolved") WHERE ("is_resolved" = false);



CREATE INDEX "idx_doubts_created_at" ON "public"."doubts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_doubts_gyan_curriculum_node_id" ON "public"."doubts" USING "btree" ("gyan_curriculum_node_id") WHERE ("gyan_curriculum_node_id" IS NOT NULL);



CREATE INDEX "idx_doubts_is_resolved" ON "public"."doubts" USING "btree" ("is_resolved");



CREATE INDEX "idx_doubts_subject" ON "public"."doubts" USING "btree" ("subject");



CREATE INDEX "idx_doubts_user_id" ON "public"."doubts" USING "btree" ("user_id");



CREATE INDEX "idx_episodic_memory_embedding" ON "public"."episodic_memory" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_episodic_memory_user_context" ON "public"."episodic_memory" USING "btree" ("user_id", "context_key", "created_at" DESC);



CREATE INDEX "idx_episodic_memory_user_id" ON "public"."episodic_memory" USING "btree" ("user_id");



CREATE INDEX "idx_explorer_live_joins_session_id" ON "public"."explorer_live_joins" USING "btree" ("session_id");



CREATE INDEX "idx_explorer_live_joins_user_id" ON "public"."explorer_live_joins" USING "btree" ("user_id");



CREATE INDEX "idx_gyan_curriculum_nodes_subject_sort" ON "public"."gyan_curriculum_nodes" USING "btree" ("subject", "sort_order");



CREATE INDEX "idx_lessons_raw_post_boosts_post" ON "public"."lessons_raw_post_boosts" USING "btree" ("post_id");



CREATE INDEX "idx_lessons_raw_post_boosts_user" ON "public"."lessons_raw_post_boosts" USING "btree" ("user_id");



CREATE INDEX "idx_lessons_raw_post_comments_parent" ON "public"."lessons_raw_post_comments" USING "btree" ("parent_id") WHERE ("parent_id" IS NOT NULL);



CREATE INDEX "idx_lessons_raw_post_comments_post_created" ON "public"."lessons_raw_post_comments" USING "btree" ("post_id", "created_at");



CREATE INDEX "idx_lessons_raw_post_votes_user" ON "public"."lessons_raw_post_votes" USING "btree" ("user_id");



CREATE INDEX "idx_lessons_raw_posts_created_at" ON "public"."lessons_raw_posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_lessons_raw_posts_source_type" ON "public"."lessons_raw_posts" USING "btree" ("source_type");



CREATE INDEX "idx_lessons_raw_posts_tags_gin" ON "public"."lessons_raw_posts" USING "gin" ("tags");



CREATE INDEX "idx_lessons_raw_posts_user_created" ON "public"."lessons_raw_posts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_live_session_joins_session_id" ON "public"."live_session_joins" USING "btree" ("session_id");



CREATE INDEX "idx_live_session_joins_user_id" ON "public"."live_session_joins" USING "btree" ("user_id");



CREATE INDEX "idx_live_sessions_classroom_id" ON "public"."live_sessions" USING "btree" ("classroom_id");



CREATE INDEX "idx_live_sessions_teacher_id" ON "public"."live_sessions" USING "btree" ("teacher_id");



CREATE INDEX "idx_magic_wall_basket_subject_class" ON "public"."magic_wall_basket_items" USING "btree" ("subject", "class_level");



CREATE INDEX "idx_magic_wall_basket_user_created" ON "public"."magic_wall_basket_items" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_magic_wall_topic_attempts_user_time" ON "public"."magic_wall_topic_attempts" USING "btree" ("user_id", "attempted_at" DESC);



CREATE INDEX "idx_magic_wall_topic_attempts_user_topic" ON "public"."magic_wall_topic_attempts" USING "btree" ("user_id", "topic_key");



CREATE INDEX "idx_mock_comm_share_user_created" ON "public"."mock_community_share_rdm_claims" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_mock_papers_cbse11_chapter_id" ON "public"."mock_papers" USING "btree" ("chapter_id") WHERE (("paper_type" = 'chapter'::"text") AND ("board" = 'CBSE'::"text") AND ("class_level" = 11) AND ("chapter_id" IS NOT NULL));



CREATE INDEX "idx_mock_papers_cbse11_chapter_list" ON "public"."mock_papers" USING "btree" ("board", "class_level", "paper_type", "published") WHERE (("board" = 'CBSE'::"text") AND ("class_level" = 11) AND ("paper_type" = 'chapter'::"text"));



CREATE UNIQUE INDEX "idx_mock_papers_cbse12_chapter_id" ON "public"."mock_papers" USING "btree" ("chapter_id") WHERE (("paper_type" = 'chapter'::"text") AND ("board" = 'CBSE'::"text") AND ("class_level" = 12) AND ("chapter_id" IS NOT NULL));



CREATE INDEX "idx_mock_papers_cbse12_chapter_list" ON "public"."mock_papers" USING "btree" ("board", "class_level", "paper_type", "published") WHERE (("board" = 'CBSE'::"text") AND ("class_level" = 12) AND ("paper_type" = 'chapter'::"text"));



CREATE INDEX "idx_mock_papers_class_published" ON "public"."mock_papers" USING "btree" ("class_level", "published") WHERE ("published" = true);



CREATE INDEX "idx_mock_papers_published" ON "public"."mock_papers" USING "btree" ("published") WHERE ("published" = true);



CREATE INDEX "idx_mock_questions_paper_sort" ON "public"."mock_questions" USING "btree" ("paper_id", "sort_order");



CREATE INDEX "idx_mock_questions_subject" ON "public"."mock_questions" USING "btree" ("subject");



CREATE INDEX "idx_mock_rdm_bonus_attempts_user_created" ON "public"."mock_rdm_bonus_attempts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_mock_rdm_bonus_claims_user_created" ON "public"."mock_rdm_bonus_claims" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_mock_test_attempts_user_catalog" ON "public"."mock_test_attempts" USING "btree" ("user_id", "catalog_paper_id", "created_at" DESC) WHERE ("catalog_paper_id" IS NOT NULL);



CREATE INDEX "idx_mock_test_attempts_user_created" ON "public"."mock_test_attempts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_mock_test_attempts_user_past" ON "public"."mock_test_attempts" USING "btree" ("user_id", "past_paper_id", "created_at" DESC) WHERE ("past_paper_id" IS NOT NULL);



CREATE INDEX "idx_news_blog_posts_exam" ON "public"."news_blog_posts" USING "btree" ("exam");



CREATE INDEX "idx_news_blog_posts_portal_section" ON "public"."news_blog_posts" USING "btree" ("portal", "section");



CREATE INDEX "idx_news_blog_posts_publish_date" ON "public"."news_blog_posts" USING "btree" ("publish_date" DESC);



CREATE INDEX "idx_news_blog_posts_tags" ON "public"."news_blog_posts" USING "gin" ("to_tsvector"('"simple"'::"regconfig", "tags")) WHERE ("tags" <> ''::"text");



CREATE INDEX "idx_past_papers_published" ON "public"."past_papers" USING "btree" ("published") WHERE ("published" = true);



CREATE INDEX "idx_play_history_user_created" ON "public"."play_history" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_play_history_user_question" ON "public"."play_history" USING "btree" ("user_id", "question_id");



CREATE INDEX "idx_play_history_user_question_correct" ON "public"."play_history" USING "btree" ("user_id", "question_id") WHERE ("is_correct" = true);



CREATE INDEX "idx_play_questions_domain_category" ON "public"."play_questions" USING "btree" ("domain", "category");



CREATE INDEX "idx_play_questions_domain_category_rating" ON "public"."play_questions" USING "btree" ("domain", "category", "difficulty_rating");



CREATE INDEX "idx_posts_teacher_id" ON "public"."posts" USING "btree" ("teacher_id");



CREATE INDEX "idx_profile_academics_user_id" ON "public"."profile_academics" USING "btree" ("user_id");



CREATE INDEX "idx_profile_achievements_user_id" ON "public"."profile_achievements" USING "btree" ("user_id");



CREATE INDEX "idx_saved_questions_user_created" ON "public"."saved_questions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_saved_questions_user_id" ON "public"."saved_questions" USING "btree" ("user_id");



CREATE INDEX "idx_student_events_name_created" ON "public"."student_events" USING "btree" ("event_name", "created_at" DESC);



CREATE INDEX "idx_student_events_session" ON "public"."student_events" USING "btree" ("session_id", "created_at" DESC) WHERE ("session_id" IS NOT NULL);



CREATE INDEX "idx_student_events_user_id_created" ON "public"."student_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_student_gyan_presence_updated" ON "public"."student_gyan_presence" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_student_learning_dwell_user_occurred" ON ONLY "public"."student_learning_dwell_events" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "idx_student_learning_dwell_user_scope" ON ONLY "public"."student_learning_dwell_events" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "idx_student_learning_presence_updated" ON "public"."student_learning_presence" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_student_site_presence_updated" ON "public"."student_site_presence" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_subject_topic_chat_messages_thread" ON "public"."subject_topic_chat_messages" USING "btree" ("user_id", "context_key", "created_at" DESC);



CREATE INDEX "idx_teacher_profile_details_teacher_id" ON "public"."teacher_profile_details" USING "btree" ("teacher_id");



CREATE INDEX "idx_teacher_test_history_generated_at" ON "public"."teacher_generated_test_history" USING "btree" ("generated_at" DESC);



CREATE INDEX "idx_teacher_test_history_teacher" ON "public"."teacher_generated_test_history" USING "btree" ("teacher_id");



CREATE INDEX "idx_teacher_test_history_topic" ON "public"."teacher_generated_test_history" USING "btree" ("teacher_id", "subject", "topic_title");



CREATE INDEX "idx_topic_quiz_adv_rdm_attempts_user_created" ON "public"."topic_quiz_advanced_rdm_attempts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_transactional_email_logs_created_at" ON "public"."transactional_email_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_transactional_email_logs_ist_date" ON "public"."transactional_email_logs" USING "btree" ("ist_date" DESC);



CREATE INDEX "idx_user_memory_profile_jsonb" ON "public"."user_memory_profile" USING "gin" ("canonical_profile");



CREATE INDEX "idx_user_play_stats_user_id" ON "public"."user_play_stats" USING "btree" ("user_id");



CREATE INDEX "idx_user_saved_items_user_saved_at" ON "public"."user_saved_items" USING "btree" ("user_id", "item_type", "saved_at" DESC) WHERE ("saved_at" IS NOT NULL);



CREATE INDEX "idx_user_saved_items_user_type" ON "public"."user_saved_items" USING "btree" ("user_id", "item_type", "created_at" DESC);



CREATE INDEX "idx_user_saved_items_user_type_status" ON "public"."user_saved_items" USING "btree" ("user_id", "item_type", "status") WHERE ("item_type" = 'saved_revision_card'::"text");



CREATE INDEX "live_sessions_post_assignment_post_id_idx" ON "public"."live_sessions" USING "btree" ("post_assignment_post_id") WHERE ("post_assignment_post_id" IS NOT NULL);



CREATE INDEX "live_sessions_pre_assignment_post_id_idx" ON "public"."live_sessions" USING "btree" ("pre_assignment_post_id") WHERE ("pre_assignment_post_id" IS NOT NULL);



CREATE INDEX "live_sessions_section_id_idx" ON "public"."live_sessions" USING "btree" ("section_id");



CREATE INDEX "numerals_community_share_rdm_claims_user_claimed_idx" ON "public"."numerals_community_share_rdm_claims" USING "btree" ("user_id", "claimed_at" DESC);



CREATE INDEX "platform_feedback_submissions_admin_status_idx" ON "public"."platform_feedback_submissions" USING "btree" ("admin_status", "created_at" DESC);



CREATE INDEX "platform_feedback_submissions_created_at_idx" ON "public"."platform_feedback_submissions" USING "btree" ("created_at" DESC);



CREATE INDEX "platform_feedback_submissions_has_issue_idx" ON "public"."platform_feedback_submissions" USING "btree" ("created_at" DESC) WHERE (("issue_category" IS NOT NULL) OR ("length"(TRIM(BOTH FROM "issue_text")) > 0));



CREATE INDEX "platform_feedback_submissions_user_id_idx" ON "public"."platform_feedback_submissions" USING "btree" ("user_id");



CREATE INDEX "posts_classroom_id_section_id_idx" ON "public"."posts" USING "btree" ("classroom_id", "section_id");



CREATE INDEX "posts_created_at_idx" ON "public"."posts" USING "btree" ("created_at");



CREATE INDEX "posts_section_id_idx" ON "public"."posts" USING "btree" ("section_id");



CREATE INDEX "prep_calendar_day_activity_user_day_idx" ON "public"."prep_calendar_day_activity" USING "btree" ("user_id", "day" DESC);



CREATE INDEX "quiz_community_share_rdm_claims_user_claimed_idx" ON "public"."quiz_community_share_rdm_claims" USING "btree" ("user_id", "claimed_at" DESC);



CREATE INDEX "referral_attributions_credited_at_idx" ON "public"."referral_attributions" USING "btree" ("credited_at");



CREATE INDEX "referral_attributions_referrer_idx" ON "public"."referral_attributions" USING "btree" ("referrer_user_id");



CREATE INDEX "referral_attributions_week_idx" ON "public"."referral_attributions" USING "btree" ("referrer_user_id", "credited_week_start_ist");



CREATE INDEX "referral_weekly_bonuses_referrer_idx" ON "public"."referral_weekly_bonuses" USING "btree" ("referrer_user_id");



CREATE INDEX "student_learning_dwell_2025_12_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2025_12" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2025_1_user_id_board_subject_class__idx2" ON "public"."student_learning_dwell_2025_12" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_01_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_01" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_02_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_02" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_03_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_03" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_04_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_04" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_05_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_05" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_06_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_06" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_07_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_07" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_08_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_08" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_09_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_09" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_0_user_id_board_subject_class__idx1" ON "public"."student_learning_dwell_2026_02" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_0_user_id_board_subject_class__idx2" ON "public"."student_learning_dwell_2026_03" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_0_user_id_board_subject_class__idx3" ON "public"."student_learning_dwell_2026_04" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_0_user_id_board_subject_class__idx4" ON "public"."student_learning_dwell_2026_05" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_0_user_id_board_subject_class__idx5" ON "public"."student_learning_dwell_2026_06" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_0_user_id_board_subject_class__idx6" ON "public"."student_learning_dwell_2026_07" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_0_user_id_board_subject_class__idx7" ON "public"."student_learning_dwell_2026_08" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_0_user_id_board_subject_class__idx8" ON "public"."student_learning_dwell_2026_09" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_0_user_id_board_subject_class_l_idx" ON "public"."student_learning_dwell_2026_01" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_10_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_10" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_11_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_11" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_12_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2026_12" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2026_1_user_id_board_subject_class__idx1" ON "public"."student_learning_dwell_2026_11" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_1_user_id_board_subject_class__idx2" ON "public"."student_learning_dwell_2026_12" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2026_1_user_id_board_subject_class_l_idx" ON "public"."student_learning_dwell_2026_10" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2027_01_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2027_01" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2027_02_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2027_02" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2027_03_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2027_03" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2027_04_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2027_04" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2027_05_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2027_05" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2027_06_user_id_occurred_at_idx" ON "public"."student_learning_dwell_2027_06" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "student_learning_dwell_2027_0_user_id_board_subject_class__idx1" ON "public"."student_learning_dwell_2027_02" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2027_0_user_id_board_subject_class__idx2" ON "public"."student_learning_dwell_2027_03" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2027_0_user_id_board_subject_class__idx3" ON "public"."student_learning_dwell_2027_04" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2027_0_user_id_board_subject_class__idx4" ON "public"."student_learning_dwell_2027_05" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2027_0_user_id_board_subject_class__idx5" ON "public"."student_learning_dwell_2027_06" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_learning_dwell_2027_0_user_id_board_subject_class_l_idx" ON "public"."student_learning_dwell_2027_01" USING "btree" ("user_id", "board", "subject", "class_level", "topic", "subtopic_name", "level");



CREATE INDEX "student_lesson_mark_completions_user_board_subject_class_idx" ON "public"."student_lesson_mark_completions" USING "btree" ("user_id", "board", "subject", "class_level");



CREATE INDEX "student_lesson_mark_completions_user_subject_class_idx" ON "public"."student_lesson_mark_completions" USING "btree" ("user_id", "subject", "class_level");



CREATE INDEX "student_section_history_classroom_section_idx" ON "public"."student_section_history" USING "btree" ("classroom_id", "section_id", "joined_at");



CREATE INDEX "student_section_history_classroom_user_idx" ON "public"."student_section_history" USING "btree" ("classroom_id", "user_id", "joined_at");



CREATE UNIQUE INDEX "student_section_history_one_open_interval" ON "public"."student_section_history" USING "btree" ("classroom_id", "user_id") WHERE ("left_at" IS NULL);



CREATE INDEX "study_buddies_user_idx" ON "public"."study_buddies" USING "btree" ("user_id", "status");



CREATE INDEX "teacher_motivation_rdm_grants_student_assignment_pending_idx" ON "public"."teacher_motivation_rdm_grants" USING "btree" ("student_id", "assignment_post_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "topic_content_runs_lookup_idx" ON "public"."topic_content_runs" USING "btree" ("board", "subject", "class_level", "topic", "level", "hub_scope", "created_at" DESC);



CREATE INDEX "user_roles_user_id_idx" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "user_study_day_totals_user_day_desc_idx" ON "public"."user_study_day_totals" USING "btree" ("user_id", "day" DESC);



CREATE INDEX "waitlist_submissions_admin_status_idx" ON "public"."waitlist_submissions" USING "btree" ("admin_status", "created_at" DESC);



CREATE INDEX "waitlist_submissions_created_at_idx" ON "public"."waitlist_submissions" USING "btree" ("created_at" DESC);



CREATE INDEX "waitlist_submissions_email_idx" ON "public"."waitlist_submissions" USING "btree" ("lower"("email"));



CREATE INDEX "waitlist_submissions_role_idx" ON "public"."waitlist_submissions" USING "btree" ("role");



CREATE INDEX "waitlist_submissions_signup_tier_idx" ON "public"."waitlist_submissions" USING "btree" ("signup_tier", "created_at" DESC);



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_bucket_id_name_lower" ON "storage"."objects" USING "btree" ("bucket_id", "lower"("name") COLLATE "C");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2025_12_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2025_12_user_id_occurred_at_idx";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2025_1_user_id_board_subject_class__idx2";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_01_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_01_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_02_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_02_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_03_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_03_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_04_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_04_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_05_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_05_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_06_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_06_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_07_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_07_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_08_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_08_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_09_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_09_user_id_occurred_at_idx";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_0_user_id_board_subject_class__idx1";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_0_user_id_board_subject_class__idx2";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_0_user_id_board_subject_class__idx3";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_0_user_id_board_subject_class__idx4";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_0_user_id_board_subject_class__idx5";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_0_user_id_board_subject_class__idx6";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_0_user_id_board_subject_class__idx7";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_0_user_id_board_subject_class__idx8";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_0_user_id_board_subject_class_l_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_10_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_10_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_11_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_11_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2026_12_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2026_12_user_id_occurred_at_idx";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_1_user_id_board_subject_class__idx1";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_1_user_id_board_subject_class__idx2";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2026_1_user_id_board_subject_class_l_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2027_01_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2027_01_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2027_02_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2027_02_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2027_03_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2027_03_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2027_04_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2027_04_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2027_05_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2027_05_user_id_occurred_at_idx";



ALTER INDEX "public"."student_learning_dwell_events_pkey1" ATTACH PARTITION "public"."student_learning_dwell_2027_06_pkey";



ALTER INDEX "public"."idx_student_learning_dwell_user_occurred" ATTACH PARTITION "public"."student_learning_dwell_2027_06_user_id_occurred_at_idx";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2027_0_user_id_board_subject_class__idx1";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2027_0_user_id_board_subject_class__idx2";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2027_0_user_id_board_subject_class__idx3";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2027_0_user_id_board_subject_class__idx4";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2027_0_user_id_board_subject_class__idx5";



ALTER INDEX "public"."idx_student_learning_dwell_user_scope" ATTACH PARTITION "public"."student_learning_dwell_2027_0_user_id_board_subject_class_l_idx";



CREATE OR REPLACE TRIGGER "profiles_enforce_rdm_integrity_trigger" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_enforce_rdm_integrity"();



CREATE OR REPLACE TRIGGER "trg_car_updated_at" BEFORE UPDATE ON "public"."classroom_assignment_responses" FOR EACH ROW EXECUTE FUNCTION "public"."set_classroom_assignment_responses_updated_at"();



CREATE OR REPLACE TRIGGER "trg_enforce_classroom_sections_limit" BEFORE INSERT ON "public"."classroom_sections" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_classroom_sections_limit"();



CREATE OR REPLACE TRIGGER "trg_gyan_bot_config_updated_at" BEFORE UPDATE ON "public"."gyan_bot_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_gyan_bot_config_updated_at"();



CREATE OR REPLACE TRIGGER "trg_lessons_raw_comments_count_del" AFTER DELETE ON "public"."lessons_raw_post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."bump_lessons_raw_post_comment_count"();



CREATE OR REPLACE TRIGGER "trg_lessons_raw_comments_count_ins" AFTER INSERT ON "public"."lessons_raw_post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."bump_lessons_raw_post_comment_count"();



CREATE OR REPLACE TRIGGER "trg_lessons_raw_posts_updated_at" BEFORE UPDATE ON "public"."lessons_raw_posts" FOR EACH ROW EXECUTE FUNCTION "public"."set_lessons_raw_posts_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_duplicate_subtopic_names" BEFORE INSERT OR UPDATE ON "public"."curriculum_subtopics" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_duplicate_subtopic_names"();



CREATE OR REPLACE TRIGGER "trg_profile_academics_enforce_verified" BEFORE INSERT OR UPDATE ON "public"."profile_academics" FOR EACH ROW EXECUTE FUNCTION "public"."profile_academics_enforce_verified"();



CREATE OR REPLACE TRIGGER "trg_profile_achievements_enforce_verified" BEFORE INSERT OR UPDATE ON "public"."profile_achievements" FOR EACH ROW EXECUTE FUNCTION "public"."profile_achievements_enforce_verified"();



CREATE OR REPLACE TRIGGER "trg_rdm_config_updated_at" BEFORE UPDATE ON "public"."rdm_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_rdm_config_updated_at"();



CREATE OR REPLACE TRIGGER "trg_student_section_history_del" AFTER DELETE ON "public"."classroom_members" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_student_section_history"();



CREATE OR REPLACE TRIGGER "trg_student_section_history_ins" AFTER INSERT ON "public"."classroom_members" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_student_section_history"();



CREATE OR REPLACE TRIGGER "trg_student_section_history_upd" AFTER UPDATE OF "section_id", "role" ON "public"."classroom_members" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_student_section_history"();



CREATE OR REPLACE TRIGGER "trg_teacher_profile_details_updated_at" BEFORE UPDATE ON "public"."teacher_profile_details" FOR EACH ROW EXECUTE FUNCTION "public"."set_teacher_profile_details_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_refer_challenge_claims_updated_at" BEFORE UPDATE ON "public"."refer_challenge_claims" FOR EACH ROW EXECUTE FUNCTION "public"."touch_refer_challenge_claims_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_doubt_answer_daily_rdm" AFTER INSERT ON "public"."doubt_answers" FOR EACH ROW EXECUTE FUNCTION "public"."doubt_answer_daily_rdm_trigger"();



CREATE OR REPLACE TRIGGER "trigger_doubt_report_penalty" AFTER INSERT ON "public"."doubt_answer_reports" FOR EACH ROW EXECUTE FUNCTION "public"."doubt_report_penalty_trigger"();



CREATE OR REPLACE TRIGGER "trigger_doubt_save_daily_rdm" AFTER INSERT ON "public"."doubt_saves" FOR EACH ROW EXECUTE FUNCTION "public"."doubt_save_daily_rdm_trigger"();



CREATE OR REPLACE TRIGGER "trigger_news_blog_posts_updated_at" BEFORE UPDATE ON "public"."news_blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."news_blog_posts_set_updated_at"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "protect_buckets_delete" BEFORE DELETE ON "storage"."buckets" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "protect_objects_delete" BEFORE DELETE ON "storage"."objects" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "public"."accepted_answer_payouts"
    ADD CONSTRAINT "accepted_answer_payouts_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "public"."doubt_answers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accepted_answer_payouts"
    ADD CONSTRAINT "accepted_answer_payouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_user_actions"
    ADD CONSTRAINT "admin_user_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_user_actions"
    ADD CONSTRAINT "admin_user_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_token_logs"
    ADD CONSTRAINT "ai_token_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approved_emails"
    ADD CONSTRAINT "approved_emails_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approved_emails"
    ADD CONSTRAINT "approved_emails_waitlist_submission_id_fkey" FOREIGN KEY ("waitlist_submission_id") REFERENCES "public"."waitlist_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buddy_invites"
    ADD CONSTRAINT "buddy_invites_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."buddy_invites"
    ADD CONSTRAINT "buddy_invites_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cbse_mcq_community_share_rdm_claims"
    ADD CONSTRAINT "cbse_mcq_community_share_rdm_claims_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."lessons_raw_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cbse_mcq_community_share_rdm_claims"
    ADD CONSTRAINT "cbse_mcq_community_share_rdm_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cbse_mcq_score_bonus_claims"
    ADD CONSTRAINT "cbse_mcq_score_bonus_claims_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."mock_papers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cbse_mcq_score_bonus_claims"
    ADD CONSTRAINT "cbse_mcq_score_bonus_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_exploration_sessions"
    ADD CONSTRAINT "class_exploration_sessions_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_exploration_sessions"
    ADD CONSTRAINT "class_exploration_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_assignment_responses"
    ADD CONSTRAINT "classroom_assignment_responses_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_assignment_responses"
    ADD CONSTRAINT "classroom_assignment_responses_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_assignment_responses"
    ADD CONSTRAINT "classroom_assignment_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_assignment_task_progress"
    ADD CONSTRAINT "classroom_assignment_task_progress_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_assignment_task_progress"
    ADD CONSTRAINT "classroom_assignment_task_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_generated_test_attempts"
    ADD CONSTRAINT "classroom_generated_test_attempts_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_generated_test_attempts"
    ADD CONSTRAINT "classroom_generated_test_attempts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_generated_test_attempts"
    ADD CONSTRAINT "classroom_generated_test_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_join_requests"
    ADD CONSTRAINT "classroom_join_requests_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_join_requests"
    ADD CONSTRAINT "classroom_join_requests_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classroom_join_requests"
    ADD CONSTRAINT "classroom_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_members"
    ADD CONSTRAINT "classroom_members_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_members"
    ADD CONSTRAINT "classroom_members_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."classroom_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classroom_members"
    ADD CONSTRAINT "classroom_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_reviews"
    ADD CONSTRAINT "classroom_reviews_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_reviews"
    ADD CONSTRAINT "classroom_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_sections"
    ADD CONSTRAINT "classroom_sections_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classrooms"
    ADD CONSTRAINT "classrooms_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_bought_by_teacher_id_fkey" FOREIGN KEY ("bought_by_teacher_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_redeemed_by_teacher_id_fkey" FOREIGN KEY ("redeemed_by_teacher_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."curriculum_chapters"
    ADD CONSTRAINT "curriculum_chapters_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."curriculum_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."curriculum_subtopics"
    ADD CONSTRAINT "curriculum_subtopics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."curriculum_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."curriculum_topics"
    ADD CONSTRAINT "curriculum_topics_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."curriculum_chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_gauntlet_attempts"
    ADD CONSTRAINT "daily_gauntlet_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_reward_claims"
    ADD CONSTRAINT "daily_reward_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doubt_answer_reports"
    ADD CONSTRAINT "doubt_answer_reports_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "public"."doubt_answers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doubt_answer_reports"
    ADD CONSTRAINT "doubt_answer_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doubt_answers"
    ADD CONSTRAINT "doubt_answers_doubt_id_fkey" FOREIGN KEY ("doubt_id") REFERENCES "public"."doubts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doubt_answers"
    ADD CONSTRAINT "doubt_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doubt_saves"
    ADD CONSTRAINT "doubt_saves_doubt_id_fkey" FOREIGN KEY ("doubt_id") REFERENCES "public"."doubts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doubt_saves"
    ADD CONSTRAINT "doubt_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doubt_votes"
    ADD CONSTRAINT "doubt_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doubts"
    ADD CONSTRAINT "doubts_gyan_curriculum_node_id_fkey" FOREIGN KEY ("gyan_curriculum_node_id") REFERENCES "public"."gyan_curriculum_nodes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."doubts"
    ADD CONSTRAINT "doubts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."episodic_memory"
    ADD CONSTRAINT "episodic_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."explorer_live_joins"
    ADD CONSTRAINT "explorer_live_joins_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."explorer_live_joins"
    ADD CONSTRAINT "explorer_live_joins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inactive_day_penalties"
    ADD CONSTRAINT "inactive_day_penalties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons_raw_post_boosts"
    ADD CONSTRAINT "lessons_raw_post_boosts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."lessons_raw_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons_raw_post_boosts"
    ADD CONSTRAINT "lessons_raw_post_boosts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons_raw_post_comments"
    ADD CONSTRAINT "lessons_raw_post_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."lessons_raw_post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons_raw_post_comments"
    ADD CONSTRAINT "lessons_raw_post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."lessons_raw_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons_raw_post_comments"
    ADD CONSTRAINT "lessons_raw_post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons_raw_post_votes"
    ADD CONSTRAINT "lessons_raw_post_votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."lessons_raw_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons_raw_post_votes"
    ADD CONSTRAINT "lessons_raw_post_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons_raw_posts"
    ADD CONSTRAINT "lessons_raw_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_session_joins"
    ADD CONSTRAINT "live_session_joins_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_session_joins"
    ADD CONSTRAINT "live_session_joins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_post_assignment_post_id_fkey" FOREIGN KEY ("post_assignment_post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_pre_assignment_post_id_fkey" FOREIGN KEY ("pre_assignment_post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_recap_post_id_fkey" FOREIGN KEY ("recap_post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."classroom_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."magic_wall_basket_items"
    ADD CONSTRAINT "magic_wall_basket_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."magic_wall_topic_attempts"
    ADD CONSTRAINT "magic_wall_topic_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mock_community_share_rdm_claims"
    ADD CONSTRAINT "mock_community_share_rdm_claims_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."lessons_raw_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mock_community_share_rdm_claims"
    ADD CONSTRAINT "mock_community_share_rdm_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mock_papers"
    ADD CONSTRAINT "mock_papers_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."cbse_mcq_chapters"("chapter_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mock_questions"
    ADD CONSTRAINT "mock_questions_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."mock_papers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mock_rdm_bonus_attempts"
    ADD CONSTRAINT "mock_rdm_bonus_attempts_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."mock_papers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mock_rdm_bonus_attempts"
    ADD CONSTRAINT "mock_rdm_bonus_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mock_rdm_bonus_claims"
    ADD CONSTRAINT "mock_rdm_bonus_claims_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."mock_papers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mock_rdm_bonus_claims"
    ADD CONSTRAINT "mock_rdm_bonus_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mock_test_attempts"
    ADD CONSTRAINT "mock_test_attempts_catalog_paper_id_fkey" FOREIGN KEY ("catalog_paper_id") REFERENCES "public"."mock_papers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mock_test_attempts"
    ADD CONSTRAINT "mock_test_attempts_past_paper_id_fkey" FOREIGN KEY ("past_paper_id") REFERENCES "public"."past_papers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mock_test_attempts"
    ADD CONSTRAINT "mock_test_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."numerals_community_share_rdm_claims"
    ADD CONSTRAINT "numerals_community_share_rdm_claims_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."lessons_raw_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."numerals_community_share_rdm_claims"
    ADD CONSTRAINT "numerals_community_share_rdm_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."past_paper_questions"
    ADD CONSTRAINT "past_paper_questions_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."past_papers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_feedback_submissions"
    ADD CONSTRAINT "platform_feedback_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_feedback_submissions"
    ADD CONSTRAINT "platform_feedback_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."play_history"
    ADD CONSTRAINT "play_history_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."play_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."play_history"
    ADD CONSTRAINT "play_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."classroom_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prep_calendar_day_activity"
    ADD CONSTRAINT "prep_calendar_day_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_academics"
    ADD CONSTRAINT "profile_academics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_achievements"
    ADD CONSTRAINT "profile_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_community_share_rdm_claims"
    ADD CONSTRAINT "quiz_community_share_rdm_claims_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."lessons_raw_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_community_share_rdm_claims"
    ADD CONSTRAINT "quiz_community_share_rdm_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refer_challenge_claims"
    ADD CONSTRAINT "refer_challenge_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_attributions"
    ADD CONSTRAINT "referral_attributions_referee_user_id_fkey" FOREIGN KEY ("referee_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_attributions"
    ADD CONSTRAINT "referral_attributions_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_weekly_bonuses"
    ADD CONSTRAINT "referral_weekly_bonuses_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_questions"
    ADD CONSTRAINT "saved_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_events"
    ADD CONSTRAINT "student_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_gyan_presence"
    ADD CONSTRAINT "student_gyan_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."student_learning_dwell_events"
    ADD CONSTRAINT "student_learning_dwell_events_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_learning_presence"
    ADD CONSTRAINT "student_learning_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_lesson_mark_completions"
    ADD CONSTRAINT "student_lesson_mark_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_section_history"
    ADD CONSTRAINT "student_section_history_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_section_history"
    ADD CONSTRAINT "student_section_history_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."classroom_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_section_history"
    ADD CONSTRAINT "student_section_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_site_presence"
    ADD CONSTRAINT "student_site_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_buddies"
    ADD CONSTRAINT "study_buddies_buddy_user_id_fkey" FOREIGN KEY ("buddy_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_buddies"
    ADD CONSTRAINT "study_buddies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_streak_milestone_claims"
    ADD CONSTRAINT "study_streak_milestone_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subject_topic_chat_messages"
    ADD CONSTRAINT "subject_topic_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_coupons"
    ADD CONSTRAINT "subscription_coupons_redeemed_by_user_id_fkey" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subtopic_content"
    ADD CONSTRAINT "subtopic_content_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_generated_test_history"
    ADD CONSTRAINT "teacher_generated_test_history_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_google_calendar_tokens"
    ADD CONSTRAINT "teacher_google_calendar_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_motivation_rdm_grants"
    ADD CONSTRAINT "teacher_motivation_rdm_grants_assignment_post_id_fkey" FOREIGN KEY ("assignment_post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teacher_motivation_rdm_grants"
    ADD CONSTRAINT "teacher_motivation_rdm_grants_motivation_post_id_fkey" FOREIGN KEY ("motivation_post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_motivation_rdm_grants"
    ADD CONSTRAINT "teacher_motivation_rdm_grants_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_profile_details"
    ADD CONSTRAINT "teacher_profile_details_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topic_content_runs"
    ADD CONSTRAINT "topic_content_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."topic_content"
    ADD CONSTRAINT "topic_content_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."topic_quiz_advanced_rdm_attempts"
    ADD CONSTRAINT "topic_quiz_advanced_rdm_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactional_email_logs"
    ADD CONSTRAINT "transactional_email_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_memory_profile"
    ADD CONSTRAINT "user_memory_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_play_stats"
    ADD CONSTRAINT "user_play_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_items"
    ADD CONSTRAINT "user_saved_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_study_day_totals"
    ADD CONSTRAINT "user_study_day_totals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist_submissions"
    ADD CONSTRAINT "waitlist_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



CREATE POLICY "Admins can delete posts" ON "public"."news_blog_posts" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM "p"."role")) = 'admin'::"text"))))));



CREATE POLICY "Admins can insert posts" ON "public"."news_blog_posts" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM "p"."role")) = 'admin'::"text"))))));



CREATE POLICY "Admins can read transactional email logs" ON "public"."transactional_email_logs" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "Admins can update posts" ON "public"."news_blog_posts" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM "p"."role")) = 'admin'::"text")))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM "p"."role")) = 'admin'::"text"))))));



CREATE POLICY "Allow authenticated to read classrooms for explore" ON "public"."classrooms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated to read profiles for explore" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow select by own email" ON "public"."approved_emails" FOR SELECT USING (("email" = "lower"(("auth"."jwt"() ->> 'email'::"text"))));



CREATE POLICY "Anyone can read doubt_answers" ON "public"."doubt_answers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read doubts" ON "public"."doubts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read reviews" ON "public"."classroom_reviews" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can read daily_gauntlet_attempts" ON "public"."daily_gauntlet_attempts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can read play_questions" ON "public"."play_questions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read cbse_mcq_chapters" ON "public"."cbse_mcq_chapters" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read lessons raw comments" ON "public"."lessons_raw_post_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read lessons raw votes" ON "public"."lessons_raw_post_votes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read mock_papers" ON "public"."mock_papers" FOR SELECT TO "authenticated" USING (("published" = true));



CREATE POLICY "Authenticated read mock_questions" ON "public"."mock_questions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."mock_papers" "p"
  WHERE (("p"."id" = "mock_questions"."paper_id") AND ("p"."published" = true)))));



CREATE POLICY "Authenticated read past_paper_questions" ON "public"."past_paper_questions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."past_papers" "p"
  WHERE (("p"."id" = "past_paper_questions"."paper_id") AND ("p"."published" = true)))));



CREATE POLICY "Authenticated read past_papers" ON "public"."past_papers" FOR SELECT TO "authenticated" USING (("published" = true));



CREATE POLICY "Authenticated users read lessons raw boosts" ON "public"."lessons_raw_post_boosts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users read lessons raw posts" ON "public"."lessons_raw_posts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Explorers can read live_sessions of class they are exploring" ON "public"."live_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."class_exploration_sessions" "ces"
  WHERE (("ces"."classroom_id" = "live_sessions"."classroom_id") AND ("ces"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ces"."started_at" > ("now"() - '00:10:00'::interval))))));



CREATE POLICY "Explorers can read posts of class they are exploring" ON "public"."posts" FOR SELECT TO "authenticated" USING ((("section_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."class_exploration_sessions" "ces"
  WHERE (("ces"."classroom_id" = "posts"."classroom_id") AND ("ces"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) AND ((NOT (("type" = ANY (ARRAY['assignment'::"text", 'quiz'::"text", 'mock'::"text", 'Concept Focus'::"text"])) AND ("jsonb_typeof"(("content_json" -> 'targetStudentIds'::"text")) = 'array'::"text") AND ("jsonb_array_length"(("content_json" -> 'targetStudentIds'::"text")) > 0))) OR (("content_json" -> 'targetStudentIds'::"text") ? (( SELECT "auth"."uid"() AS "uid"))::"text"))));



CREATE POLICY "Members can read live_sessions of their classroom" ON "public"."live_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."classroom_members" "cm"
  WHERE (("cm"."classroom_id" = "live_sessions"."classroom_id") AND ("cm"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Members can read posts of their classroom" ON "public"."posts" FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM "public"."student_section_history" "ssh"
  WHERE (("ssh"."classroom_id" = "posts"."classroom_id") AND ("ssh"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ((("posts"."section_id" IS NULL) AND ("posts"."created_at" >= "ssh"."joined_at") AND (("ssh"."left_at" IS NULL) OR ("posts"."created_at" <= "ssh"."left_at"))) OR (("posts"."section_id" = "ssh"."section_id") AND ((("posts"."created_at" >= "ssh"."joined_at") AND (("ssh"."left_at" IS NULL) OR ("posts"."created_at" <= "ssh"."left_at"))) OR (("posts"."created_at" < "ssh"."joined_at") AND ("posts"."due_date" IS NOT NULL) AND ("posts"."due_date" > "ssh"."joined_at")))))))) AND ((NOT (("type" = ANY (ARRAY['assignment'::"text", 'quiz'::"text", 'mock'::"text", 'past_paper'::"text", 'Concept Focus'::"text"])) AND (COALESCE("jsonb_typeof"(("content_json" -> 'targetStudentIds'::"text")), ''::"text") = 'array'::"text") AND (COALESCE("jsonb_array_length"(("content_json" -> 'targetStudentIds'::"text")), 0) > 0))) OR (("content_json" -> 'targetStudentIds'::"text") ? (( SELECT "auth"."uid"() AS "uid"))::"text"))) OR "public"."student_has_active_grant_for_assignment"("id") OR "public"."student_can_read_post_via_teacher_nudge"("id", "classroom_id")));



CREATE POLICY "Public can read published posts" ON "public"."news_blog_posts" FOR SELECT TO "anon", "authenticated" USING (("publish_date" <= "now"()));



CREATE POLICY "Public read profile_academics" ON "public"."profile_academics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public read profile_achievements" ON "public"."profile_achievements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Students read own section history" ON "public"."student_section_history" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Teachers can add members to their classroom" ON "public"."classroom_members" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_members"."classroom_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Teachers can delete own history" ON "public"."teacher_generated_test_history" FOR DELETE TO "authenticated" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can insert own history" ON "public"."teacher_generated_test_history" FOR INSERT TO "authenticated" WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can read live_sessions of their classroom" ON "public"."live_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "live_sessions"."classroom_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Teachers can read posts of their classroom" ON "public"."posts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "posts"."classroom_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Teachers can remove members from their classroom" ON "public"."classroom_members" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_members"."classroom_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Teachers can update join requests for their classroom" ON "public"."classroom_join_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_join_requests"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_join_requests"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view own history" ON "public"."teacher_generated_test_history" FOR SELECT TO "authenticated" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers delete own classrooms" ON "public"."classrooms" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "teacher_id"));



CREATE POLICY "Teachers delete own live_sessions" ON "public"."live_sessions" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "teacher_id"));



CREATE POLICY "Teachers delete own posts" ON "public"."posts" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "teacher_id"));



CREATE POLICY "Teachers delete sections in their classroom" ON "public"."classroom_sections" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_sections"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers insert live_sessions in their classroom" ON "public"."live_sessions" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "teacher_id") AND (EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "live_sessions"."classroom_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Teachers insert own classrooms" ON "public"."classrooms" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "teacher_id"));



CREATE POLICY "Teachers insert posts in their classroom" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "teacher_id") AND (EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "posts"."classroom_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))) AND (("section_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."classroom_sections" "s"
  WHERE (("s"."id" = "posts"."section_id") AND ("s"."classroom_id" = "posts"."classroom_id")))))));



CREATE POLICY "Teachers insert sections in their classroom" ON "public"."classroom_sections" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_sections"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers read classroom section history" ON "public"."student_section_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "student_section_history"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers update own classrooms" ON "public"."classrooms" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "teacher_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "teacher_id"));



CREATE POLICY "Teachers update own live_sessions" ON "public"."live_sessions" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "teacher_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "teacher_id"));



CREATE POLICY "Teachers update own posts" ON "public"."posts" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "teacher_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "teacher_id"));



CREATE POLICY "Teachers update sections in their classroom" ON "public"."classroom_sections" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_sections"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_sections"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own doubt_answers" ON "public"."doubt_answers" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("is_accepted" = false) AND (( SELECT "doubts"."is_resolved"
   FROM "public"."doubts"
  WHERE ("doubts"."id" = "doubt_answers"."doubt_id")) = false)));



CREATE POLICY "Users can delete own doubt_votes" ON "public"."doubt_votes" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own doubts" ON "public"."doubts" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("is_resolved" = false)));



CREATE POLICY "Users can delete own join request" ON "public"."classroom_join_requests" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own profile_academics" ON "public"."profile_academics" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own profile_achievements" ON "public"."profile_achievements" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own class_exploration_session" ON "public"."class_exploration_sessions" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own doubt_answers" ON "public"."doubt_answers" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own doubt_votes" ON "public"."doubt_votes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own doubts" ON "public"."doubts" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own join request" ON "public"."classroom_join_requests" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("status" = 'pending'::"text")));



CREATE POLICY "Users can insert own live_session_join" ON "public"."live_session_joins" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert own profile_academics" ON "public"."profile_academics" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile_achievements" ON "public"."profile_achievements" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own reports" ON "public"."doubt_answer_reports" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "reporter_user_id"));



CREATE POLICY "Users can insert own review" ON "public"."classroom_reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own user_roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can join classroom as student" ON "public"."classroom_members" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("role" = 'student'::"text")));



CREATE POLICY "Users can manage own saves" ON "public"."doubt_saves" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can re-apply (set rejected to pending)" ON "public"."classroom_join_requests" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND ("status" = 'rejected'::"text"))) WITH CHECK ((("auth"."uid"() = "user_id") AND ("status" = 'pending'::"text")));



CREATE POLICY "Users can read join requests for allowed context" ON "public"."classroom_join_requests" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_join_requests"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Users can read members of their classrooms" ON "public"."classroom_members" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_members"."classroom_id") AND ("c"."teacher_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."user_is_member_of_classroom"("classroom_id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can read own class_exploration_sessions" ON "public"."class_exploration_sessions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own doubt_votes" ON "public"."doubt_votes" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own episodic memory" ON "public"."episodic_memory" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own explorer_live_joins" ON "public"."explorer_live_joins" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own live_session_joins" ON "public"."live_session_joins" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own memory profile" ON "public"."user_memory_profile" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own reports" ON "public"."doubt_answer_reports" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "reporter_user_id"));



CREATE POLICY "Users can read own user_roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read sections of their classrooms" ON "public"."classroom_sections" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_sections"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))) OR "public"."user_is_member_of_classroom"("classroom_id", "auth"."uid"())));



CREATE POLICY "Users can update own doubt_answers" ON "public"."doubt_answers" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("is_accepted" = false) AND (( SELECT "doubts"."is_resolved"
   FROM "public"."doubts"
  WHERE ("doubts"."id" = "doubt_answers"."doubt_id")) = false)));



CREATE POLICY "Users can update own doubts" ON "public"."doubts" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("is_resolved" = false)));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update own profile_academics" ON "public"."profile_academics" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile_achievements" ON "public"."profile_achievements" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own review" ON "public"."classroom_reviews" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own user_roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own lessons raw boosts" ON "public"."lessons_raw_post_boosts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own lessons raw comments" ON "public"."lessons_raw_post_comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own lessons raw posts" ON "public"."lessons_raw_posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own lessons raw votes" ON "public"."lessons_raw_post_votes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own magic wall basket items" ON "public"."magic_wall_basket_items" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own saved items" ON "public"."user_saved_items" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own daily_gauntlet_attempts" ON "public"."daily_gauntlet_attempts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own lessons raw boosts" ON "public"."lessons_raw_post_boosts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own lessons raw comments" ON "public"."lessons_raw_post_comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own lessons raw posts" ON "public"."lessons_raw_posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own lessons raw votes" ON "public"."lessons_raw_post_votes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own magic wall basket items" ON "public"."magic_wall_basket_items" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own saved items" ON "public"."user_saved_items" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own subject topic chat" ON "public"."subject_topic_chat_messages" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert select own play_history" ON "public"."play_history" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own saved questions" ON "public"."saved_questions" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own user_play_stats" ON "public"."user_play_stats" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own daily_reward_claims" ON "public"."daily_reward_claims" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own subject topic chat" ON "public"."subject_topic_chat_messages" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users select own magic wall basket items" ON "public"."magic_wall_basket_items" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users select own play_history" ON "public"."play_history" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users select own saved items" ON "public"."user_saved_items" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own daily_gauntlet_attempts" ON "public"."daily_gauntlet_attempts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own lessons raw comments" ON "public"."lessons_raw_post_comments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own lessons raw posts" ON "public"."lessons_raw_posts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own lessons raw votes" ON "public"."lessons_raw_post_votes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own magic wall basket items" ON "public"."magic_wall_basket_items" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own saved items" ON "public"."user_saved_items" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."accepted_answer_payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_all" ON "public"."coupons" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



ALTER TABLE "public"."admin_analytics_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_analytics_cache_service_role" ON "public"."admin_analytics_cache" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_user_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_user_actions_insert_admin" ON "public"."admin_user_actions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "admin_user_actions_select_admin" ON "public"."admin_user_actions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



ALTER TABLE "public"."ai_token_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_token_logs_insert_authenticated" ON "public"."ai_token_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "ai_token_logs_select_admin" ON "public"."ai_token_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



ALTER TABLE "public"."approved_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."buddy_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "buddy_invites_insert_own" ON "public"."buddy_invites" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "inviter_user_id"));



CREATE POLICY "buddy_invites_select_own" ON "public"."buddy_invites" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "inviter_user_id"));



CREATE POLICY "buddy_invites_update_own_revoke" ON "public"."buddy_invites" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "inviter_user_id")) WITH CHECK (("auth"."uid"() = "inviter_user_id"));



CREATE POLICY "car_insert_own_member" ON "public"."classroom_assignment_responses" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."posts" "p"
     JOIN "public"."classroom_members" "m" ON ((("m"."classroom_id" = "p"."classroom_id") AND ("m"."user_id" = "auth"."uid"()))))
  WHERE ("p"."id" = "classroom_assignment_responses"."post_id")))));



CREATE POLICY "car_select_own_or_teacher" ON "public"."classroom_assignment_responses" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM ("public"."posts" "p"
     JOIN "public"."classrooms" "c" ON (("c"."id" = "p"."classroom_id")))
  WHERE (("p"."id" = "classroom_assignment_responses"."post_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "car_update_own_member" ON "public"."classroom_assignment_responses" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."posts" "p"
     JOIN "public"."classroom_members" "m" ON ((("m"."classroom_id" = "p"."classroom_id") AND ("m"."user_id" = "auth"."uid"()))))
  WHERE ("p"."id" = "classroom_assignment_responses"."post_id"))))) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "catp_delete_own" ON "public"."classroom_assignment_task_progress" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "catp_insert_own_member" ON "public"."classroom_assignment_task_progress" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."posts" "p"
     JOIN "public"."classroom_members" "m" ON ((("m"."classroom_id" = "p"."classroom_id") AND ("m"."user_id" = "auth"."uid"()))))
  WHERE ("p"."id" = "classroom_assignment_task_progress"."post_id")))));



CREATE POLICY "catp_select_own_or_teacher" ON "public"."classroom_assignment_task_progress" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM ("public"."posts" "p"
     JOIN "public"."classrooms" "c" ON (("c"."id" = "p"."classroom_id")))
  WHERE (("p"."id" = "classroom_assignment_task_progress"."post_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



ALTER TABLE "public"."cbse_mcq_chapters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cbse_mcq_comm_share_select_own" ON "public"."cbse_mcq_community_share_rdm_claims" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."cbse_mcq_community_share_rdm_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cbse_mcq_score_bonus_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cbse_mcq_score_bonus_select_own" ON "public"."cbse_mcq_score_bonus_claims" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cgta_insert_own_member" ON "public"."classroom_generated_test_attempts" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."classroom_members" "m"
  WHERE (("m"."classroom_id" = "classroom_generated_test_attempts"."classroom_id") AND ("m"."user_id" = "auth"."uid"()))))));



CREATE POLICY "cgta_select_own_or_teacher" ON "public"."classroom_generated_test_attempts" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM ("public"."posts" "p"
     JOIN "public"."classrooms" "c" ON (("c"."id" = "p"."classroom_id")))
  WHERE (("p"."id" = "classroom_generated_test_attempts"."post_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "cgta_update_own_member" ON "public"."classroom_generated_test_attempts" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."classroom_members" "m"
  WHERE (("m"."classroom_id" = "classroom_generated_test_attempts"."classroom_id") AND ("m"."user_id" = "auth"."uid"())))))) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."class_exploration_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_assignment_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_assignment_task_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_generated_test_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_join_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classrooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."curriculum_chapters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "curriculum_chapters_select" ON "public"."curriculum_chapters" FOR SELECT USING (true);



ALTER TABLE "public"."curriculum_subtopics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "curriculum_subtopics_select" ON "public"."curriculum_subtopics" FOR SELECT USING (true);



ALTER TABLE "public"."curriculum_topics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "curriculum_topics_select" ON "public"."curriculum_topics" FOR SELECT USING (true);



ALTER TABLE "public"."curriculum_units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "curriculum_units_select" ON "public"."curriculum_units" FOR SELECT USING (true);



ALTER TABLE "public"."daily_gauntlet_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_reward_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doubt_answer_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doubt_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doubt_saves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doubt_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doubts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."episodic_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."explorer_live_joins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gyan_bot_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gyan_bot_config_select_admin" ON "public"."gyan_bot_config" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "gyan_bot_config_update_admin" ON "public"."gyan_bot_config" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



ALTER TABLE "public"."gyan_curriculum_nodes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gyan_curriculum_nodes_select_authenticated" ON "public"."gyan_curriculum_nodes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."inactive_day_penalties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inactive_day_penalties_select_own" ON "public"."inactive_day_penalties" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."lessons_raw_post_boosts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lessons_raw_post_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lessons_raw_post_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lessons_raw_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_session_joins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."magic_wall_basket_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."magic_wall_topic_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "magic_wall_topic_attempts_insert_own" ON "public"."magic_wall_topic_attempts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "magic_wall_topic_attempts_select_own" ON "public"."magic_wall_topic_attempts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "mock_comm_share_select_own" ON "public"."mock_community_share_rdm_claims" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."mock_community_share_rdm_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mock_papers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mock_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mock_rdm_bonus_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mock_rdm_bonus_attempts_select_own" ON "public"."mock_rdm_bonus_attempts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."mock_rdm_bonus_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mock_rdm_bonus_claims_select_own" ON "public"."mock_rdm_bonus_claims" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."mock_test_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mock_test_attempts_select_own" ON "public"."mock_test_attempts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."news_blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."numerals_community_share_rdm_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "numerals_community_share_rdm_claims_select_own" ON "public"."numerals_community_share_rdm_claims" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."past_paper_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."past_papers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_feedback_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_feedback_submissions_insert_own" ON "public"."platform_feedback_submissions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "platform_feedback_submissions_select_own" ON "public"."platform_feedback_submissions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."play_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."play_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prep_calendar_day_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prep_calendar_day_activity_delete_own" ON "public"."prep_calendar_day_activity" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "prep_calendar_day_activity_insert_own" ON "public"."prep_calendar_day_activity" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "prep_calendar_day_activity_select_own" ON "public"."prep_calendar_day_activity" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "prep_calendar_day_activity_update_own" ON "public"."prep_calendar_day_activity" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profile_academics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_community_share_rdm_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quiz_community_share_rdm_claims_select_own" ON "public"."quiz_community_share_rdm_claims" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."rdm_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rdm_config_insert_admin" ON "public"."rdm_config" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "rdm_config_select_all" ON "public"."rdm_config" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rdm_config_update_admin" ON "public"."rdm_config" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



ALTER TABLE "public"."refer_challenge_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refer_challenge_claims_insert_own" ON "public"."refer_challenge_claims" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "refer_challenge_claims_select_own" ON "public"."refer_challenge_claims" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "refer_challenge_claims_update_own" ON "public"."refer_challenge_claims" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."referral_attributions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "referral_attributions_select_own" ON "public"."referral_attributions" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "referee_user_id") OR ("auth"."uid"() = "referrer_user_id")));



ALTER TABLE "public"."referral_weekly_bonuses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "referral_weekly_bonuses_select_own" ON "public"."referral_weekly_bonuses" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "referrer_user_id"));



ALTER TABLE "public"."saved_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_events_insert_own" ON "public"."student_events" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "student_events_select_own" ON "public"."student_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "student_events_service_role_all" ON "public"."student_events" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."student_gyan_presence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_gyan_presence_delete_own" ON "public"."student_gyan_presence" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "student_gyan_presence_insert_own" ON "public"."student_gyan_presence" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "student_gyan_presence_select_active_buddy" ON "public"."student_gyan_presence" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."study_buddies" "sb"
  WHERE (("sb"."user_id" = "auth"."uid"()) AND ("sb"."status" = 'active'::"text") AND ("sb"."buddy_user_id" = "student_gyan_presence"."user_id")))));



CREATE POLICY "student_gyan_presence_select_own" ON "public"."student_gyan_presence" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "student_gyan_presence_update_own" ON "public"."student_gyan_presence" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."student_learning_dwell_2025_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_07" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_08" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_09" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_10" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_11" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2026_12" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2027_01" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2027_02" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2027_03" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2027_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2027_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_2027_06" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_learning_dwell_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_learning_dwell_insert_own" ON "public"."student_learning_dwell_events" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "student_learning_dwell_select_active_buddy" ON "public"."student_learning_dwell_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."study_buddies" "sb"
  WHERE (("sb"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("sb"."status" = 'active'::"text") AND ("sb"."buddy_user_id" = "student_learning_dwell_events"."user_id")))));



CREATE POLICY "student_learning_dwell_select_own" ON "public"."student_learning_dwell_events" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."student_learning_presence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_learning_presence_delete_own" ON "public"."student_learning_presence" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "student_learning_presence_insert_own" ON "public"."student_learning_presence" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "student_learning_presence_select_active_buddy" ON "public"."student_learning_presence" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."study_buddies" "sb"
  WHERE (("sb"."user_id" = "auth"."uid"()) AND ("sb"."status" = 'active'::"text") AND ("sb"."buddy_user_id" = "student_learning_presence"."user_id")))));



CREATE POLICY "student_learning_presence_select_own" ON "public"."student_learning_presence" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "student_learning_presence_update_own" ON "public"."student_learning_presence" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."student_lesson_mark_completions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_lesson_mark_completions_delete_own" ON "public"."student_lesson_mark_completions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "student_lesson_mark_completions_insert_own" ON "public"."student_lesson_mark_completions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "student_lesson_mark_completions_select_own" ON "public"."student_lesson_mark_completions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "student_lesson_mark_completions_update_own" ON "public"."student_lesson_mark_completions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."student_section_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_site_presence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_site_presence_delete_own" ON "public"."student_site_presence" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "student_site_presence_insert_own" ON "public"."student_site_presence" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "student_site_presence_select_active_buddy" ON "public"."student_site_presence" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."study_buddies" "sb"
  WHERE (("sb"."user_id" = "auth"."uid"()) AND ("sb"."status" = 'active'::"text") AND ("sb"."buddy_user_id" = "student_site_presence"."user_id")))));



CREATE POLICY "student_site_presence_select_own" ON "public"."student_site_presence" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "student_site_presence_update_own" ON "public"."student_site_presence" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."study_buddies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_buddies_select_own" ON "public"."study_buddies" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."study_streak_milestone_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_streak_milestone_claims_select_own" ON "public"."study_streak_milestone_claims" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."subject_topic_chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_coupons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_coupons_admin_all" ON "public"."subscription_coupons" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "subscription_coupons_user_read" ON "public"."subscription_coupons" FOR SELECT TO "authenticated" USING ((("restricted_to_user_ids" IS NOT NULL) AND ("auth"."uid"() = ANY ("restricted_to_user_ids"))));



ALTER TABLE "public"."subtopic_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subtopic_content_insert_admin" ON "public"."subtopic_content" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "subtopic_content_select_authenticated" ON "public"."subtopic_content" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "subtopic_content_update_admin" ON "public"."subtopic_content" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



ALTER TABLE "public"."teacher_generated_test_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_google_calendar_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_motivation_grants_student_select" ON "public"."teacher_motivation_rdm_grants" FOR SELECT USING (("student_id" = "auth"."uid"()));



CREATE POLICY "teacher_motivation_grants_teacher_select" ON "public"."teacher_motivation_rdm_grants" FOR SELECT USING ("public"."teacher_owns_motivation_post"("motivation_post_id"));



ALTER TABLE "public"."teacher_motivation_rdm_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_profile_details" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_profile_details_delete_owner" ON "public"."teacher_profile_details" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "teacher_profile_details_insert_owner" ON "public"."teacher_profile_details" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "teacher_profile_details_select_owner_or_members" ON "public"."teacher_profile_details" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "teacher_id") OR (EXISTS ( SELECT 1
   FROM ("public"."classroom_members" "cm"
     JOIN "public"."classrooms" "c" ON (("c"."id" = "cm"."classroom_id")))
  WHERE (("cm"."user_id" = "auth"."uid"()) AND ("c"."teacher_id" = "teacher_profile_details"."teacher_id"))))));



CREATE POLICY "teacher_profile_details_update_owner" ON "public"."teacher_profile_details" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "teacher_id")) WITH CHECK (("auth"."uid"() = "teacher_id"));



ALTER TABLE "public"."topic_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "topic_content_insert_admin" ON "public"."topic_content" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



ALTER TABLE "public"."topic_content_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "topic_content_runs_insert_admin" ON "public"."topic_content_runs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "topic_content_runs_select_authenticated" ON "public"."topic_content_runs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "topic_content_select_authenticated" ON "public"."topic_content" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "topic_content_update_admin" ON "public"."topic_content" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "topic_quiz_adv_rdm_attempts_select_own" ON "public"."topic_quiz_advanced_rdm_attempts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."topic_quiz_advanced_rdm_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactional_email_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_memory_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_play_stats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_read" ON "public"."coupons" FOR SELECT TO "authenticated" USING ((("is_purchased" = false) OR ("bought_by_teacher_id" = "auth"."uid"()) OR ("auth"."uid"() = ANY ("restricted_to_teacher_ids"))));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_saved_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_study_day_totals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_study_day_totals_delete_own" ON "public"."user_study_day_totals" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_study_day_totals_insert_own" ON "public"."user_study_day_totals" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_study_day_totals_select_own" ON "public"."user_study_day_totals" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_study_day_totals_update_own" ON "public"."user_study_day_totals" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."waitlist_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "waitlist_submissions_insert_public" ON "public"."waitlist_submissions" FOR INSERT WITH CHECK (true);



CREATE POLICY "academic_ms_delete_own" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'academic-marksheets'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "academic_ms_insert_own" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'academic-marksheets'::"text") AND ("owner" = "auth"."uid"()) AND "public"."is_owner_prefixed_storage_path"("name")));



CREATE POLICY "academic_ms_select_own" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'academic-marksheets'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "academic_ms_update_own" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'academic-marksheets'::"text") AND ("owner" = "auth"."uid"()))) WITH CHECK ((("bucket_id" = 'academic-marksheets'::"text") AND ("owner" = "auth"."uid"()) AND "public"."is_owner_prefixed_storage_path"("name")));



CREATE POLICY "achievement_ms_delete_own" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'achievement-marksheets'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "achievement_ms_insert_own" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'achievement-marksheets'::"text") AND ("owner" = "auth"."uid"()) AND "public"."is_owner_prefixed_storage_path"("name")));



CREATE POLICY "achievement_ms_select_own" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'achievement-marksheets'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "achievement_ms_update_own" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'achievement-marksheets'::"text") AND ("owner" = "auth"."uid"()))) WITH CHECK ((("bucket_id" = 'achievement-marksheets'::"text") AND ("owner" = "auth"."uid"()) AND "public"."is_owner_prefixed_storage_path"("name")));



ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_avatars_delete_own" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'profile-avatars'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "profile_avatars_insert_own" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'profile-avatars'::"text") AND ("owner" = "auth"."uid"()) AND "public"."is_owner_prefixed_storage_path"("name")));



CREATE POLICY "profile_avatars_select_public" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'profile-avatars'::"text"));



CREATE POLICY "profile_avatars_update_own" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'profile-avatars'::"text") AND ("owner" = "auth"."uid"()))) WITH CHECK ((("bucket_id" = 'profile-avatars'::"text") AND ("owner" = "auth"."uid"()) AND "public"."is_owner_prefixed_storage_path"("name")));



ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_verif_delete_own" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'teacher-verification-docs'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "teacher_verif_insert_own" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'teacher-verification-docs'::"text") AND ("owner" = "auth"."uid"()) AND "public"."is_owner_prefixed_storage_path"("name")));



CREATE POLICY "teacher_verif_select_own" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'teacher-verification-docs'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "teacher_verif_update_own" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'teacher-verification-docs'::"text") AND ("owner" = "auth"."uid"()))) WITH CHECK ((("bucket_id" = 'teacher-verification-docs'::"text") AND ("owner" = "auth"."uid"()) AND "public"."is_owner_prefixed_storage_path"("name")));



ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



GRANT ALL ON FUNCTION "public"."_bits_attempt_key"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic" "text", "p_set" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_bits_attempt_key"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic" "text", "p_set" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_bits_attempt_key"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic" "text", "p_set" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_bits_sanitize_key_part"("p" "text", "maxlen" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_bits_sanitize_key_part"("p" "text", "maxlen" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_bits_sanitize_key_part"("p" "text", "maxlen" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_formula_practice_attempt_key"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text", "p_formula_idx" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_formula_practice_attempt_key"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text", "p_formula_idx" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_formula_practice_attempt_key"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text", "p_formula_idx" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_free_trial_daily_task_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."_free_trial_daily_task_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_free_trial_daily_task_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_free_trial_daily_tasks_valid"("p_tasks" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_free_trial_daily_tasks_valid"("p_tasks" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_free_trial_daily_tasks_valid"("p_tasks" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_free_trial_day2_unlock_at"("p_claimed_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."_free_trial_day2_unlock_at"("p_claimed_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_free_trial_day2_unlock_at"("p_claimed_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."_free_trial_next_streak_day"("p_state" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."_free_trial_next_streak_day"("p_state" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_free_trial_next_streak_day"("p_state" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."_free_trial_onboarding_all_complete"("p_progress" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."_free_trial_onboarding_all_complete"("p_progress" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_free_trial_onboarding_all_complete"("p_progress" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."_free_trial_onboarding_task_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."_free_trial_onboarding_task_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_free_trial_onboarding_task_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_free_trial_streak_active_day"("p_state" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."_free_trial_streak_active_day"("p_state" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_free_trial_streak_active_day"("p_state" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."_free_trial_streak_day_task_ids"("p_state" "jsonb", "p_day_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_free_trial_streak_day_task_ids"("p_state" "jsonb", "p_day_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_free_trial_streak_day_task_ids"("p_state" "jsonb", "p_day_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_free_trial_trial_day_number"("p_claimed_at" timestamp with time zone, "p_now" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."_free_trial_trial_day_number"("p_claimed_at" timestamp with time zone, "p_now" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_free_trial_trial_day_number"("p_claimed_at" timestamp with time zone, "p_now" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."_gyan_plus_onboarding_complete"("p_progress" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."_gyan_plus_onboarding_complete"("p_progress" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_gyan_plus_onboarding_complete"("p_progress" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."_js_int32_wrap"("x" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."_js_int32_wrap"("x" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_js_int32_wrap"("x" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."_legacy_sanitize_lookup"("t" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_legacy_sanitize_lookup"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_legacy_sanitize_lookup"("t" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_norm_attempt_key_part"("t" "text", "max_len" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_norm_attempt_key_part"("t" "text", "max_len" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_norm_attempt_key_part"("t" "text", "max_len" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_norm_content_key"("t" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_norm_content_key"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_norm_content_key"("t" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_norm_subject_key"("t" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_norm_subject_key"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_norm_subject_key"("t" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid", "p_acceptor_max" integer, "p_inviter_max" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid", "p_acceptor_max" integer, "p_inviter_max" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_buddy_invite"("p_token" "text", "p_acceptor_id" "uuid", "p_acceptor_max" integer, "p_inviter_max" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_doubt_answer"("p_doubt_id" "uuid", "p_answer_id" "uuid", "p_bonus_rdm" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."accept_doubt_answer"("p_doubt_id" "uuid", "p_answer_id" "uuid", "p_bonus_rdm" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_doubt_answer"("p_doubt_id" "uuid", "p_answer_id" "uuid", "p_bonus_rdm" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_rdm"("uid" "uuid", "amt" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_rdm"("uid" "uuid", "amt" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_rdm"("uid" "uuid", "amt" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_rdm"("uid" "uuid", "amt" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_user_site_presence_ms"("p_day" "date", "p_delta_ms" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."add_user_site_presence_ms"("p_day" "date", "p_delta_ms" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_user_site_presence_ms"("p_day" "date", "p_delta_ms" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_user_study_day_ms"("p_day" "date", "p_delta_ms" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."add_user_study_day_ms"("p_day" "date", "p_delta_ms" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_user_study_day_ms"("p_day" "date", "p_delta_ms" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_analytics_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_analytics_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_analytics_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_churn_risk"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_churn_risk"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_churn_risk"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_conversion_funnel"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_conversion_funnel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_conversion_funnel"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_dropoff_tracking"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_dropoff_tracking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_dropoff_tracking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_event_funnel"("p_event_names" "text"[], "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_event_funnel"("p_event_names" "text"[], "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_event_funnel"("p_event_names" "text"[], "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_event_summary"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_event_summary"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_event_summary"("p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_feature_adoption"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_feature_adoption"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_feature_adoption"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_retention_cohorts"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_retention_cohorts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_retention_cohorts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_expired_classroom_sections"() TO "anon";
GRANT ALL ON FUNCTION "public"."archive_expired_classroom_sections"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_expired_classroom_sections"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."award_daily_rdm"("p_user_id" "uuid", "p_action_type" "text", "p_points" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."award_daily_rdm"("p_user_id" "uuid", "p_action_type" "text", "p_points" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."award_daily_rdm"("p_user_id" "uuid", "p_action_type" "text", "p_points" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_daily_rdm"("p_user_id" "uuid", "p_action_type" "text", "p_points" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."bits_signature_v1"("bits_questions" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bits_signature_v1"("bits_questions" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bits_signature_v1"("bits_questions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bits_signature_v1"("bits_questions" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_lessons_raw_post_comment_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_lessons_raw_post_comment_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_lessons_raw_post_comment_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_cbse_mcq_chapter_score_rdm"("p_paper_id" "uuid", "p_correct" integer, "p_total" integer, "p_attempt_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_cbse_mcq_chapter_score_rdm"("p_paper_id" "uuid", "p_correct" integer, "p_total" integer, "p_attempt_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_cbse_mcq_chapter_score_rdm"("p_paper_id" "uuid", "p_correct" integer, "p_total" integer, "p_attempt_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_cbse_mcq_chapter_score_rdm"("p_paper_id" "uuid", "p_correct" integer, "p_total" integer, "p_attempt_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_cbse_mcq_community_share_rdm"("p_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_cbse_mcq_community_share_rdm"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_cbse_mcq_community_share_rdm"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_cbse_mcq_community_share_rdm"("p_post_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_free_trial_checklist_reward"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_free_trial_checklist_reward"() TO "anon";
GRANT ALL ON FUNCTION "public"."claim_free_trial_checklist_reward"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_free_trial_checklist_reward"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_free_trial_daily_streak_reward"("p_day" integer, "p_task_ids" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_free_trial_daily_streak_reward"("p_day" integer, "p_task_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_free_trial_daily_streak_reward"("p_day" integer, "p_task_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_free_trial_daily_streak_reward"("p_day" integer, "p_task_ids" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_instacue_create_daily_rdm"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_instacue_create_daily_rdm"() TO "anon";
GRANT ALL ON FUNCTION "public"."claim_instacue_create_daily_rdm"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_instacue_create_daily_rdm"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_mock_community_share_rdm"("p_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_mock_community_share_rdm"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_mock_community_share_rdm"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_mock_community_share_rdm"("p_post_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_mock_rdm_bonus"("p_paper_id" "uuid", "p_answer_indices" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_mock_rdm_bonus"("p_paper_id" "uuid", "p_answer_indices" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_mock_rdm_bonus"("p_paper_id" "uuid", "p_answer_indices" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_mock_rdm_bonus"("p_paper_id" "uuid", "p_answer_indices" integer[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_numerals_community_share_rdm"("p_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_numerals_community_share_rdm"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_numerals_community_share_rdm"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_numerals_community_share_rdm"("p_post_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_numerals_pack_complete_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_numerals_pack_complete_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_numerals_pack_complete_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_numerals_pack_complete_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text", "p_level" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_quiz_community_share_rdm"("p_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_quiz_community_share_rdm"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_quiz_community_share_rdm"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_quiz_community_share_rdm"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_refer_challenge_reward"("p_challenge_key" "text", "p_reward_type" "text", "p_claim_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_refer_challenge_reward"("p_challenge_key" "text", "p_reward_type" "text", "p_claim_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_refer_challenge_reward"("p_challenge_key" "text", "p_reward_type" "text", "p_claim_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_referral_attribution"("p_ref_code" "text", "p_referee_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_referral_attribution"("p_ref_code" "text", "p_referee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_referral_attribution"("p_ref_code" "text", "p_referee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_referral_attribution"("p_ref_code" "text", "p_referee_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_topic_quiz_advanced_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_topic_quiz_advanced_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_topic_quiz_advanced_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_topic_quiz_advanced_daily_rdm"("p_board" "text", "p_subject" "text", "p_class_level" integer, "p_topic" "text", "p_subtopic_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_doubt_with_escrow"("p_title" "text", "p_body" "text", "p_subject" "text", "p_cost_rdm" integer, "p_bounty_rdm" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_doubt_with_escrow"("p_title" "text", "p_body" "text", "p_subject" "text", "p_cost_rdm" integer, "p_bounty_rdm" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_doubt_with_escrow"("p_title" "text", "p_body" "text", "p_subject" "text", "p_cost_rdm" integer, "p_bounty_rdm" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."deduct_rdm"("uid" "uuid", "amt" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deduct_rdm"("uid" "uuid", "amt" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_rdm"("uid" "uuid", "amt" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_rdm"("uid" "uuid", "amt" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."doubt_answer_daily_rdm_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."doubt_answer_daily_rdm_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."doubt_answer_daily_rdm_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."doubt_answer_reward_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."doubt_answer_reward_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."doubt_answer_reward_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."doubt_report_penalty_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."doubt_report_penalty_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."doubt_report_penalty_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."doubt_save_daily_rdm_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."doubt_save_daily_rdm_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."doubt_save_daily_rdm_trigger"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid", "p_buddy_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid", "p_buddy_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_buddy_pair"("p_user_id" "uuid", "p_buddy_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_classroom_sections_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_classroom_sections_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_classroom_sections_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_dwell_events_partition"("p_month" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_dwell_events_partition"("p_month" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_dwell_events_partition"("p_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_dwell_events_partition"("p_month" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."find_similar_answered_doubt"("p_title" "text", "p_min_similarity" real) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_similar_answered_doubt"("p_title" "text", "p_min_similarity" real) TO "anon";
GRANT ALL ON FUNCTION "public"."find_similar_answered_doubt"("p_title" "text", "p_min_similarity" real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_similar_answered_doubt"("p_title" "text", "p_min_similarity" real) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_adaptive_play_questions"("p_domain" "text", "p_category" "text", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_adaptive_play_questions"("p_domain" "text", "p_category" "text", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_adaptive_play_questions"("p_domain" "text", "p_category" "text", "p_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date", "p_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date", "p_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_leaderboard"("p_gauntlet_date" "date", "p_domain" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date", "p_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date", "p_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_gauntlet_questions"("p_date" "date", "p_domain" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_daily_rdm_earned_ist"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_daily_rdm_earned_ist"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_rdm_earned_ist"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_rdm_earned_ist"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_prep_calendar_summary"("p_today" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_prep_calendar_summary"("p_today" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_prep_calendar_summary"("p_today" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_refer_challenge_day_status"("p_claim_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_refer_challenge_day_status"("p_claim_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_refer_challenge_day_status"("p_claim_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_study_streak_summary"("p_today" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_study_streak_summary"("p_today" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_study_streak_summary"("p_today" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_mock_subject_score_averages"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_mock_subject_score_averages"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_mock_subject_score_averages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_mock_subject_score_averages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_saved_item_counts"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_saved_item_counts"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_saved_item_counts"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_doubt_views"("p_doubt_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_doubt_views"("p_doubt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_doubt_views"("p_doubt_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_prep_calendar_day"("p_day" "date", "p_field" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_prep_calendar_day"("p_day" "date", "p_field" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_prep_calendar_day"("p_day" "date", "p_field" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_gyan_bot_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_gyan_bot_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_gyan_bot_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_owner_prefixed_storage_path"("path" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_owner_prefixed_storage_path"("path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_owner_prefixed_storage_path"("path" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."maintain_student_section_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."maintain_student_section_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."maintain_student_section_history"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."match_episodic_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."match_episodic_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_episodic_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_episodic_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."match_episodic_memory_scoped"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid", "p_context_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."match_episodic_memory_scoped"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid", "p_context_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."match_episodic_memory_scoped"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid", "p_context_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_episodic_memory_scoped"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "p_user_id" "uuid", "p_context_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."news_blog_posts_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."news_blog_posts_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."news_blog_posts_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_duplicate_subtopic_names"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_duplicate_subtopic_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_duplicate_subtopic_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profile_academics_enforce_verified"() TO "anon";
GRANT ALL ON FUNCTION "public"."profile_academics_enforce_verified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_academics_enforce_verified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profile_achievements_enforce_verified"() TO "anon";
GRANT ALL ON FUNCTION "public"."profile_achievements_enforce_verified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_achievements_enforce_verified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_enforce_rdm_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_enforce_rdm_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_enforce_rdm_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_rdm_mutation_allowed"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_rdm_mutation_allowed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_rdm_mutation_allowed"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prune_empty_dwell_partitions"("p_months_ahead" integer, "p_months_behind" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prune_empty_dwell_partitions"("p_months_ahead" integer, "p_months_behind" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."prune_empty_dwell_partitions"("p_months_ahead" integer, "p_months_behind" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_empty_dwell_partitions"("p_months_ahead" integer, "p_months_behind" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."prune_telemetry_logs"("p_ai_token_days" integer, "p_dwell_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prune_telemetry_logs"("p_ai_token_days" integer, "p_dwell_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."prune_telemetry_logs"("p_ai_token_days" integer, "p_dwell_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_telemetry_logs"("p_ai_token_days" integer, "p_dwell_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reconcile_inactive_day_penalties"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconcile_inactive_day_penalties"() TO "anon";
GRANT ALL ON FUNCTION "public"."reconcile_inactive_day_penalties"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_inactive_day_penalties"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_mock_test_attempt"("p_attempt_key" "text", "p_session_kind" "text", "p_catalog_paper_id" "uuid", "p_past_paper_id" "uuid", "p_paper_slug" "text", "p_paper_title" "text", "p_score_percent" smallint, "p_correct_count" integer, "p_total_questions" integer, "p_subject_breakdown" "jsonb", "p_duration_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_mock_test_attempt"("p_attempt_key" "text", "p_session_kind" "text", "p_catalog_paper_id" "uuid", "p_past_paper_id" "uuid", "p_paper_slug" "text", "p_paper_title" "text", "p_score_percent" smallint, "p_correct_count" integer, "p_total_questions" integer, "p_subject_breakdown" "jsonb", "p_duration_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."record_mock_test_attempt"("p_attempt_key" "text", "p_session_kind" "text", "p_catalog_paper_id" "uuid", "p_past_paper_id" "uuid", "p_paper_slug" "text", "p_paper_title" "text", "p_score_percent" smallint, "p_correct_count" integer, "p_total_questions" integer, "p_subject_breakdown" "jsonb", "p_duration_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_mock_test_attempt"("p_attempt_key" "text", "p_session_kind" "text", "p_catalog_paper_id" "uuid", "p_past_paper_id" "uuid", "p_paper_slug" "text", "p_paper_title" "text", "p_score_percent" smallint, "p_correct_count" integer, "p_total_questions" integer, "p_subject_breakdown" "jsonb", "p_duration_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_play_result"("p_question_id" "uuid", "p_is_correct" boolean, "p_time_taken_ms" integer, "p_category" "text", "p_pool_key" "text", "p_selected_answer_index" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."record_play_result"("p_question_id" "uuid", "p_is_correct" boolean, "p_time_taken_ms" integer, "p_category" "text", "p_pool_key" "text", "p_selected_answer_index" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_play_result"("p_question_id" "uuid", "p_is_correct" boolean, "p_time_taken_ms" integer, "p_category" "text", "p_pool_key" "text", "p_selected_answer_index" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."refund_expired_doubt_bounties"() TO "anon";
GRANT ALL ON FUNCTION "public"."refund_expired_doubt_bounties"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_expired_doubt_bounties"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_free_trial_daily_streak_day"("p_day" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_free_trial_daily_streak_day"("p_day" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reset_free_trial_daily_streak_day"("p_day" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_free_trial_daily_streak_day"("p_day" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_subscription_plan_key"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_subscription_plan_key"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_subscription_plan_key"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_doubt_duplicates"("p_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_doubt_duplicates"("p_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_doubt_duplicates"("p_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_classroom_assignment_responses_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_classroom_assignment_responses_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_classroom_assignment_responses_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_gyan_bot_config_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_gyan_bot_config_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_gyan_bot_config_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_lessons_raw_posts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_lessons_raw_posts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_lessons_raw_posts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_rdm_config_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_rdm_config_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_rdm_config_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_teacher_profile_details_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_teacher_profile_details_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_teacher_profile_details_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_can_read_post_via_teacher_nudge"("p_post_id" "uuid", "p_classroom_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_can_read_post_via_teacher_nudge"("p_post_id" "uuid", "p_classroom_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."student_can_read_post_via_teacher_nudge"("p_post_id" "uuid", "p_classroom_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."student_can_read_post_via_teacher_nudge"("p_post_id" "uuid", "p_classroom_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_has_active_grant_for_assignment"("p_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_has_active_grant_for_assignment"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."student_has_active_grant_for_assignment"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."student_has_active_grant_for_assignment"("p_post_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb", "p_domain" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb", "p_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb", "p_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_daily_gauntlet"("p_gauntlet_date" "date", "p_results" "jsonb", "p_domain" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_free_trial_daily_streak_task"("p_day" integer, "p_task_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_free_trial_daily_streak_task"("p_day" integer, "p_task_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_free_trial_daily_streak_task"("p_day" integer, "p_task_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_free_trial_daily_streak_task"("p_day" integer, "p_task_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."teacher_owns_motivation_post"("p_motivation_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."teacher_owns_motivation_post"("p_motivation_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."teacher_owns_motivation_post"("p_motivation_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."teacher_owns_motivation_post"("p_motivation_post_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."toggle_lessons_raw_post_boost"("p_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_lessons_raw_post_boost"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_lessons_raw_post_boost"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_lessons_raw_post_boost"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_refer_challenge_claims_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_refer_challenge_claims_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_refer_challenge_claims_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_member_of_classroom"("cid" "uuid", "uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_member_of_classroom"("cid" "uuid", "uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_member_of_classroom"("cid" "uuid", "uid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vote_lessons_raw_post"("p_post_id" "uuid", "p_click" smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vote_lessons_raw_post"("p_post_id" "uuid", "p_click" smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."vote_lessons_raw_post"("p_post_id" "uuid", "p_click" smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vote_lessons_raw_post"("p_post_id" "uuid", "p_click" smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."vote_on_doubt"("p_target_type" "text", "p_target_id" "uuid", "p_vote_type" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vote_on_doubt"("p_target_type" "text", "p_target_id" "uuid", "p_vote_type" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vote_on_doubt"("p_target_type" "text", "p_target_id" "uuid", "p_vote_type" integer) TO "service_role";



GRANT ALL ON TABLE "public"."accepted_answer_payouts" TO "anon";
GRANT ALL ON TABLE "public"."accepted_answer_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."accepted_answer_payouts" TO "service_role";



GRANT ALL ON TABLE "public"."admin_analytics_cache" TO "anon";
GRANT ALL ON TABLE "public"."admin_analytics_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_analytics_cache" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_user_actions" TO "anon";
GRANT ALL ON TABLE "public"."admin_user_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_user_actions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_token_logs" TO "anon";
GRANT ALL ON TABLE "public"."ai_token_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_token_logs" TO "service_role";



GRANT ALL ON TABLE "public"."approved_emails" TO "anon";
GRANT ALL ON TABLE "public"."approved_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."approved_emails" TO "service_role";



GRANT ALL ON TABLE "public"."buddy_invites" TO "anon";
GRANT ALL ON TABLE "public"."buddy_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_invites" TO "service_role";



GRANT ALL ON TABLE "public"."cbse_mcq_chapters" TO "anon";
GRANT ALL ON TABLE "public"."cbse_mcq_chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."cbse_mcq_chapters" TO "service_role";



GRANT ALL ON TABLE "public"."cbse_mcq_community_share_rdm_claims" TO "anon";
GRANT ALL ON TABLE "public"."cbse_mcq_community_share_rdm_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."cbse_mcq_community_share_rdm_claims" TO "service_role";



GRANT ALL ON TABLE "public"."cbse_mcq_score_bonus_claims" TO "anon";
GRANT ALL ON TABLE "public"."cbse_mcq_score_bonus_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."cbse_mcq_score_bonus_claims" TO "service_role";



GRANT ALL ON TABLE "public"."class_exploration_sessions" TO "anon";
GRANT ALL ON TABLE "public"."class_exploration_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."class_exploration_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_assignment_responses" TO "anon";
GRANT ALL ON TABLE "public"."classroom_assignment_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_assignment_responses" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_assignment_task_progress" TO "anon";
GRANT ALL ON TABLE "public"."classroom_assignment_task_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_assignment_task_progress" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_generated_test_attempts" TO "anon";
GRANT ALL ON TABLE "public"."classroom_generated_test_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_generated_test_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_join_requests" TO "anon";
GRANT ALL ON TABLE "public"."classroom_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_join_requests" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_members" TO "anon";
GRANT ALL ON TABLE "public"."classroom_members" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_members" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_reviews" TO "anon";
GRANT ALL ON TABLE "public"."classroom_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_rating_summary" TO "anon";
GRANT ALL ON TABLE "public"."classroom_rating_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_rating_summary" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_sections" TO "anon";
GRANT ALL ON TABLE "public"."classroom_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_sections" TO "service_role";



GRANT ALL ON TABLE "public"."classrooms" TO "anon";
GRANT ALL ON TABLE "public"."classrooms" TO "authenticated";
GRANT ALL ON TABLE "public"."classrooms" TO "service_role";



GRANT ALL ON TABLE "public"."coupons" TO "anon";
GRANT ALL ON TABLE "public"."coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."coupons" TO "service_role";



GRANT ALL ON TABLE "public"."curriculum_chapters" TO "anon";
GRANT ALL ON TABLE "public"."curriculum_chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."curriculum_chapters" TO "service_role";



GRANT ALL ON TABLE "public"."curriculum_subtopics" TO "anon";
GRANT ALL ON TABLE "public"."curriculum_subtopics" TO "authenticated";
GRANT ALL ON TABLE "public"."curriculum_subtopics" TO "service_role";



GRANT ALL ON TABLE "public"."curriculum_topics" TO "anon";
GRANT ALL ON TABLE "public"."curriculum_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."curriculum_topics" TO "service_role";



GRANT ALL ON TABLE "public"."curriculum_units" TO "anon";
GRANT ALL ON TABLE "public"."curriculum_units" TO "authenticated";
GRANT ALL ON TABLE "public"."curriculum_units" TO "service_role";



GRANT ALL ON TABLE "public"."daily_gauntlet_attempts" TO "anon";
GRANT ALL ON TABLE "public"."daily_gauntlet_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_gauntlet_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."daily_reward_claims" TO "anon";
GRANT ALL ON TABLE "public"."daily_reward_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_reward_claims" TO "service_role";



GRANT ALL ON TABLE "public"."doubt_answer_reports" TO "anon";
GRANT ALL ON TABLE "public"."doubt_answer_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."doubt_answer_reports" TO "service_role";



GRANT ALL ON TABLE "public"."doubt_answers" TO "anon";
GRANT ALL ON TABLE "public"."doubt_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."doubt_answers" TO "service_role";



GRANT ALL ON TABLE "public"."doubt_saves" TO "anon";
GRANT ALL ON TABLE "public"."doubt_saves" TO "authenticated";
GRANT ALL ON TABLE "public"."doubt_saves" TO "service_role";



GRANT ALL ON TABLE "public"."doubt_votes" TO "anon";
GRANT ALL ON TABLE "public"."doubt_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."doubt_votes" TO "service_role";



GRANT ALL ON TABLE "public"."doubts" TO "anon";
GRANT ALL ON TABLE "public"."doubts" TO "authenticated";
GRANT ALL ON TABLE "public"."doubts" TO "service_role";



GRANT ALL ON TABLE "public"."episodic_memory" TO "anon";
GRANT ALL ON TABLE "public"."episodic_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."episodic_memory" TO "service_role";



GRANT ALL ON TABLE "public"."explorer_live_joins" TO "anon";
GRANT ALL ON TABLE "public"."explorer_live_joins" TO "authenticated";
GRANT ALL ON TABLE "public"."explorer_live_joins" TO "service_role";



GRANT ALL ON TABLE "public"."gyan_bot_config" TO "anon";
GRANT ALL ON TABLE "public"."gyan_bot_config" TO "authenticated";
GRANT ALL ON TABLE "public"."gyan_bot_config" TO "service_role";



GRANT ALL ON TABLE "public"."gyan_curriculum_nodes" TO "anon";
GRANT ALL ON TABLE "public"."gyan_curriculum_nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."gyan_curriculum_nodes" TO "service_role";



GRANT ALL ON TABLE "public"."inactive_day_penalties" TO "anon";
GRANT ALL ON TABLE "public"."inactive_day_penalties" TO "authenticated";
GRANT ALL ON TABLE "public"."inactive_day_penalties" TO "service_role";



GRANT ALL ON TABLE "public"."lessons_raw_post_boosts" TO "anon";
GRANT ALL ON TABLE "public"."lessons_raw_post_boosts" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons_raw_post_boosts" TO "service_role";



GRANT ALL ON TABLE "public"."lessons_raw_post_comments" TO "anon";
GRANT ALL ON TABLE "public"."lessons_raw_post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons_raw_post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."lessons_raw_post_votes" TO "anon";
GRANT ALL ON TABLE "public"."lessons_raw_post_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons_raw_post_votes" TO "service_role";



GRANT ALL ON TABLE "public"."lessons_raw_posts" TO "anon";
GRANT ALL ON TABLE "public"."lessons_raw_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons_raw_posts" TO "service_role";



GRANT ALL ON TABLE "public"."live_session_joins" TO "anon";
GRANT ALL ON TABLE "public"."live_session_joins" TO "authenticated";
GRANT ALL ON TABLE "public"."live_session_joins" TO "service_role";



GRANT ALL ON TABLE "public"."live_sessions" TO "anon";
GRANT ALL ON TABLE "public"."live_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."live_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."magic_wall_basket_items" TO "anon";
GRANT ALL ON TABLE "public"."magic_wall_basket_items" TO "authenticated";
GRANT ALL ON TABLE "public"."magic_wall_basket_items" TO "service_role";



GRANT ALL ON TABLE "public"."magic_wall_topic_attempts" TO "anon";
GRANT ALL ON TABLE "public"."magic_wall_topic_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."magic_wall_topic_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."mock_community_share_rdm_claims" TO "anon";
GRANT ALL ON TABLE "public"."mock_community_share_rdm_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."mock_community_share_rdm_claims" TO "service_role";



GRANT ALL ON TABLE "public"."mock_papers" TO "anon";
GRANT ALL ON TABLE "public"."mock_papers" TO "authenticated";
GRANT ALL ON TABLE "public"."mock_papers" TO "service_role";



GRANT ALL ON TABLE "public"."mock_questions" TO "anon";
GRANT ALL ON TABLE "public"."mock_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."mock_questions" TO "service_role";



GRANT ALL ON TABLE "public"."mock_rdm_bonus_attempts" TO "anon";
GRANT ALL ON TABLE "public"."mock_rdm_bonus_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."mock_rdm_bonus_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."mock_rdm_bonus_claims" TO "anon";
GRANT ALL ON TABLE "public"."mock_rdm_bonus_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."mock_rdm_bonus_claims" TO "service_role";



GRANT ALL ON TABLE "public"."mock_test_attempts" TO "anon";
GRANT ALL ON TABLE "public"."mock_test_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."mock_test_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."news_blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."news_blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."news_blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."numerals_community_share_rdm_claims" TO "anon";
GRANT ALL ON TABLE "public"."numerals_community_share_rdm_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."numerals_community_share_rdm_claims" TO "service_role";



GRANT ALL ON TABLE "public"."past_paper_questions" TO "anon";
GRANT ALL ON TABLE "public"."past_paper_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."past_paper_questions" TO "service_role";



GRANT ALL ON TABLE "public"."past_papers" TO "anon";
GRANT ALL ON TABLE "public"."past_papers" TO "authenticated";
GRANT ALL ON TABLE "public"."past_papers" TO "service_role";



GRANT ALL ON TABLE "public"."platform_feedback_submissions" TO "anon";
GRANT ALL ON TABLE "public"."platform_feedback_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_feedback_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."play_history" TO "anon";
GRANT ALL ON TABLE "public"."play_history" TO "authenticated";
GRANT ALL ON TABLE "public"."play_history" TO "service_role";



GRANT ALL ON TABLE "public"."play_questions" TO "anon";
GRANT ALL ON TABLE "public"."play_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."play_questions" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."prep_calendar_day_activity" TO "anon";
GRANT ALL ON TABLE "public"."prep_calendar_day_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."prep_calendar_day_activity" TO "service_role";



GRANT ALL ON TABLE "public"."profile_academics" TO "anon";
GRANT ALL ON TABLE "public"."profile_academics" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_academics" TO "service_role";



GRANT ALL ON TABLE "public"."profile_achievements" TO "anon";
GRANT ALL ON TABLE "public"."profile_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_community_share_rdm_claims" TO "anon";
GRANT ALL ON TABLE "public"."quiz_community_share_rdm_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_community_share_rdm_claims" TO "service_role";



GRANT ALL ON TABLE "public"."rdm_config" TO "anon";
GRANT ALL ON TABLE "public"."rdm_config" TO "authenticated";
GRANT ALL ON TABLE "public"."rdm_config" TO "service_role";



GRANT ALL ON TABLE "public"."refer_challenge_claims" TO "anon";
GRANT ALL ON TABLE "public"."refer_challenge_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."refer_challenge_claims" TO "service_role";



GRANT ALL ON TABLE "public"."referral_attributions" TO "anon";
GRANT ALL ON TABLE "public"."referral_attributions" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_attributions" TO "service_role";



GRANT ALL ON TABLE "public"."referral_weekly_bonuses" TO "anon";
GRANT ALL ON TABLE "public"."referral_weekly_bonuses" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_weekly_bonuses" TO "service_role";



GRANT ALL ON TABLE "public"."saved_questions" TO "anon";
GRANT ALL ON TABLE "public"."saved_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_questions" TO "service_role";



GRANT ALL ON TABLE "public"."student_events" TO "anon";
GRANT ALL ON TABLE "public"."student_events" TO "authenticated";
GRANT ALL ON TABLE "public"."student_events" TO "service_role";



GRANT ALL ON TABLE "public"."student_gyan_presence" TO "anon";
GRANT ALL ON TABLE "public"."student_gyan_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."student_gyan_presence" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_events" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_events" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_events" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2025_12" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2025_12" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2025_12" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_01" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_01" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_01" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_02" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_02" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_02" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_03" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_03" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_03" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_04" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_04" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_04" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_05" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_05" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_05" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_06" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_06" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_06" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_07" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_07" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_07" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_08" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_08" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_08" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_09" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_09" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_09" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_10" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_10" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_10" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_11" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_11" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_11" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2026_12" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_12" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2026_12" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2027_01" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_01" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_01" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2027_02" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_02" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_02" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2027_03" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_03" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_03" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2027_04" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_04" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_04" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2027_05" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_05" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_05" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_dwell_2027_06" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_06" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_dwell_2027_06" TO "service_role";



GRANT ALL ON TABLE "public"."student_learning_presence" TO "anon";
GRANT ALL ON TABLE "public"."student_learning_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."student_learning_presence" TO "service_role";



GRANT ALL ON TABLE "public"."student_lesson_mark_completions" TO "anon";
GRANT ALL ON TABLE "public"."student_lesson_mark_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."student_lesson_mark_completions" TO "service_role";



GRANT ALL ON TABLE "public"."student_section_history" TO "anon";
GRANT ALL ON TABLE "public"."student_section_history" TO "authenticated";
GRANT ALL ON TABLE "public"."student_section_history" TO "service_role";



GRANT ALL ON TABLE "public"."student_site_presence" TO "anon";
GRANT ALL ON TABLE "public"."student_site_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."student_site_presence" TO "service_role";



GRANT ALL ON TABLE "public"."study_buddies" TO "anon";
GRANT ALL ON TABLE "public"."study_buddies" TO "authenticated";
GRANT ALL ON TABLE "public"."study_buddies" TO "service_role";



GRANT ALL ON TABLE "public"."study_streak_milestone_claims" TO "anon";
GRANT ALL ON TABLE "public"."study_streak_milestone_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."study_streak_milestone_claims" TO "service_role";



GRANT ALL ON TABLE "public"."subject_topic_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."subject_topic_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."subject_topic_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_coupons" TO "anon";
GRANT ALL ON TABLE "public"."subscription_coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_coupons" TO "service_role";



GRANT ALL ON TABLE "public"."subtopic_content" TO "anon";
GRANT ALL ON TABLE "public"."subtopic_content" TO "authenticated";
GRANT ALL ON TABLE "public"."subtopic_content" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_generated_test_history" TO "anon";
GRANT ALL ON TABLE "public"."teacher_generated_test_history" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_generated_test_history" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_google_calendar_tokens" TO "anon";
GRANT ALL ON TABLE "public"."teacher_google_calendar_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_google_calendar_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_motivation_rdm_grants" TO "anon";
GRANT ALL ON TABLE "public"."teacher_motivation_rdm_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_motivation_rdm_grants" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_profile_details" TO "anon";
GRANT ALL ON TABLE "public"."teacher_profile_details" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_profile_details" TO "service_role";



GRANT ALL ON TABLE "public"."topic_content" TO "anon";
GRANT ALL ON TABLE "public"."topic_content" TO "authenticated";
GRANT ALL ON TABLE "public"."topic_content" TO "service_role";



GRANT ALL ON TABLE "public"."topic_content_runs" TO "anon";
GRANT ALL ON TABLE "public"."topic_content_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."topic_content_runs" TO "service_role";



GRANT ALL ON TABLE "public"."topic_quiz_advanced_rdm_attempts" TO "anon";
GRANT ALL ON TABLE "public"."topic_quiz_advanced_rdm_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."topic_quiz_advanced_rdm_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."transactional_email_logs" TO "anon";
GRANT ALL ON TABLE "public"."transactional_email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."transactional_email_logs" TO "service_role";



GRANT ALL ON TABLE "public"."user_memory_profile" TO "anon";
GRANT ALL ON TABLE "public"."user_memory_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."user_memory_profile" TO "service_role";



GRANT ALL ON TABLE "public"."user_play_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_play_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_play_stats" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_saved_items" TO "anon";
GRANT ALL ON TABLE "public"."user_saved_items" TO "authenticated";
GRANT ALL ON TABLE "public"."user_saved_items" TO "service_role";



GRANT ALL ON TABLE "public"."user_study_day_totals" TO "anon";
GRANT ALL ON TABLE "public"."user_study_day_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."user_study_day_totals" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist_submissions" TO "anon";
GRANT ALL ON TABLE "public"."waitlist_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist_submissions" TO "service_role";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";




