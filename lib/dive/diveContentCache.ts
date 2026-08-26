/**
 * Dive activity content cache — UX only (avoids Loading… on every card open).
 * Access control (Starter/Pro, quiz locks) always re-checks live plan — never trust cache for gates.
 */

import type { Board, Subject } from "@/types";
import type { SubtopicContentResponse } from "@/lib/curriculum/subtopicContentService";

const STORAGE_KEY = "edublast:dive-content:v5";
/** Soft budget: skip sessionStorage write if payload is large (keep memory cache). */
const MAX_STORAGE_CHARS = 200_000; // ~200 KB — quiz banks exceed the old 48KB often
const MAX_ENTRIES = 4;
const TTL_MS = 1000 * 60 * 60 * 2; // 2h

export type DiveContentCacheKeyInput = {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
};

type CacheEntry = {
  key: string;
  at: number;
  data: SubtopicContentResponse;
};

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<SubtopicContentResponse>>();

export function diveContentCacheKey(input: DiveContentCacheKeyInput): string {
  return [
    input.board,
    input.subject,
    input.classLevel,
    input.topic.trim().toLowerCase(),
    input.subtopicName.trim().toLowerCase(),
    "advanced",
  ].join("::");
}

function readSessionStore(): CacheEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > MAX_STORAGE_CHARS * MAX_ENTRIES) return [];
    const parsed = JSON.parse(raw) as CacheEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) =>
        e &&
        typeof e.key === "string" &&
        typeof e.at === "number" &&
        e.data &&
        typeof e.data === "object"
    );
  } catch {
    return [];
  }
}

function writeSessionStore(entries: CacheEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    let trimmed = entries.slice(-MAX_ENTRIES);
    while (trimmed.length > 0 && JSON.stringify(trimmed).length > MAX_STORAGE_CHARS * MAX_ENTRIES) {
      trimmed = trimmed.slice(1);
    }
    if (trimmed.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.at < TTL_MS;
}

export function getDiveContentCache(key: string): SubtopicContentResponse | null {
  const mem = memory.get(key);
  if (mem && isFresh(mem)) return mem.data;

  const fromSession = readSessionStore().find((e) => e.key === key);
  if (fromSession && isFresh(fromSession)) {
    memory.set(key, fromSession);
    return fromSession.data;
  }
  return null;
}

export function setDiveContentCache(key: string, data: SubtopicContentResponse): void {
  const entry: CacheEntry = { key, at: Date.now(), data };
  memory.set(key, entry);

  try {
    const probe = JSON.stringify(entry);
    if (probe.length > MAX_STORAGE_CHARS) {
      return;
    }
    const others = readSessionStore().filter((e) => e.key !== key && isFresh(e));
    writeSessionStore([...others, entry]);
  } catch {
    /* ignore */
  }
}

/** Dedupe concurrent fetches for the same subtopic. */
export async function loadDiveContentOnce(
  key: string,
  fetcher: () => Promise<SubtopicContentResponse>,
  opts?: { force?: boolean }
): Promise<SubtopicContentResponse> {
  if (!opts?.force) {
    const cached = getDiveContentCache(key);
    if (cached) return cached;
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetcher()
    .then((data) => {
      setDiveContentCache(key, data);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

/** Drop one key from memory + session so the next load hits the network. */
export function invalidateDiveContentCache(key: string): void {
  memory.delete(key);
  inflight.delete(key);
  if (typeof window === "undefined") return;
  try {
    const others = readSessionStore().filter((e) => e.key !== key);
    writeSessionStore(others);
  } catch {
    /* ignore */
  }
}

export function clearDiveContentCache(): void {
  memory.clear();
  inflight.clear();
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
