-- Pack refunds must reserve the wallet before Razorpay pays out.
-- Charge refunds must put purchased credits back on the pack they came from.
-- A paid pack and its wallet credit commit together.
-- Saved catalog questions can reveal their own answer key for revision.

ALTER TABLE public.rdm_pack_purchases DROP CONSTRAINT IF EXISTS rdm_pack_purchases_status_check;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'rdm_pack_purchases'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.rdm_pack_purchases DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.rdm_pack_purchases
  ADD CONSTRAINT rdm_pack_purchases_status_check
  CHECK (status IN ('paid', 'refund_pending', 'refunded'));

CREATE TABLE IF NOT EXISTS public.teacher_rdm_charge_pack_alloc (
  charge_id uuid NOT NULL REFERENCES public.teacher_rdm_charges(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.rdm_pack_purchases(id),
  amount integer NOT NULL CHECK (amount > 0),
  PRIMARY KEY (charge_id, purchase_id)
);

ALTER TABLE public.teacher_rdm_charge_pack_alloc ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.teacher_rdm_charge_pack_alloc FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_rdm_pack_refund(
  p_purchase_id uuid,
  p_teacher_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  rec public.rdm_pack_purchases%ROWTYPE;
  v_balance integer;
  v_prev text;
BEGIN
  IF p_purchase_id IS NULL OR p_teacher_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_purchase');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_teacher_id FOR UPDATE;

  SELECT * INTO rec
  FROM public.rdm_pack_purchases
  WHERE id = p_purchase_id AND teacher_id = p_teacher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF rec.status = 'refunded' THEN
    RETURN jsonb_build_object('ok', true, 'already_refunded', true);
  END IF;

  IF rec.status = 'refund_pending' THEN
    IF rec.rdm_unspent <> rec.rdm_granted THEN
      RETURN jsonb_build_object('ok', false, 'error', 'pack_used');
    END IF;
    RETURN jsonb_build_object('ok', true, 'reserved', true, 'already_reserved', true);
  END IF;

  IF rec.status <> 'paid' OR rec.rdm_unspent <> rec.rdm_granted THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pack_used');
  END IF;

  v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
  PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
  UPDATE public.profiles
  SET rdm = COALESCE(rdm, 0) - rec.rdm_granted
  WHERE id = p_teacher_id AND COALESCE(rdm, 0) >= rec.rdm_granted
  RETURNING rdm INTO v_balance;

  IF v_balance IS NULL THEN
    IF v_prev IS NULL THEN
      PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
    ELSE
      PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  END IF;

  UPDATE public.rdm_pack_purchases
  SET status = 'refund_pending'
  WHERE id = rec.id;

  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reserved', true,
    'already_reserved', false,
    'rdm', v_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_rdm_pack_refund(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_rdm_pack_refund(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.release_rdm_pack_refund(
  p_purchase_id uuid,
  p_teacher_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  rec public.rdm_pack_purchases%ROWTYPE;
  v_balance integer;
BEGIN
  IF p_purchase_id IS NULL OR p_teacher_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_purchase');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_teacher_id FOR UPDATE;

  SELECT * INTO rec
  FROM public.rdm_pack_purchases
  WHERE id = p_purchase_id AND teacher_id = p_teacher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF rec.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'released', false);
  END IF;

  IF rec.status <> 'refund_pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  v_balance := public.add_rdm(p_teacher_id, rec.rdm_granted);
  UPDATE public.rdm_pack_purchases
  SET status = 'paid'
  WHERE id = rec.id AND status = 'refund_pending';

  RETURN jsonb_build_object('ok', true, 'released', true, 'rdm', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.release_rdm_pack_refund(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_rdm_pack_refund(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_rdm_pack_refund(
  p_purchase_id uuid,
  p_teacher_id uuid,
  p_razorpay_refund_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  rec public.rdm_pack_purchases%ROWTYPE;
  v_balance integer;
  v_prev text;
BEGIN
  IF p_purchase_id IS NULL OR p_teacher_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_purchase');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_teacher_id FOR UPDATE;

  SELECT * INTO rec
  FROM public.rdm_pack_purchases
  WHERE id = p_purchase_id AND teacher_id = p_teacher_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF rec.status = 'refunded' THEN
    RETURN jsonb_build_object('ok', true, 'already_refunded', true, 'rdm', NULL);
  END IF;

  IF rec.status = 'refund_pending' THEN
    IF rec.rdm_unspent <> rec.rdm_granted THEN
      RETURN jsonb_build_object('ok', false, 'error', 'pack_used');
    END IF;

    UPDATE public.rdm_pack_purchases
    SET rdm_unspent = 0,
        status = 'refunded',
        refunded_at = now(),
        razorpay_refund_id = NULLIF(trim(coalesce(p_razorpay_refund_id, '')), '')
    WHERE id = rec.id;

    SELECT COALESCE(rdm, 0) INTO v_balance
    FROM public.profiles
    WHERE id = p_teacher_id;

    RETURN jsonb_build_object(
      'ok', true,
      'already_refunded', false,
      'rdm', v_balance,
      'amount_paise', rec.amount_paise,
      'rdm_removed', rec.rdm_granted
    );
  END IF;

  IF rec.status <> 'paid' OR rec.rdm_unspent <> rec.rdm_granted THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pack_used');
  END IF;

  v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
  PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
  UPDATE public.profiles
  SET rdm = COALESCE(rdm, 0) - rec.rdm_granted
  WHERE id = p_teacher_id AND COALESCE(rdm, 0) >= rec.rdm_granted
  RETURNING rdm INTO v_balance;

  IF v_balance IS NULL THEN
    IF v_prev IS NULL THEN
      PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
    ELSE
      PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  END IF;

  UPDATE public.rdm_pack_purchases
  SET rdm_unspent = 0,
      status = 'refunded',
      refunded_at = now(),
      razorpay_refund_id = NULLIF(trim(coalesce(p_razorpay_refund_id, '')), '')
  WHERE id = rec.id;

  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_refunded', false,
    'rdm', v_balance,
    'amount_paise', rec.amount_paise,
    'rdm_removed', rec.rdm_granted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_teacher_rdm(
  p_teacher_id uuid,
  p_action text,
  p_amount integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  new_balance integer;
  v_prev text;
  v_left integer;
  rec record;
  v_take integer;
  v_allocs jsonb := '[]'::jsonb;
  v_charge_id uuid;
  v_item jsonb;
BEGIN
  IF p_teacher_id IS NULL OR p_action IS NULL OR length(trim(p_action)) = 0 OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_charge');
  END IF;

  v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
  PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
  UPDATE public.profiles
  SET rdm = COALESCE(rdm, 0) - p_amount
  WHERE id = p_teacher_id AND COALESCE(rdm, 0) >= p_amount
  RETURNING rdm INTO new_balance;

  IF new_balance IS NULL THEN
    IF v_prev IS NULL THEN
      PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
    ELSE
      PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient');
  END IF;

  v_left := p_amount;
  FOR rec IN
    SELECT id, rdm_unspent
    FROM public.rdm_pack_purchases
    WHERE teacher_id = p_teacher_id
      AND status = 'paid'
      AND rdm_unspent > 0
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(v_left, rec.rdm_unspent);
    UPDATE public.rdm_pack_purchases
    SET rdm_unspent = rdm_unspent - v_take
    WHERE id = rec.id;
    v_allocs := v_allocs || jsonb_build_array(jsonb_build_object(
      'purchase_id', rec.id,
      'amount', v_take
    ));
    v_left := v_left - v_take;
  END LOOP;

  INSERT INTO public.teacher_rdm_charges (teacher_id, action, amount)
  VALUES (p_teacher_id, p_action, p_amount)
  RETURNING id INTO v_charge_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_allocs)
  LOOP
    INSERT INTO public.teacher_rdm_charge_pack_alloc (charge_id, purchase_id, amount)
    VALUES (
      v_charge_id,
      (v_item->>'purchase_id')::uuid,
      (v_item->>'amount')::integer
    );
  END LOOP;

  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'rdm', new_balance,
    'charge_id', v_charge_id,
    'amount', p_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.charge_teacher_rdm(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_teacher_rdm(uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_teacher_rdm_charge(p_charge_id uuid, p_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_amount integer;
  v_balance integer;
  v_alloc_count integer;
  rec record;
  v_left integer;
  v_room integer;
  v_give integer;
BEGIN
  IF p_charge_id IS NULL OR p_teacher_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_charge');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_teacher_id FOR UPDATE;

  UPDATE public.teacher_rdm_charges
  SET refunded_at = now()
  WHERE id = p_charge_id
    AND teacher_id = p_teacher_id
    AND refunded_at IS NULL
  RETURNING amount INTO v_amount;

  IF v_amount IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.teacher_rdm_charges
      WHERE id = p_charge_id AND teacher_id = p_teacher_id AND refunded_at IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('ok', true, 'already_refunded', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'charge_not_found');
  END IF;

  SELECT COUNT(*)::integer INTO v_alloc_count
  FROM public.teacher_rdm_charge_pack_alloc
  WHERE charge_id = p_charge_id;

  IF v_alloc_count > 0 THEN
    FOR rec IN
      SELECT purchase_id, amount
      FROM public.teacher_rdm_charge_pack_alloc
      WHERE charge_id = p_charge_id
    LOOP
      UPDATE public.rdm_pack_purchases
      SET rdm_unspent = LEAST(rdm_granted, rdm_unspent + rec.amount)
      WHERE id = rec.purchase_id
        AND teacher_id = p_teacher_id
        AND status = 'paid';
    END LOOP;
  ELSE
    v_left := v_amount;
    FOR rec IN
      SELECT id, rdm_granted, rdm_unspent
      FROM public.rdm_pack_purchases
      WHERE teacher_id = p_teacher_id
        AND status = 'paid'
        AND rdm_unspent < rdm_granted
      ORDER BY created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_left <= 0;
      v_room := rec.rdm_granted - rec.rdm_unspent;
      v_give := LEAST(v_left, v_room);
      UPDATE public.rdm_pack_purchases
      SET rdm_unspent = rdm_unspent + v_give
      WHERE id = rec.id;
      v_left := v_left - v_give;
    END LOOP;
  END IF;

  v_balance := public.add_rdm(p_teacher_id, v_amount);
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'rdm_refund_failed';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'amount', v_amount,
    'rdm', v_balance,
    'already_refunded', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_rdm_pack_purchase(
  p_teacher_id uuid,
  p_coupon_id uuid,
  p_pack_id text,
  p_amount_paise integer,
  p_razorpay_order_id text,
  p_razorpay_payment_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_balance integer;
  v_already boolean;
BEGIN
  IF p_teacher_id IS NULL OR p_coupon_id IS NULL
     OR p_pack_id IS NULL OR length(trim(p_pack_id)) = 0
     OR p_amount_paise IS NULL OR p_amount_paise <= 0
     OR p_razorpay_order_id IS NULL OR length(trim(p_razorpay_order_id)) = 0
     OR p_razorpay_payment_id IS NULL OR length(trim(p_razorpay_payment_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_purchase');
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'coupon_not_found');
  END IF;

  IF v_coupon.bought_by_teacher_id IS DISTINCT FROM p_teacher_id
     OR v_coupon.order_id IS DISTINCT FROM p_razorpay_order_id
     OR v_coupon.rdm_amount IS NULL
     OR v_coupon.rdm_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'coupon_mismatch');
  END IF;

  INSERT INTO public.rdm_pack_purchases (
    teacher_id,
    pack_id,
    rdm_granted,
    rdm_unspent,
    amount_paise,
    razorpay_order_id,
    razorpay_payment_id,
    status
  ) VALUES (
    p_teacher_id,
    p_pack_id,
    v_coupon.rdm_amount,
    v_coupon.rdm_amount,
    p_amount_paise,
    p_razorpay_order_id,
    p_razorpay_payment_id,
    'paid'
  )
  ON CONFLICT (razorpay_order_id) DO NOTHING;

  v_already := v_coupon.balance_applied_at IS NOT NULL;
  IF v_already THEN
    SELECT COALESCE(rdm, 0) INTO v_balance
    FROM public.profiles
    WHERE id = p_teacher_id;
  ELSE
    v_balance := public.add_rdm(p_teacher_id, v_coupon.rdm_amount);
    UPDATE public.coupons
    SET balance_applied_at = now(),
        status = 'redeemed',
        redeemed_at = COALESCE(v_coupon.redeemed_at, now()),
        redeemed_by_teacher_id = COALESCE(v_coupon.redeemed_by_teacher_id, p_teacher_id)
    WHERE id = v_coupon.id;
  END IF;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'rdm_credit_failed';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'rdm', v_balance,
    'already_credited', v_already
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commit_rdm_pack_purchase(uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_rdm_pack_purchase(uuid, uuid, text, integer, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reveal_saved_catalog_questions(p_source text, p_ids jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_out jsonb;
  v_ids uuid[];
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('mock', 'past_paper')
     OR jsonb_typeof(p_ids) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_ids) < 1
     OR jsonb_array_length(p_ids) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_ids
  FROM (
    SELECT trim(value)::uuid AS id
    FROM jsonb_array_elements_text(p_ids)
    WHERE trim(value) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) parsed;

  IF p_source = 'mock' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', q.id,
      'correct_index', CASE
        WHEN ascii(upper(left(trim(q.correct_letter), 1))) - 65 BETWEEN 0 AND 3
        THEN ascii(upper(left(trim(q.correct_letter), 1))) - 65
        ELSE 0
      END,
      'solution_html', q.solution_html
    )), '[]'::jsonb)
    INTO v_out
    FROM public.mock_questions q
    JOIN public.saved_questions s
      ON s.question_id = q.id
     AND s.user_id = v_user
     AND s.source_type = 'mock'
    WHERE q.id = ANY(v_ids)
      AND NULLIF(trim(q.correct_letter), '') IS NOT NULL;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', q.id,
      'correct_index', CASE
        WHEN ascii(upper(left(trim(q.correct_letter), 1))) - 65 BETWEEN 0 AND 3
        THEN ascii(upper(left(trim(q.correct_letter), 1))) - 65
        ELSE 0
      END,
      'solution_html', q.solution_html
    )), '[]'::jsonb)
    INTO v_out
    FROM public.past_paper_questions q
    JOIN public.saved_questions s
      ON s.question_id = q.id
     AND s.user_id = v_user
     AND s.source_type = 'past_paper'
    WHERE q.id = ANY(v_ids)
      AND NULLIF(trim(q.correct_letter), '') IS NOT NULL;
  END IF;

  RETURN jsonb_build_object('ok', true, 'results', v_out);
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_saved_catalog_questions(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reveal_saved_catalog_questions(text, jsonb) TO authenticated, service_role;
