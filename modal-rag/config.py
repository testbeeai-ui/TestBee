"""
config.py - Pydantic Settings for the RAG sidecar.

Reads from environment variables or a .env file in the modal-rag/ directory.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase project that stores textbook_chunks (SEPARATE from the main app DB)
    rag_supabase_url: str = ""
    rag_supabase_anon_key: str = ""

    # Embedding mode:
    #   "local"  -> load BGE-M3 in-process via sentence-transformers
    #   Any URL  -> POST to that URL with {"text": "..."} and expect {"embedding": [...]}
    embed_mode: str = "local"

    # When embed_mode=local: absolute path to a saved BGE-M3 folder (config.json, model.safetensors, …).
    # Leave empty to download/use Hugging Face id BAAI/bge-m3.
    embed_local_model_path: str = ""

    # Shared secret — Next.js sends this in X-Internal-Token; sidecar validates it.
    # Set RAG_INTERNAL_TOKEN in Modal secrets and Next.js .env.local when enforcing auth.
    # Leave empty to disable token auth (dev-only convenience).
    internal_token: str = ""

    # Server
    host: str = "127.0.0.1"
    port: int = 8100
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
