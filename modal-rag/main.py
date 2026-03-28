"""
main.py - FastAPI RAG sidecar for Testbee.

Endpoints:
  GET  /health    -> {"status": "ok"}
  POST /retrieve  -> embed query, multi-pass Supabase retrieval, return formatted passages

Local dev (optional):
  cd modal-rag
  uvicorn main:app --host 0.0.0.0 --port 8100 --reload

Production: deploy with Modal — see modal_app.py
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import settings
from embed import get_embedding, load_model
from retriever import retrieve_chunks, format_passages

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan: load BGE-M3 model once at startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting RAG sidecar on port %s...", settings.port)
    load_model()
    logger.info("RAG sidecar ready.")
    yield  # server runs here


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Testbee RAG Sidecar", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class RetrieveRequest(BaseModel):
    query: str
    subject: str = "physics"
    grade_level: int = 11
    match_count: int = 8


class PassageOut(BaseModel):
    text: str
    chapter: str
    subject: str
    page_number: int | None = None
    section_heading: str | None = None
    distance: float


class RetrieveResponse(BaseModel):
    formatted_context: str
    passages: list[PassageOut]
    chunk_count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest, request: Request):
    """Embed the query, retrieve matching textbook chunks, return formatted passages."""
    # Shared-secret auth — if a token is configured, callers must provide it.
    if settings.internal_token:
        token = request.headers.get("X-Internal-Token", "")
        if token != settings.internal_token:
            raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        # 1. Embed the query
        embedding = await get_embedding(req.query)

        # 2. Multi-pass retrieval from Supabase
        chunks = await retrieve_chunks(
            embedding=embedding,
            subject=req.subject,
            grade_level=req.grade_level,
            match_count=req.match_count,
        )

        # 3. Format into the textbook passages block
        result = format_passages(chunks, curriculum="CBSE")

        logger.info(
            "Retrieved %d chunks for query='%s' (subject=%s, grade=%s)",
            result["chunk_count"],
            req.query[:60],
            req.subject,
            req.grade_level,
        )

        return result

    except RuntimeError as e:
        logger.error("Retrieval error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error in /retrieve: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal retrieval error")


# ---------------------------------------------------------------------------
# Entry point (for running without uvicorn CLI)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
