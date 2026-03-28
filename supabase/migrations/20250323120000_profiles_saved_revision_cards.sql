-- User InstaCue / revision flashcards (saved via + or bookmark), per profile.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saved_revision_cards jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.saved_revision_cards IS 'User-saved InstaCue revision cards; seeded catalog cards are not stored here.';
