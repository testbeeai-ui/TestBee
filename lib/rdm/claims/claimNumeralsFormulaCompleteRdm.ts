import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";
import type { Board, Subject } from "@/types";
import type { DifficultyLevel } from "@/lib/slugs";

export type NumeralsFormulaCompleteClaimResult = {
  awarded: boolean;
  amount: number;
  balance: number | null;
  reason?: string | null;
  formula_index?: number;
};

/**
 * Credits `subtopic_numerals_formula_rdm` once per subtopic for the **first**
 * formula pack with questions only, when that attempt scores ≥60%. Later packs are not eligible.
 */
export async function claimNumeralsFormulaCompleteRdm(params: {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
  formulaIndex: number;
}): Promise<NumeralsFormulaCompleteClaimResult> {
  const { session } = await safeGetSession();
  if (!session?.access_token) {
    return { awarded: false, amount: 0, balance: null, reason: "not_authenticated" };
  }

  const { data, error } = await supabase.rpc("claim_numerals_formula_complete_rdm", {
    p_board: params.board,
    p_subject: params.subject,
    p_class_level: params.classLevel,
    p_topic: params.topic,
    p_subtopic_name: params.subtopicName,
    p_level: params.level,
    p_formula_index: params.formulaIndex,
  });

  if (error) {
    console.warn("[claimNumeralsFormulaCompleteRdm]", error.message);
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
    formula_index:
      typeof row.formula_index === "number"
        ? row.formula_index
        : row.formula_index == null
          ? undefined
          : Number(row.formula_index),
  };
}
