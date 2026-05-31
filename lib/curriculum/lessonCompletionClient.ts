import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import {
  lessonCompletionItemsToKeySet,
  type LessonCompletionApiItem,
} from "@/lib/curriculum/lessonCompletionRollup";

const CACHE_TTL_MS = 30_000;

const cached = new Map<string, { at: number; keys: Set<string> }>();
const inFlight = new Map<string, Promise<Set<string>>>();

function cacheKey(params: { subject: string; classLevel: number; board?: string }): string {
  const board = params.board?.trim().toLowerCase() ?? "";
  return `${params.subject}|${params.classLevel}|${board}`;
}

export function invalidateLessonCompletionCache(): void {
  cached.clear();
  inFlight.clear();
}

export async function fetchAdvancedLessonCompletionKeys(params: {
  subject: string;
  classLevel: number;
  board?: string;
  fresh?: boolean;
}): Promise<Set<string>> {
  const key = cacheKey(params);
  const now = Date.now();

  if (!params.fresh) {
    const hit = cached.get(key);
    if (hit && now - hit.at < CACHE_TTL_MS) {
      return hit.keys;
    }
    const pending = inFlight.get(key);
    if (pending) return pending;
  }

  const promise = (async () => {
    const q = new URLSearchParams({
      subject: params.subject,
      classLevel: String(params.classLevel),
    });
    if (params.board?.trim()) q.set("board", params.board.trim().toLowerCase());
    const res = await fetchWithClientAuth(`/api/user/lesson-completion?${q.toString()}`);
    if (!res.ok) return new Set<string>();
    const json = (await res.json()) as { items?: LessonCompletionApiItem[] };
    const keys = lessonCompletionItemsToKeySet(json.items ?? []);
    cached.set(key, { at: Date.now(), keys });
    return keys;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

/** Home dashboard: three subjects in parallel, one network call each (deduped per subject). */
export async function fetchMergedAdvancedLessonCompletionKeys(
  subjects: string[],
  classLevel: number,
  board?: string
): Promise<Set<string>> {
  const results = await Promise.all(
    subjects.map((subject) =>
      fetchAdvancedLessonCompletionKeys({ subject, classLevel, board })
    )
  );
  const merged = new Set<string>();
  for (const s of results) {
    for (const k of s) merged.add(k);
  }
  return merged;
}
