import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { CHAPTER_PYQ_CACHE_VERSION } from "@/lib/chapter-pyq/cacheVersion";
import type { ChapterPyqQuestionBundle } from "@/lib/chapter-pyq/pyqQuestionMap";
import { isChapterPyqStudentVisible } from "@/lib/chapter-pyq/visibleChapters";

export async function fetchChapterPyqQuestions(
  catalogSlug: string,
  subject = "physics"
): Promise<ChapterPyqQuestionBundle | null> {
  if (!isChapterPyqStudentVisible(subject, catalogSlug)) return null;
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
  return (await res.json()) as ChapterPyqQuestionBundle;
}

async function loadChapterPyqCountsOnce(): Promise<Record<string, number>> {
  const res = await fetchWithClientAuth(`/api/chapter-pyq/counts?v=${CHAPTER_PYQ_CACHE_VERSION}`);
  if (!res.ok) {
    throw new Error(`Failed to load chapter counts (${res.status})`);
  }
  const body = (await res.json().catch(() => null)) as { counts?: Record<string, number> } | null;
  return body?.counts ?? {};
}

export async function fetchChapterPyqCounts(): Promise<Record<string, number>> {
  try {
    return await loadChapterPyqCountsOnce();
  } catch {
    // First hit after a cache miss can outlive the 25s client abort while the
    // server is still filling unstable_cache. One retry then hits the warm copy.
    return await loadChapterPyqCountsOnce();
  }
}
