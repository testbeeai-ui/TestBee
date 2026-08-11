-- Preview / fresh DBs: later June migrations INSERT into rdm_config before the
-- Sept baseline CREATE TABLE runs. Ensure the table exists first (no-op on prod).

CREATE TABLE IF NOT EXISTS public.rdm_config (
  key text NOT NULL,
  value integer NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rdm_config_pkey PRIMARY KEY (key)
);

COMMENT ON TABLE public.rdm_config IS
  'Dynamic configuration for RDM rewards (referrals, challenges, etc.). Editable by admins.';
