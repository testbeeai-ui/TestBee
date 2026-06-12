import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapCatalogQuestionRowToQuestion,
  type CatalogQuestionRow,
} from "@/lib/mock/catalogQuestionMap";
import type { Question } from "@/types";
import type { CbseChapterMcqBundle } from "@/lib/mock/fetchCbseChapterMcqs";

async function fetchQuestionsForPaper(
  supabase: SupabaseClient,
  paperId: string
): Promise<Question[]> {
  const { data, error } = await supabase
    .from("mock_questions")
    .select(
      "id, paper_id, sort_order, subject, topic, chapter, difficulty, question_html, solution_html, correct_letter, options_json"
    )
    .eq("paper_id", paperId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as CatalogQuestionRow[];
  return rows.map((row) => mapCatalogQuestionRowToQuestion(row, "Mock"));
}

/** Server-side CBSE chapter MCQ load (for cached API route). */
export async function fetchCbseChapterMcqsServer(
  supabase: SupabaseClient,
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

  const questions = await fetchQuestionsForPaper(supabase, paper.id);
  return { paperId: paper.id, questions };
}
