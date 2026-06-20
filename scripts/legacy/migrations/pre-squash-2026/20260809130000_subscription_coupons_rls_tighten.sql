-- Students may only read coupons explicitly assigned to them (not bulk public codes).

DROP POLICY IF EXISTS subscription_coupons_user_read ON public.subscription_coupons;

CREATE POLICY subscription_coupons_user_read ON public.subscription_coupons
  FOR SELECT
  TO authenticated
  USING (
    restricted_to_user_ids IS NOT NULL
    AND auth.uid() = ANY(restricted_to_user_ids)
  );
