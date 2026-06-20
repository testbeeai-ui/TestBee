-- PostgreSQL rule: params with DEFAULT must come after required params.
-- Required first (p_title, p_body, p_subject), then optional (p_cost_rdm, p_bounty_rdm with DEFAULTs).
DROP FUNCTION IF EXISTS public.create_doubt_with_escrow(text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.create_doubt_with_escrow(text, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.create_doubt_with_escrow(
  p_title text,
  p_body text,
  p_subject text,
  p_cost_rdm integer DEFAULT 0,
  p_bounty_rdm integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total integer;
  v_new_id uuid;
  v_balance integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  v_total := GREATEST(0, p_cost_rdm) + GREATEST(0, p_bounty_rdm);
  IF v_total > 0 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_user_id;
    IF (v_balance IS NULL OR v_balance < v_total) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Insufficient RDM');
    END IF;
    UPDATE public.profiles SET rdm = rdm - v_total WHERE id = v_user_id;
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
  RETURN jsonb_build_object('ok', true, 'id', v_new_id);
END;
$$;

COMMENT ON FUNCTION public.create_doubt_with_escrow IS 'Create doubt; deduct cost and bounty from asker; escrow bounty.';
