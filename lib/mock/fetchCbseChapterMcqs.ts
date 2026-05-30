import { supabase } from "@/integrations/supabase/client";
import { fetchMockQuestionsForPaper } from "@/lib/mock/mockPapersFromSupabase";
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
  const { data: paper, error } = await supabase
    .from("mock_papers")
    .select("id")
    .eq("slug", chapterId)
    .eq("paper_type", "chapter")
    .eq("board", "CBSE")
    .not("chapter_id", "is", null)
    .eq("class_level", classLevel)
    .eq("published", true)
    .maybeSingle();

  if (error) throw error;
  if (!paper?.id) return null;

  const questions = await fetchMockQuestionsForPaper(paper.id);
  return { paperId: paper.id, questions };
}
