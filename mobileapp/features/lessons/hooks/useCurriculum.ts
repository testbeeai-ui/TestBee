import { useQuery } from "@tanstack/react-query";
import { fetchFullCurriculum } from "@/services/supabase/curriculum.repository";
import { queryKeys, queryStaleTimes } from "@/services/cache/queryKeys";

export function useCurriculum() {
  return useQuery({
    queryKey: queryKeys.curriculum.full,
    queryFn: fetchFullCurriculum,
    staleTime: queryStaleTimes.curriculum,
  });
}
