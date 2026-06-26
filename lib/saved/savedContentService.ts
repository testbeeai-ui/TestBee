import { useUserStore } from "@/store/useUserStore";
import { safeGetSession } from "@/lib/auth/safeSession";
import { track } from "@/lib/analytics/track";
import type {
  SavedBit,
  SavedFormula,
  SavedRevisionCard,
  SavedRevisionUnit,
  SavedCommunityPost,
} from "@/types";
import type { SavedContentTypeKey } from "@/lib/saved/savedContentEtag";

export type { SavedContentTypeKey } from "@/lib/saved/savedContentEtag";

const API = "/api/user/saved-content";
const REVISION_CARDS_API = "/api/user/saved-content/revision-cards";
const FETCH_TTL_MS = 60_000;
const SYNC_DEBOUNCE_MS = 3_000;

export type SavedContentBundle = {
  savedBits: SavedBit[];
  savedFormulas: SavedFormula[];
  savedRevisionCards: SavedRevisionCard[];
  savedRevisionUnits: SavedRevisionUnit[];
  savedCommunityPosts: SavedCommunityPost[];
};

const EMPTY_BUNDLE: SavedContentBundle = {
  savedBits: [],
  savedFormulas: [],
  savedRevisionCards: [],
  savedRevisionUnits: [],
  savedCommunityPosts: [],
};

type FetchCache = {
  userId: string;
  typesKey: string;
  etag: string | null;
  fetchedAt: number;
  data: SavedContentBundle;
  inFlight: Promise<SavedContentBundle> | null;
};

const CLIENT_TYPES: Record<SavedContentTypeKey, string> = {
  savedBits: "bits",
  savedFormulas: "formulas",
  savedRevisionCards: "revision_cards",
  savedRevisionUnits: "revision_units",
  savedCommunityPosts: "community_posts",
};

function cacheTypesKey(types?: SavedContentTypeKey[]): string {
  return types?.length ? [...types].sort().join(",") : "all";
}

let fetchCache: FetchCache | null = null;

let lastSyncedFingerprint: string | null = null;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncFlushResolvers: Array<(result: SyncSavedContentResult) => void> = [];
let syncInFlight: Promise<SyncSavedContentResult> | null = null;

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const { session } = await safeGetSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}

function parseSavedContentResponse(data: unknown): SavedContentBundle {
  const d = data as Record<string, unknown>;
  return {
    savedBits: Array.isArray(d.savedBits) ? (d.savedBits as SavedBit[]) : [],
    savedFormulas: Array.isArray(d.savedFormulas) ? (d.savedFormulas as SavedFormula[]) : [],
    savedRevisionCards: Array.isArray(d.savedRevisionCards)
      ? (d.savedRevisionCards as SavedRevisionCard[])
      : [],
    savedRevisionUnits: Array.isArray(d.savedRevisionUnits)
      ? (d.savedRevisionUnits as SavedRevisionUnit[])
      : [],
    savedCommunityPosts: Array.isArray(d.savedCommunityPosts)
      ? (d.savedCommunityPosts as SavedCommunityPost[])
      : [],
  };
}

