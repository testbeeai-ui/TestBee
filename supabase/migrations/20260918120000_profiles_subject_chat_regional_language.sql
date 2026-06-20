-- Pro lesson chat: one immutable regional language per user (English + chosen regional).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subject_chat_regional_language text NULL,
  ADD COLUMN IF NOT EXISTS subject_chat_regional_language_locked_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_subject_chat_regional_language_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_subject_chat_regional_language_check
      CHECK (
        subject_chat_regional_language IS NULL
        OR subject_chat_regional_language IN ('hi', 'kn', 'ta', 'te')
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_subject_chat_regional_language(p_language text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid;
  v_plan text;
  v_multilingual int;
  v_existing text;
  v_lang text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  v_lang := lower(trim(coalesce(p_language, '')));
  IF v_lang NOT IN ('hi', 'kn', 'ta', 'te') THEN
    RAISE EXCEPTION 'INVALID_LANGUAGE';
  END IF;

  SELECT subject_chat_regional_language INTO v_existing
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_LOCKED';
  END IF;

  v_plan := public.resolve_subscription_plan_key(v_user_id);

  SELECT coalesce(value, 0)::int INTO v_multilingual
  FROM public.rdm_config
  WHERE key = v_plan || '_subject_chat_multilingual';

  IF coalesce(v_multilingual, 0) <= 0 THEN
    RAISE EXCEPTION 'NOT_PRO';
  END IF;

  UPDATE public.profiles
  SET
    subject_chat_regional_language = v_lang,
    subject_chat_regional_language_locked_at = now(),
    updated_at = now()
  WHERE id = v_user_id
    AND subject_chat_regional_language IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ALREADY_LOCKED';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'regionalLanguage', v_lang,
    'locked', true
  );
END;
$$;

ALTER FUNCTION public.set_subject_chat_regional_language(text) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.set_subject_chat_regional_language(text) TO authenticated;

COMMENT ON FUNCTION public.set_subject_chat_regional_language(text) IS
  'One-time lock of Pro lesson-chat regional language (hi/kn/ta/te). English remains available; other regional langs stay locked.';
