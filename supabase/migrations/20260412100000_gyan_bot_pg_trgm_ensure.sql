-- ProfPi similarity RPC uses pg_trgm similarity(). Ensure extension exists (idempotent).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