async function fetchSavedContentFromNetwork(opts?: {
  types?: SavedContentTypeKey[];
  etag?: string | null;
}): Promise<{ data: SavedContentBundle; etag: string | null }> {
  const headers = (await getAuthHeaders()) as Record<string, string>;
  const url =
    typeof window !== "undefined"
      ? new URL(API, window.location.origin)
      : new URL(API, "http://localhost");
  if (opts?.types?.length) {
    url.searchParams.set(
      "types",
      opts.types.map((t) => CLIENT_TYPES[t]).join(",")
    );
  }
  if (opts?.etag) headers["If-None-Match"] = opts.etag;

  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const controller = new AbortController();
  const timeoutMs = 25_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url.toString(), { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  const durationMs = Math.round(
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - started
  );

  if (res.status === 304) {
    track("saved_content_fetch_304", {
      duration_ms: durationMs,
      types: cacheTypesKey(opts?.types),
    });
    if (fetchCache) return { data: fetchCache.data, etag: fetchCache.etag };
    return { data: { ...EMPTY_BUNDLE }, etag: null };
  }

  if (!res.ok) {
    if (res.status === 401) return { data: { ...EMPTY_BUNDLE }, etag: null };
    throw new Error("Failed to fetch saved content");
  }

  const data = parseSavedContentResponse(await res.json());
  const nextEtag = res.headers.get("ETag");

  track("saved_content_fetch", {
    duration_ms: durationMs,
    types: cacheTypesKey(opts?.types),
    revision_cards: data.savedRevisionCards.length,
  });

  return { data, etag: nextEtag };
}

/** Drop cached GET payload (after sync or forced refresh). */
export function invalidateSavedContentCache(): void {
  fetchCache = null;
}

/**
 * GET saved content with 60s TTL and in-flight dedupe per user.
 * Pass `{ force: true }` after mutations that must see server state immediately.
 */
export async function fetchSavedContent(opts?: {
  force?: boolean;
  types?: SavedContentTypeKey[];
}): Promise<SavedContentBundle> {
  const { session } = await safeGetSession();
  const userId = session?.user?.id ?? null;
  if (!userId) return { ...EMPTY_BUNDLE };

  const typesKey = cacheTypesKey(opts?.types);
  const now = Date.now();
  if (
    !opts?.force &&
    fetchCache?.userId === userId &&
    fetchCache.typesKey === typesKey &&
    now - fetchCache.fetchedAt < FETCH_TTL_MS
  ) {
    return fetchCache.data;
  }

  if (fetchCache?.userId === userId && fetchCache.typesKey === typesKey && fetchCache.inFlight) {
    return fetchCache.inFlight;
  }

  const inFlight = fetchSavedContentFromNetwork({
    types: opts?.types,
    etag: opts?.force ? null : fetchCache?.etag ?? null,
  })
    .then(({ data, etag }) => {
      fetchCache = {
        userId,
        typesKey,
        etag,
        fetchedAt: Date.now(),
        data,
        inFlight: null,
      };
      return data;
    })
    .catch((err) => {
      if (fetchCache?.userId === userId && fetchCache.typesKey === typesKey) {
        fetchCache = { ...fetchCache, inFlight: null };
      }
      throw err;
    });

  fetchCache = {
    userId,
    typesKey,
    etag: fetchCache?.userId === userId && fetchCache.typesKey === typesKey ? fetchCache.etag : null,
    fetchedAt:
      fetchCache?.userId === userId && fetchCache.typesKey === typesKey ? fetchCache.fetchedAt : 0,
    data:
      fetchCache?.userId === userId && fetchCache.typesKey === typesKey
        ? fetchCache.data
        : { ...EMPTY_BUNDLE },
    inFlight,
  };

  return inFlight;
}

export type SyncSavedContentResult =
  | { ok: true }
  | { ok: false; error: string; limitReached: boolean };

/** Lightweight fingerprint to skip no-op full POSTs. */
export function fingerprintSavedContentSnapshot(
  savedBits: SavedBit[],
  savedFormulas: SavedFormula[],
  savedRevisionCards: SavedRevisionCard[],
  savedRevisionUnits: SavedRevisionUnit[],
  savedCommunityPosts: SavedCommunityPost[]
): string {
  const revision = savedRevisionCards
    .map((c) => `${c.id}\u001f${c.status ?? "new"}\u001f${c.reviewAt ?? ""}`)
    .sort()
    .join("\u001e");
  return [
    savedBits.length,
    savedFormulas.length,
    savedRevisionUnits.length,
    savedCommunityPosts.length,
    savedRevisionCards.length,
    revision,
    savedBits
      .map((b) => b.id)
      .sort()
      .join(","),
    savedFormulas
      .map((f) => f.id)
      .sort()
      .join(","),
  ].join("|");
}

export async function syncSavedContent(
  savedBits: SavedBit[],
  savedFormulas: SavedFormula[],
  savedRevisionCards: SavedRevisionCard[],
  savedRevisionUnits: SavedRevisionUnit[],
  savedCommunityPosts: SavedCommunityPost[]
): Promise<SyncSavedContentResult> {
  const fingerprint = fingerprintSavedContentSnapshot(
    savedBits,
    savedFormulas,
    savedRevisionCards,
    savedRevisionUnits,
    savedCommunityPosts
  );
  if (fingerprint === lastSyncedFingerprint) {
    return { ok: true };
  }

  const authHeaders = await getAuthHeaders();
  const bodyJson = JSON.stringify({
    savedBits,
    savedFormulas,
    savedRevisionCards,
    savedRevisionUnits,
    savedCommunityPosts,
  });
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const res = await fetch(API, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: bodyJson,
  });
  const durationMs = Math.round(
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - started
  );
  if (res.ok || res.status === 401) {
    lastSyncedFingerprint = fingerprint;
    invalidateSavedContentCache();
    track("saved_content_sync", {
      duration_ms: durationMs,
      bytes: bodyJson.length,
      revision_cards: savedRevisionCards.length,
    });
    return { ok: true };
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const message =
    typeof body.error === "string" && body.error.trim()
      ? body.error
      : "Failed to sync saved content";
  return {
    ok: false,
    error: message,
    limitReached: res.status === 403 && /save limit/i.test(message),
  };
}

async function runSyncAllSavedContent(): Promise<SyncSavedContentResult> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const user = useUserStore.getState().user;
    if (!user) return { ok: true as const };
    return syncSavedContent(
      user.savedBits ?? [],
      user.savedFormulas ?? [],
      user.savedRevisionCards ?? [],
      user.savedRevisionUnits ?? [],
      user.savedCommunityPosts ?? []
    );
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

function resolveDebouncedSync(result: SyncSavedContentResult): void {
  const resolvers = syncFlushResolvers;
  syncFlushResolvers = [];
  for (const resolve of resolvers) resolve(result);
}

/**
 * POST full store snapshot. Debounced 3s by default; pass `{ immediate: true }` when the
 * caller must await persistence (e.g. add-card modal).
 */
export function syncAllSavedContent(opts?: {
  immediate?: boolean;
}): Promise<SyncSavedContentResult> {
  if (opts?.immediate) {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
      syncDebounceTimer = null;
    }
    return runSyncAllSavedContent().then((result) => {
      resolveDebouncedSync(result);
      return result;
    });
  }

  return new Promise((resolve) => {
    syncFlushResolvers.push(resolve);
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      syncDebounceTimer = null;
      void runSyncAllSavedContent().then(resolveDebouncedSync);
    }, SYNC_DEBOUNCE_MS);
  });
}

/** PATCH one revision card after recall action — avoids bulk saved-content POST. */
export async function patchRevisionCardRecall(
  card: SavedRevisionCard
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(REVISION_CARDS_API, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ card }),
  });
  if (res.ok || res.status === 401) {
    invalidateSavedContentCache();
    const user = useUserStore.getState().user;
    if (user) {
      lastSyncedFingerprint = fingerprintSavedContentSnapshot(
        user.savedBits ?? [],
        user.savedFormulas ?? [],
        user.savedRevisionCards ?? [],
        user.savedRevisionUnits ?? [],
        user.savedCommunityPosts ?? []
      );
    }
    return { ok: true };
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return {
    ok: false,
    error:
      typeof body.error === "string" && body.error.trim()
        ? body.error
        : "Failed to sync revision card",
  };
}
