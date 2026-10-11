-- Admin-managed promotion names: one url word, one checked account, one page.
-- Pages are Learn Hub (with a subject) or Chapter PYQ. Login is unchanged.

CREATE TABLE IF NOT EXISTS public.named_page_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  destination text NOT NULL,
  subject text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT named_page_links_slug_unique UNIQUE (slug),
  CONSTRAINT named_page_links_slug_format CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 40
  ),
  CONSTRAINT named_page_links_email_lower CHECK (email = lower(email)),
  CONSTRAINT named_page_links_destination_check CHECK (
    (
      destination = 'learnhub'
      AND subject IN ('physics', 'chemistry', 'math')
    )
    OR (
      destination = 'chapter_pyq'
      AND subject IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS named_page_links_user_id_idx
  ON public.named_page_links (user_id);

ALTER TABLE public.named_page_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.named_page_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.named_page_links TO service_role;

-- Email check for the admin console. Not granted to students.
CREATE OR REPLACE FUNCTION public.lookup_users_by_email(p_query text)
RETURNS TABLE(id uuid, email text, name text, role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $$
DECLARE
  v_query text;
BEGIN
  v_query := replace(replace(lower(trim(coalesce(p_query, ''))), '%', ''), '_', '');
  IF length(v_query) < 5 OR position('@' IN v_query) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, lower(u.email)::text, p.name, p.role
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.email IS NOT NULL
    AND (
      lower(u.email) = v_query
      OR lower(u.email) LIKE v_query || '%'
    )
  ORDER BY (lower(u.email) = v_query) DESC, u.email
  LIMIT 8;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_users_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_users_by_email(text) TO service_role;
