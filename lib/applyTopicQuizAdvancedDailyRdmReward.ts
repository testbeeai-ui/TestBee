import {
  claimTopicQuizAdvancedDailyRdm,
  type TopicQuizAdvancedClaimScope,
  type TopicQuizAdvancedRdmResult,
} from "@/lib/claimTopicQuizAdvancedDailyRdm";
import { useUserStore } from "@/store/useUserStore";

export type ApplyTopicQuizAdvancedDailyRdmOptions = {
  refreshProfile?: () => void | Promise<void>;
};

/** Calls topic-quiz advanced claim RPC and syncs local RDM from server balance when awarded. */
export async function applyTopicQuizAdvancedDailyRdmReward(
  scope: TopicQuizAdvancedClaimScope,
  options?: ApplyTopicQuizAdvancedDailyRdmOptions
): Promise<TopicQuizAdvancedRdmResult> {
  const { data, error } = await claimTopicQuizAdvancedDailyRdm(scope);
  const merged: TopicQuizAdvancedRdmResult =
    error && !data.reason ? { ...data, reason: error.message } : data;

  if (merged.awarded && typeof merged.balance === "number") {
    useUserStore.getState().setRdmFromProfile(merged.balance);
    await options?.refreshProfile?.();
  }
  return merged;
}
