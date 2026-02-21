-- Duplicate search for Ask modal. Uses trigram similarity if extension available.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.search_doubt_duplicates(p_title text)
RETURNS TABLE(id uuid, title text, similarity_score real)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.title, similarity(d.title, trim(coalesce(p_title, ''))) AS similarity_score
  FROM public.doubts d
  WHERE trim(coalesce(p_title, '')) <> ''
    AND similarity(d.title, trim(p_title)) > 0.3
  ORDER BY similarity(d.title, trim(p_title)) DESC
  LIMIT 5;
END;
$$;

COMMENT ON FUNCTION public.search_doubt_duplicates IS 'Returns doubts with title similar to p_title; use similarity_score >= 0.9 for "match".';

-- Increment view count for trending (call from detail page on load).
CREATE OR REPLACE FUNCTION public.increment_doubt_views(p_doubt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.doubts SET views = views + 1 WHERE id = p_doubt_id;
END;
$$;
