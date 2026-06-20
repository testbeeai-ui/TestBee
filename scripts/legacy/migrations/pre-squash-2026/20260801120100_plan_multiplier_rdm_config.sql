-- Migration: Insert dynamic plan multiplier config keys into rdm_config.
-- All values expressed as integer percentages (e.g. 50 = 0.50x, 100 = 1.00x).
-- Admins can edit these at will via Admin → Subscriptions tab.

INSERT INTO public.rdm_config (key, value, description)
VALUES
  (
    'free_rdm_multiplier_pct',
    25,
    'Free Plan RDM multiplier percentage. Default = 25 (0.25x).'
  ),
  (
    'free_trial_rdm_multiplier_pct',
    25,
    'Free Trial RDM multiplier percentage. Applied to all earned RDM during the 28-day trial. Default = 25 (0.25x).'
  ),
  (
    'starter_rdm_multiplier_months_1_3_pct',
    50,
    'Starter Plan RDM multiplier % for subscription months 1–3 (ramp-in). Default = 50 (0.50x).'
  ),
  (
    'starter_rdm_multiplier_months_4_plus_pct',
    100,
    'Starter Plan RDM multiplier % for subscription month 4 onwards (full rate). Default = 100 (1.00x).'
  ),
  (
    'pro_rdm_multiplier_months_1_5_pct',
    100,
    'Pro Plan RDM multiplier % for subscription months 1–5 (full rate from day 1). Default = 100 (1.00x).'
  ),
  (
    'pro_rdm_multiplier_months_6_11_pct',
    150,
    'Pro Plan RDM multiplier % for subscription months 6–11 (6-month loyalty bonus). Default = 150 (1.50x).'
  ),
  (
    'pro_rdm_multiplier_months_12_plus_pct',
    200,
    'Pro Plan RDM multiplier % for subscription month 12 onwards (year-long loyalty bonus). Default = 200 (2.00x).'
  )
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;
