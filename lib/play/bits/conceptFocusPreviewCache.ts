import type { SubtopicContentResponse } from "@/lib/curriculum/subtopicContentService";
import type { Board, ClassLevel, Subject } from "@/types";

type KeyInput = {
  board: Board;
  subject: Subject;
  classLevel: ClassLevel;
  topic: string;
  subtopicName: string;
};

type CacheEntry = {
  fetchedAt: number;
  data: SubtopicContentResponse;
};

const LS_PREFIX = "conceptFocus.subtopicPreviewCache.v1:";
const memory = new Map<string, CacheEntry>();

export const DEFAULT_PREVIEW_CACHE_TTL_MS = 30 * 60 * 1000;

export function makeConceptFocusPreviewKey(input: KeyInput): string {
  const board = String(input.board).trim().toUpperCase();
  const subject = String(input.subject).trim().toLowerCase();
  const classLevel = String(input.classLevel).trim();
  const topic = String(input.topic).trim().toLowerCase();
  const subtopicName = String(input.subtopicName).trim().toLowerCase();
  return [board, subject, classLevel, topic, subtopicName].join("|");
}

function readFromSessionStorage(key: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${LS_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEntry> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.fetchedAt !== "number" || !Number.isFinite(parsed.fetchedAt)) return null;
    if (!parsed.data || typeof parsed.data !== "object") return null;
    return parsed as CacheEntry;
  } catch {
    return null;
  }
}

function writeToSessionStorage(key: string, entry: CacheEntry): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // ignore (quota / privacy mode)
  }
}

export function getCachedConceptFocusPreview(
  input: KeyInput,
  opts?: { ttlMs?: number }
): CacheEntry | null {
  const ttlMs = opts?.ttlMs ?? DEFAULT_PREVIEW_CACHE_TTL_MS;
  const key = makeConceptFocusPreviewKey(input);
  const now = Date.now();

  const mem = memory.get(key);
  if (mem && now - mem.fetchedAt <= ttlMs) return mem;
  if (mem) memory.delete(key);

  const ss = readFromSessionStorage(key);
  if (ss && now - ss.fetchedAt <= ttlMs) {
    memory.set(key, ss);
    return ss;
  }
  return null;
}

export function setCachedConceptFocusPreview(input: KeyInput, data: SubtopicContentResponse): void {
  const key = makeConceptFocusPreviewKey(input);
  const entry: CacheEntry = { fetchedAt: Date.now(), data };
  memory.set(key, entry);
  writeToSessionStorage(key, entry);
}

export function clearConceptFocusPreviewCache(): void {
  memory.clear();
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) keys.push(k);
    }
    for (const k of keys) window.sessionStorage.removeItem(k);
  } catch {
    // ignore
  }
}
