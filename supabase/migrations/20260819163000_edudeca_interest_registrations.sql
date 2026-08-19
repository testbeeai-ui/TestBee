-- Public /edudeca waitlist. One row per Gmail; re-submit overwrites.
CREATE TABLE IF NOT EXISTS public.edudeca_interest_registrations (
  email         text PRIMARY KEY CHECK (email ~* '^[^[:space:]@]+@gmail\.com$'),
  class_level   smallint NOT NULL CHECK (class_level IN (11, 12)),
  institution   text NOT NULL CHECK (char_length(btrim(institution)) >= 2),
  state         text NOT NULL CHECK (char_length(btrim(state)) > 0),
  city          text NOT NULL CHECK (char_length(btrim(city)) > 0),
  registered_at timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edudeca_interest_registrations ENABLE ROW LEVEL SECURITY;
