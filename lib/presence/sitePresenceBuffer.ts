import { Redis } from "@upstash/redis";
import type { SupabaseClient } from "@supabase/supabase-js";

const KEY_PREFIX = "presence:site:";
const REDIS_TTL_SEC = 600;

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

export function isSitePresenceBufferEnabled(): boolean {
  return getRedis() != null;
}

function presenceKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** Record heartbeat in Redis (no Postgres write). */
export async function touchSitePresenceBuffer(userId: string, updatedAt: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(presenceKey(userId), updatedAt, { ex: REDIS_TTL_SEC });
}

export async function clearSitePresenceBuffer(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(presenceKey(userId));
}

/** Flush one user's buffered heartbeat into Postgres (buddy read path). */
export async function flushSitePresenceToPostgres(
  admin: SupabaseClient,
  userId: string
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const updatedAt = await redis.get<string>(presenceKey(userId));
  if (!updatedAt || typeof updatedAt !== "string") return false;

  const { error } = await admin
    .from("student_site_presence" as never)
    .upsert({ user_id: userId, updated_at: updatedAt } as never, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
  return true;
}

/** Cron: flush all buffered site presence keys to Postgres. */
export async function flushAllSitePresenceToPostgres(
  admin: SupabaseClient
): Promise<{ flushed: number }> {
  const redis = getRedis();
  if (!redis) return { flushed: 0 };

  let cursor = 0;
  let flushed = 0;

  do {
    const scanResult = await redis.scan(cursor, { match: `${KEY_PREFIX}*`, count: 100 });
    cursor = Number(scanResult[0]);
    const keys = scanResult[1] as string[];

    for (const key of keys) {
      const userId = key.slice(KEY_PREFIX.length);
      if (!userId) continue;
      const didFlush = await flushSitePresenceToPostgres(admin, userId);
      if (didFlush) flushed += 1;
    }
  } while (cursor !== 0);

  return { flushed };
}
