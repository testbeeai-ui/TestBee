-- Classroom bulk email invite + rewards.
--
-- 1. Teacher bulk-imports 20+ distinct student emails in one action -> +5,000 RDM flat
--    (once per classroom, on the first qualifying batch).
-- 2. Each invited student who activates a real Razorpay subscription within 7 days of
--    their invite timestamp -> teacher earns +100 RDM (idempotent per recipient row).

INSERT INTO public.rdm_config (key, value, description) VALUES
  ('classroom_bulk_invite_min_students', 20, 'Minimum newly-invited distinct emails in one batch to earn the flat classroom bulk-invite RDM'),
  ('classroom_bulk_invite_flat_rdm', 5000, 'One-time flat RDM when a classroom''s first bulk invite batch reaches the minimum student count'),
  ('classroom_batch_paid_bonus_rdm', 100, 'RDM per invited student who goes paid via Razorpay within the batch paid window'),
  ('classroom_batch_paid_window_days', 7, 'Days after invite timestamp in which a bulk-invited student must go paid for the per-student bonus')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.classroom_invite_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  invited_count integer NOT NULL DEFAULT 0,
  flat_reward_rdm integer NOT NULL DEFAULT 0,
  flat_reward_granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.classroom_invite_batches IS 'One row per teacher bulk-invite action. Flat reward granted at most once per classroom.';

CREATE TABLE IF NOT EXISTS public.classroom_invite_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.classroom_invite_batches(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  linked_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  linked_at timestamptz,
  paid_bonus_awarded_at timestamptz,
  CONSTRAINT classroom_invite_recipients_email_lower CHECK (email = lower(trim(email))),
  CONSTRAINT classroom_invite_recipients_classroom_email_key UNIQUE (classroom_id, email)
);

CREATE INDEX IF NOT EXISTS classroom_invite_recipients_email_idx
  ON public.classroom_invite_recipients (email);

COMMENT ON TABLE public.classroom_invite_recipients IS 'Distinct invited emails per classroom. Inserts via create_classroom_bulk_invite RPC only.';

ALTER TABLE public.classroom_invite_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_invite_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classroom_invite_batches_select_teacher ON public.classroom_invite_batches;
CREATE POLICY classroom_invite_batches_select_teacher ON public.classroom_invite_batches
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS classroom_invite_recipients_select_teacher ON public.classroom_invite_recipients;
CREATE POLICY classroom_invite_recipients_select_teacher ON public.classroom_invite_recipients
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_classroom_bulk_invite(p_classroom_id uuid, p_emails text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_teacher_id uuid;
  v_batch_id uuid;
  v_min_students integer;
  v_flat_rdm integer;
  v_invited_count integer := 0;
  v_skipped integer := 0;
  v_raw text;
  v_norm text;
  v_recipient_id uuid;
  v_already_flat boolean;
  v_new_balance integer;
BEGIN
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_classroom_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_classroom');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = p_classroom_id AND c.teacher_id = v_teacher_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_emails');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'classroom_bulk_invite_min_students'), 20)
  INTO v_min_students;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'classroom_bulk_invite_flat_rdm'), 5000)
  INTO v_flat_rdm;

  v_min_students := GREATEST(1, COALESCE(v_min_students, 20));
  v_flat_rdm := GREATEST(0, COALESCE(v_flat_rdm, 5000));

  INSERT INTO public.classroom_invite_batches (teacher_id, classroom_id, invited_count)
  VALUES (v_teacher_id, p_classroom_id, 0)
  RETURNING id INTO v_batch_id;

  FOREACH v_raw IN ARRAY p_emails
  LOOP
    v_norm := lower(trim(coalesce(v_raw, '')));
    IF v_norm = '' OR v_norm !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.classroom_invite_recipients (
      batch_id, classroom_id, teacher_id, email, invited_at
    ) VALUES (
      v_batch_id, p_classroom_id, v_teacher_id, v_norm, now()
    )
    ON CONFLICT (classroom_id, email) DO NOTHING
    RETURNING id INTO v_recipient_id;

    IF v_recipient_id IS NOT NULL THEN
      v_invited_count := v_invited_count + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  UPDATE public.classroom_invite_batches
  SET invited_count = v_invited_count
  WHERE id = v_batch_id;

  SELECT EXISTS (
    SELECT 1 FROM public.classroom_invite_batches b
    WHERE b.classroom_id = p_classroom_id
      AND b.flat_reward_granted = true
      AND b.id <> v_batch_id
  ) INTO v_already_flat;

  IF v_invited_count >= v_min_students AND NOT v_already_flat THEN
    v_new_balance := public.add_rdm(v_teacher_id, v_flat_rdm);
    UPDATE public.classroom_invite_batches
    SET flat_reward_granted = true,
        flat_reward_rdm = v_flat_rdm
    WHERE id = v_batch_id;

    RETURN jsonb_build_object(
      'ok', true,
      'batch_id', v_batch_id,
      'invited_count', v_invited_count,
      'skipped', v_skipped,
      'flat_reward_rdm', v_flat_rdm,
      'balance', v_new_balance
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'invited_count', v_invited_count,
    'skipped', v_skipped,
    'flat_reward_rdm', 0
  );
