import { useQuery } from "@tanstack/react-query";
import { profileApi } from "@/services/api/profile.api";
import { queryKeys, queryStaleTimes } from "@/services/cache/queryKeys";
import { useAuth } from "@/providers/AuthProvider";

export function useProfileHubData() {
  const { user } = useAuth();

  const hubQuery = useQuery({
    queryKey: queryKeys.profile.hub,
    queryFn: async () => {
      const [attendance, activity, trial, onboarding] = await Promise.all([
        profileApi.getAttendanceSummary(),
        profileApi.getRdmRecentActivity(28),
        profileApi.getTrialGate(),
        profileApi.getOnboardingReward(),
      ]);
      return {
        attendance,
        activity,
        subscription: { trial, onboarding },
      };
    },
    enabled: Boolean(user),
    staleTime: queryStaleTimes.profile,
  });

  return {
    attendance: hubQuery.data?.attendance ?? null,
    activity: hubQuery.data?.activity ?? null,
    subscription: hubQuery.data?.subscription ?? null,
    loading: hubQuery.isLoading,
    isRefreshing: hubQuery.isFetching,
    refetch: () => void hubQuery.refetch(),
  };
}

/** @deprecated Use useProfileHubData — kept for existing imports */
export const useProfileData = useProfileHubData;
