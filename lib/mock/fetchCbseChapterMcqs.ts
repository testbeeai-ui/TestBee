import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import type { Question } from "@/types";

export type CbseChapterMcqBundle = {
  paperId: string;
  questions: Question[];
};

/** Load published CBSE NCERT chapter paper by catalog slug (e.g. `p11-2`). */
export async function fetchCbseChapterMcqs(
  chapterId: string,
  classLevel: 11 | 12
): Promise<CbseChapterMcqBundle | null> {
  const params = new URLSearchParams({
    chapterId,
    classLevel: String(classLevel),
  });
  const res = await fetchWithClientAuth(`/api/mock/cbse-chapter-mcqs?${params.toString()}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to load chapter MCQs (${res.status})`);
  }
  return (await res.json()) as CbseChapterMcqBundle;
}
