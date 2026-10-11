import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { CHAPTER_PYQ_CACHE_VERSION } from "@/lib/chapter-pyq/cacheVersion";
import type { ChapterPyqQuestionBundle } from "@/lib/chapter-pyq/pyqQuestionMap";
import { isChapterPyqStudentVisible } from "@/lib/chapter-pyq/visibleChapters";

const bundleCache = new Map<string, ChapterPyqQuestionBundle>();
const countsCache = new Map<number, Record<string, number>>();

export async function fetchChapterPyqQuestions(
  catalogSlug: string,
  subject = "physics"
): Promise<ChapterPyqQuestionBundle | null> {
  if (!isChapterPyqStudentVisible(subject, catalogSlug)) return null;
  const cacheKey = `${CHAPTER_PYQ_CACHE_VERSION}:${subject}:${catalogSlug}`;
  const cached = bundleCache.get(cacheKey);
  if (cached) return cached;
  const params = new URLSearchParams({
    chapter: catalogSlug,
    subject,
    v: String(CHAPTER_PYQ_CACHE_VERSION),
  });
  const res = await fetchWithClientAuth(`/api/chapter-pyq/questions?${params.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to load chapter questions (${res.status})`);
  }
  const bundle = (await res.json()) as ChapterPyqQuestionBundle;
  bundleCache.set(cacheKey, bundle);
  return bundle;
}

async function loadChapterPyqCountsOnce(): Promise<Record<string, number>> {
  const res = await fetchWithClientAuth(`/api/chapter-pyq/counts?v=${CHAPTER_PYQ_CACHE_VERSION}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load chapter counts (${res.status})`);
  }
  const body = (await res.json().catch(() => null)) as { counts?: Record<string, number> } | null;
  return body?.counts ?? {};
}

export async function fetchChapterPyqCounts(): Promise<Record<string, number>> {
  const cached = countsCache.get(CHAPTER_PYQ_CACHE_VERSION);
  if (cached) return cached;
  try {
    const counts = await loadChapterPyqCountsOnce();
    if (Object.keys(counts).length > 0) countsCache.set(CHAPTER_PYQ_CACHE_VERSION, counts);
    return counts;
  } catch {
    // First hit after a cache miss can outlive the 25s client abort while the
    // server is still filling unstable_cache. One retry then hits the warm copy.
    const counts = await loadChapterPyqCountsOnce();
    if (Object.keys(counts).length > 0) countsCache.set(CHAPTER_PYQ_CACHE_VERSION, counts);
    return counts;
  }
}
