-- RAG multi-tier memory: canonical JSONB profile + episodic pgvector store (BGE-M3 1024-d).
-- Writes from Modal worker use service role (bypass RLS). Authenticated users may SELECT own rows only.

CREATE EXTENSION IF NOT EXISTS vector;

-- Canonical structured profile per user (preferences, facts, etc.); updated atomically from workers.
CREATE TABLE IF NOT EXISTS public.user_memory_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  canonical_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_memory_profile_jsonb
  ON public.user_memory_profile USING gin (canonical_profile);

COMMENT ON TABLE public.user_memory_profile IS 'Per-user canonical memory profile (JSONB); async updates from Modal.';

-- Episodic chunks + embeddings for semantic retrieval.
CREATE TABLE IF NOT EXISTS public.episodic_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  chunk_text text NOT NULL,
  embedding vector(1024) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_episodic_memory_embedding
  ON public.episodic_memory USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_episodic_memory_user_id
  ON public.episodic_memory (user_id);

COMMENT ON TABLE public.episodic_memory IS 'Episodic memory chunks with BGE-M3-sized embeddings for RAG-style recall.';

-- Row Level Security: users read only their own rows; no INSERT/UPDATE/DELETE for authenticated (service role writes).
ALTER TABLE public.user_memory_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodic_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own memory profile" ON public.user_memory_profile;
CREATE POLICY "Users can read own memory profile"
  ON public.user_memory_profile
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own episodic memory" ON public.episodic_memory;
CREATE POLICY "Users can read own episodic memory"
  ON public.episodic_memory
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Similarity search scoped by user (cosine distance <=>); used by Next.js read path / service role.
CREATE OR REPLACE FUNCTION public.match_episodic_memory (
  query_embedding vector(1024),
  match_threshold double precision,
  match_count integer,
  p_user_id uuid
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
    AND (1 - (em.embedding <=> query_embedding)) > match_threshold
  ORDER BY em.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.match_episodic_memory(vector(1024), double precision, integer, uuid)
  IS 'Top episodic chunks for a user by cosine similarity; threshold on similarity in [0,1].';

REVOKE ALL ON FUNCTION public.match_episodic_memory(vector(1024), double precision, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_episodic_memory(vector(1024), double precision, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_episodic_memory(vector(1024), double precision, integer, uuid) TO service_role;
