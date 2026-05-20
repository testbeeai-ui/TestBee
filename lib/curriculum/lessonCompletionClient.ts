import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import {
  lessonCompletionItemsToKeySet,
  type LessonCompletionApiItem,
} from "@/lib/curriculum/lessonCompletionRollup";

export async function fetchAdvancedLessonCompletionKeys(params: {
  subject: string;
  classLevel: number;
  board?: string;
}): Promise<Set<string>> {
  const q = new URLSearchParams({
    subject: params.subject,
    classLevel: String(params.classLevel),
  });
  if (params.board?.trim()) q.set("board", params.board.trim().toLowerCase());
  const res = await fetchWithClientAuth(`/api/user/lesson-completion?${q.toString()}`);
  if (!res.ok) return new Set();
  const json = (await res.json()) as { items?: LessonCompletionApiItem[] };
  return lessonCompletionItemsToKeySet(json.items ?? []);
}
