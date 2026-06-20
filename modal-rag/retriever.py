"""
retriever.py - Always-on 3-pass Supabase chunk retrieval + passage formatting.

Ported from generate.py's build_prompt() and relevance filtering logic.

3-pass strategy (all three runs every query, no early short-circuit):
  Pass 1: Strict grade + subject
  Pass 2: Same grade, ALL subjects   (cross-subject fallback)
  Pass 3: ALL grades, ALL subjects   (full DB fallback)

The 3 results are merged, deduped, threshold-filtered, then capped at
MAX_CHUNKS_TO_SEND (10) to give the LLM broader grounding context and
reduce hallucination on edge queries.
"""

import asyncio
import logging
from typing import Optional

from supabase import create_client, Client

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_CHUNKS_TO_SEND = 10

# Per-subject similarity thresholds.
# Math has dense symbolic content → require higher confidence.
# Biology has longer descriptive text → lower threshold acceptable.
MIN_SIMILARITY_BY_SUBJECT: dict[str, float] = {
    "Maths":     0.42,
    "Physics":   0.36,
    "Chemistry": 0.36,
    "Biology":   0.30,
}
MIN_SIMILARITY_DEFAULT = 0.35

# Pass 1 (exact grade+subject) is accepted even below MIN_SIMILARITY if it
# clears this floor — staying in the right subject beats a higher cross-subject score.
PASS1_SUBJECT_FLOOR = 0.28


def _get_min_similarity(subject: str) -> float:
    return MIN_SIMILARITY_BY_SUBJECT.get(subject, MIN_SIMILARITY_DEFAULT)

# Frontend sends lowercase; DB stores values from the ingest script.
SUBJECT_MAP = {
    "physics": "Physics",
    "chemistry": "Chemistry",
    "math": "Maths",       # NOT "Mathematics" — matches ingest script
    "biology": "Biology",
}

# Curriculum preambles (ported from generate.py)
CURRICULUM_PREAMBLES = {
    "CBSE": "Answer at CBSE board exam level — clear explanations, standard examples.",
    "JEE_Main": "Answer at JEE Main level — formula-heavy, problem-solving focused.",
    "JEE_Advanced": "Answer at JEE Advanced level — deep derivations, multi-concept reasoning.",
}

# ---------------------------------------------------------------------------
# Supabase client (lazy init)
# ---------------------------------------------------------------------------
_supabase: Optional[Client] = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        if not settings.rag_supabase_url or not settings.rag_supabase_anon_key:
            raise RuntimeError(
                "RAG_SUPABASE_URL and RAG_SUPABASE_ANON_KEY must be set."
            )
        _supabase = create_client(
            settings.rag_supabase_url, settings.rag_supabase_anon_key
        )
    return _supabase


# ---------------------------------------------------------------------------
# RPC caller
# ---------------------------------------------------------------------------
async def _call_match_chunks(
    embedding: list[float],
    grade_level: Optional[int],
    subject: Optional[str],
    match_count: int = 8,
) -> list[dict]:
    """Call the match_chunks RPC on the RAG Supabase project."""
    sb = _get_supabase()

    params: dict = {
        "query_embedding": embedding,
        "match_count": match_count,
    }
    if grade_level is not None:
        params["grade_filter"] = grade_level
    if subject is not None:
        params["subject_filter"] = subject

    result = await asyncio.to_thread(lambda: sb.rpc("match_chunks", params).execute())
    return result.data or []


