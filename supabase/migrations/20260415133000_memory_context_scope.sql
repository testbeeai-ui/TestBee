-- Add context-level scoping for episodic memory retrieval.

ALTER TABLE public.episodic_memory
  ADD COLUMN IF NOT EXISTS context_key text NOT NULL DEFAULT 'global';

CREATE INDEX IF NOT EXISTS idx_episodic_memory_user_context
  ON public.episodic_memory (user_id, context_key, created_at DESC);

CREATE OR REPLACE FUNCTION public.match_episodic_memory_scoped (
  query_embedding vector(1024),
  match_threshold double precision,
  match_count integer,
  p_user_id uuid,
  p_context_key text
)
RETURNS TABLE (
  id uuid,
  chunk_text text,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    em.id,
    em.chunk_text,
    (1 - (em.embedding <=> query_embedding))::double precision AS similarity
  FROM public.episodic_memory em
  WHERE em.user_id = p_user_id
    AND em.context_key = p_context_key
    AND (1 - (em.embedding <=> query_embedding)) > match_threshold
  ORDER BY em.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.match_episodic_memory_scoped(vector(1024), double precision, integer, uuid, text)
  IS 'Top episodic chunks for a user filtered by context key and cosine similarity.';

REVOKE ALL ON FUNCTION public.match_episodic_memory_scoped(vector(1024), double precision, integer, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_episodic_memory_scoped(vector(1024), double precision, integer, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_episodic_memory_scoped(vector(1024), double precision, integer, uuid, text) TO service_role;
