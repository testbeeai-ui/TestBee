import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";
import type { Board, Subject } from "@/types";
import type { DifficultyLevel } from "@/lib/slugs";

export type NumeralsPackClaimResult = {
  awarded: boolean;
  amount: number;
  balance: number | null;
  reason?: string | null;
  claim_date_ist?: string | null;
  score_percent?: number;
  correct?: number;
  total?: number;
};

/**
 * When every numeral (practice formula with questions) for this subtopic level is submitted
 * and server-regraded overall score is ≥60%, grants RDM from `subtopic_numerals_pack_rdm` at most once per IST calendar day
 * per user (global — not per subtopic).
 */
export async function claimNumeralsPackCompleteDailyRdm(params: {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
}): Promise<NumeralsPackClaimResult> {
  const { session } = await safeGetSession();
  if (!session?.access_token) {
    return { awarded: false, amount: 0, balance: null, reason: "not_authenticated" };
  }

  const { data, error } = await supabase.rpc("claim_numerals_pack_complete_daily_rdm", {
    p_board: params.board,
    p_subject: params.subject,
    p_class_level: params.classLevel,
    p_topic: params.topic,
    p_subtopic_name: params.subtopicName,
    p_level: params.level,
  });

  if (error) {
    console.warn("[claimNumeralsPackCompleteDailyRdm]", error.message);
    return { awarded: false, amount: 0, balance: null, reason: error.message };
  }

  const row = data as Record<string, unknown> | null;
  if (!row || typeof row !== "object") {
    return { awarded: false, amount: 0, balance: null, reason: "bad_response" };
  }

  const scorePercent = row.score_percent;
  const correct = row.correct;
  const total = row.total;
  return {
    awarded: Boolean(row.awarded),
    amount: typeof row.amount === "number" ? row.amount : Number(row.amount) || 0,
    balance: typeof row.balance === "number" ? row.balance : null,
    reason: typeof row.reason === "string" ? row.reason : null,
    claim_date_ist: typeof row.claim_date_ist === "string" ? row.claim_date_ist : null,
    score_percent:
      typeof scorePercent === "number"
        ? scorePercent
        : scorePercent == null
          ? undefined
          : Number(scorePercent),
    correct: typeof correct === "number" ? correct : correct == null ? undefined : Number(correct),
    total: typeof total === "number" ? total : total == null ? undefined : Number(total),
  };
}
