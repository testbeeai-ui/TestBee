import { supabase } from "@/integrations/supabase/client";

export type TopicQuizAdvancedRdmResult = {
  awarded: boolean;
  amount: number;
  balance: number | null;
  claim_date_ist?: string;
  reason?: string;
  score_percent?: number;
  correct?: number;
  total?: number;
};

function parseRpcPayload(raw: unknown): TopicQuizAdvancedRdmResult {
  if (!raw || typeof raw !== "object") {
    return { awarded: false, amount: 0, balance: null, reason: "invalid_response" };
  }
  const o = raw as Record<string, unknown>;
  const scorePercent = o.score_percent;
  const correct = o.correct;
  const total = o.total;
  return {
    awarded: Boolean(o.awarded),
    amount: typeof o.amount === "number" ? o.amount : Number(o.amount) || 0,
    balance: typeof o.balance === "number" ? o.balance : o.balance == null ? null : Number(o.balance),
    claim_date_ist: typeof o.claim_date_ist === "string" ? o.claim_date_ist : undefined,
    reason: typeof o.reason === "string" ? o.reason : undefined,
    score_percent:
      typeof scorePercent === "number" ? scorePercent : scorePercent == null ? undefined : Number(scorePercent),
    correct: typeof correct === "number" ? correct : correct == null ? undefined : Number(correct),
    total: typeof total === "number" ? total : total == null ? undefined : Number(total),
  };
}

export type TopicQuizAdvancedClaimScope = {
  board: string;
  subject: string;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
};

/** Server verifies all advanced sets + re-grades from Supabase content; awards +15 RDM at most once per IST day. */
export async function claimTopicQuizAdvancedDailyRdm(
  scope: TopicQuizAdvancedClaimScope
): Promise<{ data: TopicQuizAdvancedRdmResult; error: Error | null }> {
  const { data, error } = await supabase.rpc("claim_topic_quiz_advanced_daily_rdm", {
    p_board: scope.board,
    p_subject: scope.subject,
    p_class_level: scope.classLevel,
    p_topic: scope.topic,
    p_subtopic_name: scope.subtopicName,
  });
  if (error) {
    return { data: { awarded: false, amount: 0, balance: null, reason: error.message }, error };
  }
  return { data: parseRpcPayload(data), error: null };
}
