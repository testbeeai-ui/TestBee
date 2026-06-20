-- Migration: Add magic_wall_max_topics to rdm_config
-- This key controls the maximum number of topics a free-trial student can select on the Magic Wall.
-- Admins always get 5 regardless of this value.

INSERT INTO public.rdm_config (key, value, description)
VALUES ('magic_wall_max_topics', 3, 'Max topics a free-trial student can select on Magic Wall')
ON CONFLICT (key) DO NOTHING;
