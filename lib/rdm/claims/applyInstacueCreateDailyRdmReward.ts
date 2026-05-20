import { claimInstacueCreateDailyRdm, type InstacueDailyRdmResult } from "@/lib/rdm/claims/claimInstacueDailyRdm";
import { useUserStore } from "@/store/useUserStore";

export type ApplyInstacueCreateDailyRdmOptions = {
  /** Keeps useAuth().profile.rdm in sync with Supabase (e.g. EduFund reads profile, not only the store). */
  refreshProfile?: () => void | Promise<void>;
};

/** Calls InstaCue daily claim RPC and syncs local RDM from server balance when awarded. */
export async function applyInstacueCreateDailyRdmReward(
  options?: ApplyInstacueCreateDailyRdmOptions
): Promise<InstacueDailyRdmResult> {
  const { data, error } = await claimInstacueCreateDailyRdm();
  const merged: InstacueDailyRdmResult =
    error && !data.reason ? { ...data, reason: error.message } : data;

  if (merged.awarded && typeof merged.balance === "number") {
    useUserStore.getState().setRdmFromProfile(merged.balance);
    await options?.refreshProfile?.();
  }
  return merged;
}