# ---------------------------------------------------------------------------
# Multi-pass retrieval
# ---------------------------------------------------------------------------
async def retrieve_chunks(
    embedding: list[float],
    subject: str,
    grade_level: int,
    match_count: int = 8,
) -> list[dict]:
    """
    Retrieve the most relevant textbook chunks using always-on 3-pass strategy.

    Runs all 3 filter passes for every query (never short-circuits on pass 1):
      Pass 1: Strict grade + subject
      Pass 2: Same grade, ALL subjects   (cross-subject fallback)
      Pass 3: ALL grades, ALL subjects   (full DB fallback)

    Results are merged, threshold-filtered, deduped by section/chapter, and
    capped at MAX_CHUNKS_TO_SEND (10). The extra passes give broader grounding
    context for the LLM and reduce hallucination on edge queries.
    """
    mapped_subject = SUBJECT_MAP.get(subject.lower(), subject)
    min_sim = _get_min_similarity(mapped_subject)

    # Pass 1: Strict grade + subject
    pass1 = await _call_match_chunks(
        embedding, grade_level, mapped_subject, match_count
    )
    logger.info(
        "Pass 1 (grade=%s, subject=%s): %d chunks, best=%.3f",
        grade_level, mapped_subject, len(pass1),
        pass1[0]["distance"] if pass1 else 0.0,
    )

    # Pass 2: Same grade, ALL subjects (cross-subject fallback) — always run.
    pass2 = await _call_match_chunks(embedding, grade_level, None, match_count)
    logger.info(
        "Pass 2 (grade=%s, all subjects): %d chunks, best=%.3f",
        grade_level, len(pass2),
        pass2[0]["distance"] if pass2 else 0.0,
    )

    # Pass 3: ALL grades, ALL subjects (full DB fallback) — always run.
    pass3 = await _call_match_chunks(embedding, None, None, match_count)
    logger.info(
        "Pass 3 (all grades, all subjects): %d chunks, best=%.3f",
        len(pass3),
        pass3[0]["distance"] if pass3 else 0.0,
    )

    # Merge all three passes, preserving best distance per chunk id.
    # Later passes only contribute chunks not already present from earlier passes.
    by_id: dict[str, dict] = {}
    for src in (pass1, pass2, pass3):
        for c in src:
            cid = c.get("id")
            if cid is None:
                continue
            if cid not in by_id or c.get("distance", 0.0) > by_id[cid].get("distance", 0.0):
                by_id[cid] = c
    merged = list(by_id.values())

    # Filter by similarity threshold.
    filtered = [c for c in merged if c.get("distance", 0.0) >= min_sim]
    if not filtered:
        logger.warning(
            "No chunks met min_similarity=%.2f for subject=%s after all 3 passes. Returning empty.",
            min_sim, mapped_subject,
        )

    # Deduplicate by section_heading+chapter — keep only best chunk per section.
    seen: set[str] = set()
    deduped: list[dict] = []
    for c in sorted(filtered, key=lambda x: x.get("distance", 0.0), reverse=True):
        section = c.get("section_heading", "").strip()
        chapter = c.get("chapter", "").strip()
        key = section if section else chapter  # fall back to chapter when no section
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        deduped.append(c)
    filtered = deduped

    # Cap at MAX_CHUNKS_TO_SEND (10) for Sarvam token budget.
    filtered = filtered[:MAX_CHUNKS_TO_SEND]

    return filtered


# ---------------------------------------------------------------------------
# Passage formatting (ported from generate.py build_prompt)
# ---------------------------------------------------------------------------
def format_passages(
    chunks: list[dict], curriculum: str = "CBSE"
) -> dict:
    """
    Format retrieved chunks into the textbook passages block.

    Returns:
        {
            "formatted_context": str,   # The full "--- TEXTBOOK PASSAGES ---" block
            "passages": list[dict],     # Individual passage metadata
            "chunk_count": int,
        }
    """
    if not chunks:
        return {"formatted_context": "", "passages": [], "chunk_count": 0}

    preamble = CURRICULUM_PREAMBLES.get(curriculum, CURRICULUM_PREAMBLES["CBSE"])

    def _confidence_label(score: float) -> str:
        if score >= 0.70:
            return "HIGH"
        if score >= 0.50:
            return "MEDIUM"
        return "LOW"

    context_parts = []
    passages = []
    for i, chunk in enumerate(chunks, start=1):
        chapter = chunk.get("chapter", "Unknown Chapter")
        subject = chunk.get("subject", "Unknown Subject")
        page_num = chunk.get("page_number")
        section = chunk.get("section_heading", "")
        text = chunk.get("text", "").strip()
        dist = chunk.get("distance", 0.0)

        header = f"[Passage {i} | {subject} — {chapter}"
        if page_num is not None:
            header += f", page {page_num}"
        if section:
            header += f" | {section}"
        header += f" | relevance: {_confidence_label(dist)}]"

        context_parts.append(f"{header}\n{text}")
        passages.append(
            {
                "text": text,
                "chapter": chapter,
                "subject": subject,
                "page_number": page_num,
                "section_heading": section,
                "distance": chunk.get("distance", 0.0),
            }
        )

    context_block = "\n\n".join(context_parts)

    formatted_context = (
        f"{preamble}\n\n"
        "The passages below are from the CBSE textbook. Use them as grounding context. "
        "Even if they cover adjacent or related topics, always answer the student's question fully "
        "using your CBSE curriculum knowledge. Never refuse or say you don't know.\n\n"
        "--- TEXTBOOK PASSAGES ---\n"
        f"{context_block}\n"
        "--- END OF PASSAGES ---"
    )

    return {
        "formatted_context": formatted_context,
        "passages": passages,
        "chunk_count": len(passages),
    }
