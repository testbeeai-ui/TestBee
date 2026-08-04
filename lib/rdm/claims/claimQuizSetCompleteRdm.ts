import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";
import type { Board, Subject } from "@/types";
import type { DifficultyLevel } from "@/lib/slugs";

export type QuizSetCompleteClaimResult = {
  awarded: boolean;
  amount: number;
  balance: number | null;
  reason?: string | null;
  quiz_set?: number;
};

/**
 * Credits `subtopic_quiz_set_rdm` once per subtopic for **quiz set 1 only**
 * when that set attempt scores ≥60% (verified on the server). Sets 2+ are not eligible.
 */
export async function claimQuizSetCompleteRdm(params: {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
  quizSet: number;
}): Promise<QuizSetCompleteClaimResult> {
  const { session } = await safeGetSession();
  if (!session?.access_token) {
    return { awarded: false, amount: 0, balance: null, reason: "not_authenticated" };
  }

  const { data, error } = await supabase.rpc("claim_quiz_set_complete_rdm", {
    p_board: params.board,
    p_subject: params.subject,
    p_class_level: params.classLevel,
    p_topic: params.topic,
    p_subtopic_name: params.subtopicName,
    p_level: params.level,
    p_quiz_set: params.quizSet,
  });

  if (error) {
    console.warn("[claimQuizSetCompleteRdm]", error.message);
    return { awarded: false, amount: 0, balance: null, reason: error.message };
  }

  const row = data as Record<string, unknown> | null;
  if (!row || typeof row !== "object") {
    return { awarded: false, amount: 0, balance: null, reason: "bad_response" };
  }

  return {
    awarded: Boolean(row.awarded),
    amount: typeof row.amount === "number" ? row.amount : Number(row.amount) || 0,
    balance: typeof row.balance === "number" ? row.balance : null,
    reason: typeof row.reason === "string" ? row.reason : null,
    quiz_set:
      typeof row.quiz_set === "number"
        ? row.quiz_set
        : row.quiz_set == null
          ? undefined
          : Number(row.quiz_set),
  };
}
