-- Migrate saved items from JSONB arrays on profiles to a dedicated table.
-- Each saved item becomes its own row with indexed columns for fast queries.

CREATE TABLE public.user_saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN (
    'saved_bit', 'saved_formula', 'saved_revision_card',
    'saved_revision_unit', 'saved_community_post'
  )),
  content_id text NOT NULL,       -- original "id" from the JSONB item
  subject text,                   -- denormalized for fast WHERE/grouping
  status text,                    -- only for revision cards (unsure/tomorrow/know_it/new)
  saved_at timestamptz,           -- denormalized for range queries (daily checklist)
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, content_id)
);

-- Main lookup: user's items by type, newest first
CREATE INDEX idx_user_saved_items_user_type
  ON public.user_saved_items (user_id, item_type, created_at DESC);

-- Revision card status filter (due badge, retention %)
CREATE INDEX idx_user_saved_items_user_type_status
  ON public.user_saved_items (user_id, item_type, status)
  WHERE item_type = 'saved_revision_card';

-- Daily checklist: cards saved in a date range
CREATE INDEX idx_user_saved_items_user_saved_at
  ON public.user_saved_items (user_id, item_type, saved_at DESC)
  WHERE saved_at IS NOT NULL;

-- RLS: owner-only access
ALTER TABLE public.user_saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own saved items"
  ON public.user_saved_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own saved items"
  ON public.user_saved_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own saved items"
  ON public.user_saved_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own saved items"
  ON public.user_saved_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Backfill: migrate existing JSONB arrays into the new table
-- ON CONFLICT DO NOTHING — safe to re-run

DO $$
DECLARE
  r RECORD;
  item JSONB;
BEGIN
  -- saved_bits
  FOR r IN SELECT id, saved_bits FROM public.profiles
           WHERE jsonb_array_length(coalesce(saved_bits, '[]'::jsonb)) > 0
  LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(r.saved_bits)
    LOOP
      INSERT INTO public.user_saved_items (user_id, item_type, content_id, subject, data)
      VALUES (r.id, 'saved_bit', item->>'id', item->>'subject', item)
      ON CONFLICT (user_id, item_type, content_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- saved_formulas
  FOR r IN SELECT id, saved_formulas FROM public.profiles
           WHERE jsonb_array_length(coalesce(saved_formulas, '[]'::jsonb)) > 0
  LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(r.saved_formulas)
    LOOP
      INSERT INTO public.user_saved_items (user_id, item_type, content_id, subject, data)
      VALUES (r.id, 'saved_formula', item->>'id', item->>'subject', item)
      ON CONFLICT (user_id, item_type, content_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- saved_revision_cards (with status and saved_at extraction)
  FOR r IN SELECT id, saved_revision_cards FROM public.profiles
           WHERE jsonb_array_length(coalesce(saved_revision_cards, '[]'::jsonb)) > 0
  LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(r.saved_revision_cards)
    LOOP
      INSERT INTO public.user_saved_items (user_id, item_type, content_id, subject, status, saved_at, data)
      VALUES (
        r.id,
        'saved_revision_card',
        item->>'id',
        item->>'subject',
        item->>'status',
        CASE WHEN item->>'saved_at' IS NOT NULL
          THEN (item->>'saved_at')::timestamptz
          ELSE NULL
        END,
        item
      )
      ON CONFLICT (user_id, item_type, content_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- saved_revision_units
  FOR r IN SELECT id, saved_revision_units FROM public.profiles
           WHERE jsonb_array_length(coalesce(saved_revision_units, '[]'::jsonb)) > 0
  LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(r.saved_revision_units)
    LOOP
      INSERT INTO public.user_saved_items (user_id, item_type, content_id, subject, data)
      VALUES (r.id, 'saved_revision_unit', item->>'id', item->>'subject', item)
      ON CONFLICT (user_id, item_type, content_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- saved_community_posts
  FOR r IN SELECT id, saved_community_posts FROM public.profiles
           WHERE jsonb_array_length(coalesce(saved_community_posts, '[]'::jsonb)) > 0
  LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(r.saved_community_posts)
    LOOP
      INSERT INTO public.user_saved_items (user_id, item_type, content_id, subject, saved_at, data)
      VALUES (
        r.id,
        'saved_community_post',
        coalesce(item->>'postId', item->>'id'),
        item->>'subject',
        CASE WHEN item->>'savedAt' IS NOT NULL
          THEN (item->>'savedAt')::timestamptz
          ELSE NULL
        END,
        item
      )
      ON CONFLICT (user_id, item_type, content_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- RPC for lightweight count per item_type (used by admin analytics and cap checks)
CREATE OR REPLACE FUNCTION public.get_user_saved_item_counts(p_user_id uuid)
RETURNS TABLE(item_type text, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT item_type, count(*) as cnt
  FROM public.user_saved_items
  WHERE user_id = p_user_id
  GROUP BY item_type;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_saved_item_counts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_saved_item_counts(uuid) TO authenticated;
