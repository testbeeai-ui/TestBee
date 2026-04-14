"""
Phase 4 - Modal background worker for memory extraction and persistence.

Responsibilities:
1) Receive webhook payload from Next.js: { userId, chatHistory, newTurn }
2) Extract memory update operations with strict Pydantic output
3) Apply atomic JSONB updates to user_memory_profile
4) Embed conversational chunk and write to episodic_memory
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Literal

import modal
import psycopg
import requests
from pydantic import BaseModel, Field, ValidationError


app = modal.App("testbee-memory-worker")

image = (
    modal.Image.debian_slim()
    .pip_install(
        "fastapi[standard]>=0.115.0,<1",
        "pydantic>=2.8.0,<3",
        "psycopg[binary]>=3.2.0,<4",
        "requests>=2.32.0,<3",
        "google-genai>=1.30.0,<2",
    )
)

secrets = [modal.Secret.from_name("custom-secret")]


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class NewTurn(BaseModel):
    user: str = Field(min_length=1, max_length=4000)
    assistant: str = Field(min_length=1, max_length=8000)


class MemoryWebhookPayload(BaseModel):
    userId: str = Field(min_length=8, max_length=64)
    contextKey: str = Field(min_length=2, max_length=256)
    chatHistory: list[ChatTurn] = Field(default_factory=list, max_length=16)
    newTurn: NewTurn


class MemoryOperation(BaseModel):
    action: Literal["upsert", "remove"]
    key: str = Field(min_length=1, max_length=128)
    value: Any | None = None
    confidence: float = Field(ge=0, le=1, default=0.8)


class ExtractionResult(BaseModel):
    operations: list[MemoryOperation] = Field(default_factory=list, max_length=20)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _build_extraction_prompt(payload: MemoryWebhookPayload) -> str:
    return (
        "Extract only stable, reusable user memory facts.\n"
        "Return strict JSON with shape: {\"operations\": [{\"action\":\"upsert|remove\",\"key\":\"...\",\"value\":...,\"confidence\":0..1}]}\n"
        "Rules:\n"
        "- Use 'upsert' for durable facts/preferences/constraints.\n"
        "- Use 'remove' only when user explicitly revokes prior preference/fact.\n"
        "- Ignore temporary chatter and sensitive secrets.\n"
        "- Keep keys short snake_case.\n"
        "- Do not return prose.\n\n"
        f"chatHistory={json.dumps([t.model_dump() for t in payload.chatHistory], ensure_ascii=False)}\n"
        f"newTurn={json.dumps(payload.newTurn.model_dump(), ensure_ascii=False)}\n"
    )


def _extract_operations_with_llm(payload: MemoryWebhookPayload) -> list[MemoryOperation]:
    """
    Strict extraction via Gemini JSON response schema, validated again with Pydantic.
    """
    from google import genai

    api_key = _require_env("GEMINI_API_KEY")
    model = os.getenv("MEMORY_EXTRACT_MODEL", "gemini-2.5-pro").strip()
    client = genai.Client(api_key=api_key)

    prompt = _build_extraction_prompt(payload)

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": ExtractionResult,
            "temperature": 0.1,
        },
    )

    text = (response.text or "").strip()
    if not text:
        return []

    parsed = ExtractionResult.model_validate_json(text)
    return parsed.operations


def _operations_to_patch(operations: list[MemoryOperation]) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    for op in operations:
        if op.confidence < 0.6:
            continue
        if op.action == "upsert":
            patch[op.key] = op.value
        elif op.action == "remove":
            # null marker; SQL step removes these keys after merge
            patch[op.key] = None
    return patch


def _apply_atomic_profile_patch(conn: psycopg.Connection, user_id: str, patch: dict[str, Any]) -> None:
    """
    Atomic profile upsert/update in a single statement.
    - Merges JSON patch into canonical_profile
    - Removes keys where patch value is null
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.user_memory_profile (user_id, canonical_profile, updated_at)
            VALUES (%s::uuid, %s::jsonb, now())
            ON CONFLICT (user_id) DO UPDATE
            SET canonical_profile = (
                SELECT COALESCE(
                    jsonb_object_agg(k, v) FILTER (WHERE v IS NOT NULL),
                    '{}'::jsonb
                )
                FROM jsonb_each(public.user_memory_profile.canonical_profile || EXCLUDED.canonical_profile)
            ),
            updated_at = now();
            """,
            (user_id, json.dumps(patch)),
        )


def _get_embedding_vector(text: str) -> list[float]:
    """
    Uses external embedding service (BGE-M3 compatible 1024 dimensions).
    """
    endpoint = _require_env("MEMORY_EMBEDDING_WEBHOOK_URL")
    token = os.getenv("MEMORY_WEBHOOK_AUTH_TOKEN", "").strip()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    res = requests.post(
        endpoint,
        headers=headers,
        json={"text": text},
        timeout=20,
    )
    res.raise_for_status()
    data = res.json()
    vector = data.get("embedding") or data.get("vector") or data.get("data")
    if not isinstance(vector, list) or len(vector) != 1024:
        raise RuntimeError("Embedding response missing 1024-d vector")
    return [float(x) for x in vector]


def _insert_episodic_memory(
    conn: psycopg.Connection,
    user_id: str,
    context_key: str,
    chunk_text: str,
    embedding: list[float],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.episodic_memory (user_id, context_key, chunk_text, embedding, created_at)
            VALUES (%s::uuid, %s, %s, %s::vector, now());
            """,
            (user_id, context_key, chunk_text, f"[{','.join(str(x) for x in embedding)}]"),
        )


def _compose_chunk(payload: MemoryWebhookPayload) -> str:
    history = "\n".join(f"{t.role.upper()}: {t.content}" for t in payload.chatHistory[-6:])
    return (
        f"TIME: {_utc_now_iso()}\n"
        f"{history}\n"
        f"USER: {payload.newTurn.user}\n"
        f"ASSISTANT: {payload.newTurn.assistant}"
    ).strip()


@app.function(image=image, secrets=secrets, timeout=120)
@modal.fastapi_endpoint(method="POST")
def memory_webhook(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        req = MemoryWebhookPayload.model_validate(payload)
    except ValidationError as exc:
        return {"ok": False, "error": "invalid_payload", "detail": exc.errors()}

    db_url = _require_env("SUPABASE_DB_URL")

    operations = _extract_operations_with_llm(req)
    patch = _operations_to_patch(operations)
    chunk_text = _compose_chunk(req)
    embedding = _get_embedding_vector(chunk_text)

    with psycopg.connect(db_url, autocommit=False) as conn:
        try:
            if patch:
                _apply_atomic_profile_patch(conn, req.userId, patch)
            _insert_episodic_memory(conn, req.userId, req.contextKey, chunk_text, embedding)
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    return {
        "ok": True,
        "userId": req.userId,
        "contextKey": req.contextKey,
        "operationsApplied": len(patch),
        "episodicInserted": True,
    }
