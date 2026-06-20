-- Add time_travel columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS time_travel_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS time_travel_offset_ms bigint NOT NULL DEFAULT 0;

-- Add global time travel config to rdm_config
INSERT INTO public.rdm_config (key, value, description)
VALUES ('global_time_travel_enabled', 0, 'Toggle global developer time-travel mode for all students (0 = disabled, 1 = enabled)')
ON CONFLICT (key) DO NOTHING;
