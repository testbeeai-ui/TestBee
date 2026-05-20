import { supabase } from "@/integrations/supabase/client";

export type InstacueDailyRdmResult = {
  awarded: boolean;
  amount: number;
  balance: number | null;
  claim_date_ist?: string;
  reason?: string;
};

function parseRpcPayload(raw: unknown): InstacueDailyRdmResult {
  if (!raw || typeof raw !== "object") {
    return { awarded: false, amount: 0, balance: null, reason: "invalid_response" };
  }
  const o = raw as Record<string, unknown>;
  return {
    awarded: Boolean(o.awarded),
    amount: typeof o.amount === "number" ? o.amount : Number(o.amount) || 0,
    balance: typeof o.balance === "number" ? o.balance : o.balance == null ? null : Number(o.balance),
    claim_date_ist: typeof o.claim_date_ist === "string" ? o.claim_date_ist : undefined,
    reason: typeof o.reason === "string" ? o.reason : undefined,
  };
}

/** Server: first user-created InstaCue / revision card per IST day awards +5 RDM. */
export async function claimInstacueCreateDailyRdm(): Promise<{
  data: InstacueDailyRdmResult;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc("claim_instacue_create_daily_rdm");
  if (error) {
    return { data: { awarded: false, amount: 0, balance: null, reason: error.message }, error };
  }
  return { data: parseRpcPayload(data), error: null };
}
