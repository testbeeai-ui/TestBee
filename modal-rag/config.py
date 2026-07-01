"""
config.py - Pydantic Settings for the RAG sidecar.

Reads from environment variables or a .env file in the modal-rag/ directory.
"""

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Dedicated RAG Supabase (yobzgdsecnutzyvuidqz) — NOT the main app DB (bytsiknhtcnlxwzgqkrd).
    # Phase 4 Option A: do not merge or repoint to main; see docs/architecture/supabase-cost-phase4-infra-billing.md
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
    internal_token: str = Field(
        default="",
        validation_alias=AliasChoices("RAG_INTERNAL_TOKEN", "INTERNAL_TOKEN"),
    )

    # Server
    host: str = "127.0.0.1"
    port: int = 8100
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        populate_by_name=True,
    )


settings = Settings()
