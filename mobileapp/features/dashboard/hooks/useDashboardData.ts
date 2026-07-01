import { useQuery } from "@tanstack/react-query";
import { addDaysLocal, localDayKeyFromDate, startOfLocalDay } from "@/core/dates/localDay";
import { buildChecklistItems, checklistDoneCount } from "@/core/domain/checklist";
import { dashboardApi } from "@/services/api/dashboard.api";
import { queryKeys, queryStaleTimes } from "@/services/cache/queryKeys";
import { useAuth } from "@/providers/AuthProvider";

export function useDashboardData() {
  const { user } = useAuth();
  const todayStart = startOfLocalDay(new Date());
  const todayKey = localDayKeyFromDate(todayStart);
  const fromKey = localDayKeyFromDate(addDaysLocal(todayStart, -45));

  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboard.summary(todayKey, fromKey),
    queryFn: async () => {
      const [checklist, studyDays] = await Promise.all([
        dashboardApi.getDailyChecklist(),
        dashboardApi.getStudyDays(fromKey, todayKey, todayKey),
      ]);
      return { checklist, studyDays };
    },
    enabled: Boolean(user),
    staleTime: queryStaleTimes.dashboard,
  });

  const checklist = summaryQuery.data?.checklist ?? null;
  const items = buildChecklistItems(checklist);
  const doneCount = checklistDoneCount(checklist);

  return {
    checklist,
    checklistItems: items,
    checklistDoneCount: doneCount,
    checklistLoading: summaryQuery.isLoading,
    checklistError: summaryQuery.isError,
    streak: summaryQuery.data?.studyDays?.summary?.streak ?? 0,
    activeDaysThisMonth: summaryQuery.data?.studyDays?.summary?.activeDaysThisMonth,
    studyDaysLoading: summaryQuery.isLoading,
    isRefreshing: summaryQuery.isFetching,
    refetchAll: () => void summaryQuery.refetch(),
  };
}
