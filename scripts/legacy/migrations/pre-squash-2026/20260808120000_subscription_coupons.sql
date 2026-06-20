-- Student plan coupons: grant starter/pro for N months
CREATE TABLE IF NOT EXISTS public.subscription_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    plan_tier TEXT NOT NULL CHECK (plan_tier IN ('starter', 'pro')),
    duration_months INTEGER NOT NULL CHECK (duration_months > 0),
    restricted_to_user_ids UUID[] DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    redeemed_at TIMESTAMPTZ DEFAULT NULL,
    redeemed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.subscription_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_coupons_admin_all ON public.subscription_coupons;
DROP POLICY IF EXISTS subscription_coupons_user_read ON public.subscription_coupons;

CREATE POLICY subscription_coupons_admin_all ON public.subscription_coupons
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    ));

CREATE POLICY subscription_coupons_user_read ON public.subscription_coupons
    FOR SELECT
    TO authenticated
    USING (
        restricted_to_user_ids IS NULL
        OR auth.uid() = ANY(restricted_to_user_ids)
    );

GRANT ALL ON public.subscription_coupons TO service_role;
GRANT SELECT ON public.subscription_coupons TO authenticated;
