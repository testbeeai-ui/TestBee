"""
config.py - Pydantic Settings for the RAG sidecar.

Reads from environment variables or a .env file in the rag-server/ directory.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase project that stores textbook_chunks (SEPARATE from the main app DB)
    rag_supabase_url: str = ""
    rag_supabase_anon_key: str = ""

    # Embedding mode:
    #   "local"  -> load BAAI/bge-m3 in-process via sentence-transformers
    #   Any URL  -> POST to that URL with {"text": "..."} and expect {"embedding": [...]}
    embed_mode: str = "local"

    # Shared secret — Next.js sends this in X-Internal-Token; sidecar validates it.
    # Set RAG_INTERNAL_TOKEN in both rag-server/.env and .env.local.
    # Leave empty to disable token auth (dev-only convenience).
    internal_token: str = ""

    # Server
    host: str = "127.0.0.1"
    port: int = 8100
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
