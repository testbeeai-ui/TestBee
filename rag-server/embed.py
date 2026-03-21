"""
embed.py - BGE-M3 embedding client.

Supports two modes (configured via settings.embed_mode):
  "local"  -> loads BAAI/bge-m3 in-process (requires torch + sentence-transformers)
  Any URL  -> POSTs to an external embedding API

Concurrency safety:
  - Model is loaded ONCE at startup.
  - A threading.Lock serialises encode() calls so concurrent requests don't OOM.
  - asyncio.to_thread() offloads the blocking encode() so FastAPI stays responsive.
"""

import asyncio
import logging
import threading
from typing import Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level state (initialised once)
# ---------------------------------------------------------------------------
_model: Optional[object] = None
_embed_lock = threading.Lock()


def load_model() -> None:
    """Load the embedding model into memory. Call once at startup."""
    global _model

    if settings.embed_mode.lower() == "local":
        from sentence_transformers import SentenceTransformer

        logger.info("Loading BAAI/bge-m3 locally (this may take a moment)...")
        _model = SentenceTransformer("BAAI/bge-m3")
        logger.info("BGE-M3 model loaded successfully.")
    else:
        logger.info(
            "Embedding mode: external API at %s", settings.embed_mode
        )


# ---------------------------------------------------------------------------
# Synchronous encode (runs inside a thread)
# ---------------------------------------------------------------------------
def _sync_embed(text: str) -> list[float]:
    """Blocking embed — always called via asyncio.to_thread()."""
    with _embed_lock:
        if _model is None:
            raise RuntimeError("Embedding model not loaded. Call load_model() first.")
        return _model.encode(  # type: ignore[union-attr]
            [text], batch_size=1, normalize_embeddings=True
        )[0].tolist()


async def _embed_via_api(text: str) -> list[float]:
    """Call an external embedding API."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            settings.embed_mode,
            json={"text": text},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["embedding"]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def get_embedding(text: str) -> list[float]:
    """Return a 1024-dim BGE-M3 embedding for *text*."""
    if settings.embed_mode.lower() == "local":
        return await asyncio.to_thread(_sync_embed, text)
    else:
        return await _embed_via_api(text)
