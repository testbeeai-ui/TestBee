-- Teacher action refunds must match a real charge.
-- Paid RDM packs are tracked separately from earned RDM.
-- Spending uses the oldest paid pack first, so a new unused pack can still be refunded.

CREATE TABLE IF NOT EXISTS public.teacher_rdm_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  action text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  refunded_at timestamptz
);

CREATE INDEX IF NOT EXISTS teacher_rdm_charges_teacher_idx
  ON public.teacher_rdm_charges (teacher_id, created_at DESC);

ALTER TABLE public.teacher_rdm_charges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.teacher_rdm_charges FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.rdm_pack_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  pack_id text NOT NULL,
  rdm_granted integer NOT NULL CHECK (rdm_granted > 0),
  rdm_unspent integer NOT NULL CHECK (rdm_unspent >= 0),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded')),
  razorpay_refund_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  refunded_at timestamptz,
  CONSTRAINT rdm_pack_purchases_unspent_lte_granted CHECK (rdm_unspent <= rdm_granted)
);

CREATE INDEX IF NOT EXISTS rdm_pack_purchases_teacher_idx
  ON public.rdm_pack_purchases (teacher_id, created_at DESC);

ALTER TABLE public.rdm_pack_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rdm_pack_purchases FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.deduct_rdm(uid uuid, amt integer) RETURNS integer
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
BEGIN
  IF uid IS NULL OR amt IS NULL OR amt <= 0 THEN
    RETURN NULL;
  END IF;

  v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
  PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
  UPDATE public.profiles
  SET rdm = COALESCE(rdm, 0) - amt
  WHERE id = uid AND COALESCE(rdm, 0) >= amt
  RETURNING rdm INTO new_balance;

  IF new_balance IS NULL THEN
    IF v_prev IS NULL THEN
      PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
    ELSE
      PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
    END IF;
    RETURN NULL;
  END IF;

  -- Purchased packs are spent before earned RDM. Oldest pack first, so a newer unused pack stays refundable.
  v_left := amt;
  FOR rec IN
    SELECT id, rdm_unspent
    FROM public.rdm_pack_purchases
    WHERE teacher_id = uid
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
    v_left := v_left - v_take;
  END LOOP;

  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;
  RETURN new_balance;
END;
$$;

COMMENT ON FUNCTION public.deduct_rdm(uuid, integer) IS
  'Deduct RDM. Purchased pack credits are consumed oldest-first before earned RDM. Returns new balance or NULL if insufficient.';

REVOKE ALL ON FUNCTION public.deduct_rdm(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_rdm(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_teacher_rdm_charge(p_charge_id uuid, p_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_amount integer;
  v_balance integer;
BEGIN
  IF p_charge_id IS NULL OR p_teacher_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_charge');
  END IF;

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

REVOKE ALL ON FUNCTION public.refund_teacher_rdm_charge(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_teacher_rdm_charge(uuid, uuid) TO service_role;

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

REVOKE ALL ON FUNCTION public.finalize_rdm_pack_refund(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_rdm_pack_refund(uuid, uuid, text) TO service_role;
