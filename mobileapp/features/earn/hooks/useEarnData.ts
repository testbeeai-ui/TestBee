import { useQuery } from "@tanstack/react-query";
import { earnApi } from "@/services/api/earn.api";
import { queryKeys, queryStaleTimes } from "@/services/cache/queryKeys";

export function useEarnData() {
  const hubQuery = useQuery({
    queryKey: queryKeys.earn.hub,
    queryFn: async () => {
      const [buddy, referrals, leaderboard] = await Promise.all([
        earnApi.getBuddyState(),
        earnApi.getMyReferrals(),
        earnApi.getLeaderboard(),
      ]);
      return {
        buddy,
        referrals: referrals.entries,
        leaderboard: leaderboard.entries,
      };
    },
    staleTime: queryStaleTimes.earn,
  });

  return {
    buddy: hubQuery.data?.buddy,
    referrals: hubQuery.data?.referrals ?? [],
    leaderboard: hubQuery.data?.leaderboard ?? [],
    isLoading: hubQuery.isLoading,
    isRefreshing: hubQuery.isFetching,
    refetch: () => void hubQuery.refetch(),
  };
}
