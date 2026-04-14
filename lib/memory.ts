import "server-only";

import { Redis } from "@upstash/redis";
import { createAdminClient } from "@/integrations/supabase/server";
import type { Json } from "@/integrations/supabase/types";

const MEMORY_EMBED_DIM = 1024;
const REDIS_TTL_SECONDS = 60 * 30;

export type MemoryTurnRole = "user" | "assistant";

export interface MemoryTurn {
  role: MemoryTurnRole;
  content: string;
  createdAt?: string;
}

export interface EpisodicMemoryMatch {
  id: string;
  chunkText: string;
  similarity: number;
}

export interface MemoryContext {
  recentTurns: MemoryTurn[];
  canonicalProfile: Json;
  episodicMatches: EpisodicMemoryMatch[];
  promptContext: string;
}

export interface MemoryScope {
  subject: string;
  topic: string;
  subtopic?: string;
  gradeLevel?: number;
}

function normalizeScopePart(value: string | number | undefined): string {
  if (value == null) return "na";
  return encodeURIComponent(String(value).trim().toLowerCase());
}

export function buildMemoryScopeKey(scope: MemoryScope): string {
  return [
    "subject",
    normalizeScopePart(scope.subject),
    "grade",
    normalizeScopePart(scope.gradeLevel ?? 11),
    "topic",
    normalizeScopePart(scope.topic),
    "subtopic",
    normalizeScopePart(scope.subtopic ?? ""),
  ].join(":");
}

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

function getRecentTurnsKey(userId: string, scopeKey: string): string {
  return `memory:recent-turns:${userId}:${scopeKey}`;
}

export async function appendRecentTurn(
  userId: string,
  turn: MemoryTurn,
  scopeKey: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const payload: MemoryTurn = {
    role: turn.role,
    content: turn.content,
    createdAt: turn.createdAt ?? new Date().toISOString(),
  };
  const key = getRecentTurnsKey(userId, scopeKey);

  await redis.lpush(key, JSON.stringify(payload));
  await redis.ltrim(key, 0, 5);
  await redis.expire(key, REDIS_TTL_SECONDS);
}

async function getRecentTurns(
  userId: string,
  scopeKey: string
): Promise<MemoryTurn[]> {
  const redis = getRedisClient();
  if (!redis) return [];

  const raw = await redis.lrange<string>(getRecentTurnsKey(userId, scopeKey), 0, 2);
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      try {
        const parsed = JSON.parse(entry) as MemoryTurn;
        if (
          (parsed.role === "user" || parsed.role === "assistant") &&
          typeof parsed.content === "string"
        ) {
          return parsed;
        }
      } catch {
        return null;
      }
      return null;
    })
    .filter((t): t is MemoryTurn => t !== null);
}

async function embedQuery(query: string): Promise<number[] | null> {
  const endpoint = process.env.MEMORY_EMBEDDING_WEBHOOK_URL?.trim();
  if (!endpoint) return null;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.MEMORY_WEBHOOK_AUTH_TOKEN?.trim()
        ? { Authorization: `Bearer ${process.env.MEMORY_WEBHOOK_AUTH_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ text: query }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Embedding endpoint failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    embedding?: number[];
    vector?: number[];
    data?: number[];
  };

  const vector = data.embedding ?? data.vector ?? data.data ?? null;
  if (!Array.isArray(vector) || vector.length !== MEMORY_EMBED_DIM) {
    return null;
  }

  return vector;
}

function formatVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function getCanonicalProfile(userId: string): Promise<Json> {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for memory context");
  }

  const { data, error } = await supabase
    .from("user_memory_profile")
    .select("canonical_profile")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch canonical profile: ${error.message}`);
  }

  return data?.canonical_profile ?? {};
}

async function getEpisodicMatches(
  userId: string,
  query: string,
  scopeKey: string
): Promise<EpisodicMemoryMatch[]> {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for memory context");
  }

  const queryEmbedding = await embedQuery(query);
  if (!queryEmbedding) return [];

  const { data, error } = await supabase.rpc("match_episodic_memory_scoped", {
    query_embedding: formatVectorLiteral(queryEmbedding),
    match_threshold: 0.6,
    match_count: 3,
    p_user_id: userId,
    p_context_key: scopeKey,
  });

  if (error) {
    throw new Error(`Failed to fetch episodic memory matches: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    chunkText: row.chunk_text,
    similarity: row.similarity,
  }));
}

function buildPromptContext(input: {
  recentTurns: MemoryTurn[];
  canonicalProfile: Json;
  episodicMatches: EpisodicMemoryMatch[];
}): string {
  const recentTurnsText = input.recentTurns.length
    ? input.recentTurns
        .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
        .join("\n")
    : "No recent turns available.";

  const episodicText = input.episodicMatches.length
    ? input.episodicMatches
        .map(
          (match, index) =>
            `${index + 1}. (${match.similarity.toFixed(3)}) ${match.chunkText}`
        )
        .join("\n")
    : "No episodic matches available.";

  const canonicalText =
    typeof input.canonicalProfile === "object"
      ? JSON.stringify(input.canonicalProfile, null, 2)
      : String(input.canonicalProfile);

  return [
    "=== RECENT CONVERSATION (LAST 3 TURNS) ===",
    recentTurnsText,
    "",
    "=== CANONICAL PROFILE ===",
    canonicalText,
    "",
    "=== EPISODIC MEMORY MATCHES (TOP 3) ===",
    episodicText,
  ].join("\n");
}

/**
 * Phase 2 read path:
 * 1) Fetch last 3 turns from Upstash
 * 2) Fetch canonical profile + episodic vector matches in parallel
 * 3) Return prompt-ready memory context
 */
export async function getMemoryContext(
  userId: string,
  query: string,
  scope: MemoryScope
): Promise<MemoryContext> {
  const scopeKey = buildMemoryScopeKey(scope);
  const recentTurns = await getRecentTurns(userId, scopeKey);

  const [canonicalProfile, episodicMatches] = await Promise.all([
    getCanonicalProfile(userId),
    getEpisodicMatches(userId, query, scopeKey),
  ]);

  const promptContext = buildPromptContext({
    recentTurns,
    canonicalProfile,
    episodicMatches,
  });

  return {
    recentTurns,
    canonicalProfile,
    episodicMatches,
    promptContext,
  };
}
