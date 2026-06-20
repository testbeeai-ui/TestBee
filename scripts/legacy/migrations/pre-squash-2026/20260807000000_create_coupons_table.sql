-- Create coupons table for promotional and purchased RDM credits
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    rdm_amount INTEGER NOT NULL,
    restricted_to_teacher_ids UUID[] DEFAULT NULL,
    is_purchased BOOLEAN NOT NULL DEFAULT false,
    bought_by_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    redeemed_at TIMESTAMPTZ DEFAULT NULL,
    redeemed_by_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_id TEXT DEFAULT NULL,
    payment_method TEXT DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS admin_all ON public.coupons;
DROP POLICY IF EXISTS user_read ON public.coupons;

-- Create policies:
-- Admins can do anything on coupons
CREATE POLICY admin_all ON public.coupons
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    ));

-- Teachers/users can select/read coupons that they are allowed to redeem or that they bought
CREATE POLICY user_read ON public.coupons
    FOR SELECT
    TO authenticated
    USING (
        is_purchased = false OR 
        bought_by_teacher_id = auth.uid() OR
        auth.uid() = ANY(restricted_to_teacher_ids)
    );

-- Grant privileges
GRANT ALL ON public.coupons TO service_role;
GRANT SELECT ON public.coupons TO authenticated;
