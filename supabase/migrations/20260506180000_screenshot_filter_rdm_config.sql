-- Global client-side screenshot / capture deterrence (Play + Refer challenges).
-- 1 = enabled (default), 0 = disabled. Updated only via admin API (service role).

INSERT INTO public.rdm_config (key, value, description) VALUES
  (
    'screenshot_filter_enabled',
    1,
    'When 1, Play Arena and Earn & Learn arm the screenshot deterrence UI. Admins only; client-enforced.'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;