END;
$$;

COMMENT ON FUNCTION public.create_classroom_bulk_invite(uuid, text[]) IS 'Teacher bulk-invites student emails to a classroom. Grants flat RDM once per classroom when newly-invited count meets classroom_bulk_invite_min_students.';

CREATE OR REPLACE FUNCTION public.link_my_classroom_invites()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_linked_count integer := 0;
  rec RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT lower(trim(email)) INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('ok', true, 'linked', 0);
  END IF;

  FOR rec IN
    SELECT id, classroom_id
    FROM public.classroom_invite_recipients
    WHERE email = v_email
      AND linked_user_id IS NULL
  LOOP
    UPDATE public.classroom_invite_recipients
    SET linked_user_id = v_user_id,
        linked_at = now()
    WHERE id = rec.id;

    INSERT INTO public.classroom_members (classroom_id, user_id, role)
    VALUES (rec.classroom_id, v_user_id, 'student')
    ON CONFLICT (classroom_id, user_id) DO NOTHING;

    v_linked_count := v_linked_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'linked', v_linked_count);
END;
$$;

COMMENT ON FUNCTION public.link_my_classroom_invites() IS 'Links the signed-in user email to pending classroom bulk invites and auto-enrolls them as students.';

CREATE OR REPLACE FUNCTION public.award_classroom_batch_paid_bonus(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_email text;
  v_bonus integer;
  v_window_days integer;
  v_awarded_count integer := 0;
  v_total_rdm integer := 0;
  rec RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_user');
  END IF;

  SELECT lower(trim(email)) INTO v_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('ok', true, 'awarded', 0, 'amount', 0);
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'classroom_batch_paid_bonus_rdm'), 100)
  INTO v_bonus;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'classroom_batch_paid_window_days'), 7)
  INTO v_window_days;

  v_bonus := GREATEST(0, COALESCE(v_bonus, 100));
  v_window_days := GREATEST(0, COALESCE(v_window_days, 7));

  FOR rec IN
    SELECT r.id, r.teacher_id, r.invited_at
    FROM public.classroom_invite_recipients r
    WHERE r.email = v_email
      AND r.paid_bonus_awarded_at IS NULL
      AND now() <= r.invited_at + make_interval(days => v_window_days)
    FOR UPDATE
  LOOP
    PERFORM public.add_rdm(rec.teacher_id, v_bonus);

    UPDATE public.classroom_invite_recipients
    SET paid_bonus_awarded_at = now(),
        linked_user_id = COALESCE(linked_user_id, p_user_id),
        linked_at = COALESCE(linked_at, now())
    WHERE id = rec.id;

    v_awarded_count := v_awarded_count + 1;
    v_total_rdm := v_total_rdm + v_bonus;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'awarded', v_awarded_count,
    'amount', v_total_rdm
  );
END;
$$;

COMMENT ON FUNCTION public.award_classroom_batch_paid_bonus(uuid) IS 'Grants classroom_batch_paid_bonus_rdm per bulk-invite recipient when the student pays via Razorpay within classroom_batch_paid_window_days of invited_at. Idempotent per recipient row.';

ALTER FUNCTION public.create_classroom_bulk_invite(uuid, text[]) OWNER TO postgres;
ALTER FUNCTION public.link_my_classroom_invites() OWNER TO postgres;
ALTER FUNCTION public.award_classroom_batch_paid_bonus(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_classroom_bulk_invite(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_classroom_bulk_invite(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_classroom_bulk_invite(uuid, text[]) TO service_role;

REVOKE ALL ON FUNCTION public.link_my_classroom_invites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_my_classroom_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_my_classroom_invites() TO service_role;

REVOKE ALL ON FUNCTION public.award_classroom_batch_paid_bonus(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_classroom_batch_paid_bonus(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_classroom_batch_paid_bonus(uuid) TO service_role;
