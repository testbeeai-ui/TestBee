-- Teacher RDM coupons: do not expose public promotional codes through direct
-- Supabase SELECTs. Public promo codes remain redeemable when the code is
-- distributed out-of-band; only assigned/purchased rows are listable by users.

DROP POLICY IF EXISTS user_read ON public.coupons;

CREATE POLICY user_read ON public.coupons
  FOR SELECT
  TO authenticated
  USING (
    bought_by_teacher_id = auth.uid()
    OR (
      restricted_to_teacher_ids IS NOT NULL
      AND auth.uid() = ANY(restricted_to_teacher_ids)
    )
  );
