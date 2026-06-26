-- Teacher plan coupons (Basic = starter, Premium = pro).

CREATE TABLE IF NOT EXISTS public.teacher_subscription_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  plan_tier text NOT NULL,
  duration_months integer NOT NULL,
  restricted_to_teacher_ids uuid[],
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  redeemed_by_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT teacher_subscription_coupons_duration_months_check
    CHECK (duration_months > 0),
  CONSTRAINT teacher_subscription_coupons_plan_tier_check
    CHECK (plan_tier = ANY (ARRAY['starter'::text, 'pro'::text])),
  CONSTRAINT teacher_subscription_coupons_status_check
    CHECK (status = ANY (ARRAY['active'::text, 'redeemed'::text, 'expired'::text]))
);

CREATE INDEX IF NOT EXISTS teacher_subscription_coupons_status_idx
  ON public.teacher_subscription_coupons (status, created_at DESC);

COMMENT ON TABLE public.teacher_subscription_coupons IS
  'Admin-generated teacher plan coupons. Basic=starter, Premium=pro.';

ALTER TABLE public.teacher_subscription_coupons ENABLE ROW LEVEL SECURITY;

-- Teachers claim via API (service role); no direct table access needed for teachers.
