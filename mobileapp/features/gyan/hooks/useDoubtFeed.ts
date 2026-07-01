import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/services/cache/queryKeys";
import { fetchDoubtsFeed } from "@/services/supabase/doubts.repository";

export function useDoubtFeed() {
  return useQuery({
    queryKey: queryKeys.gyan.feed,
    queryFn: fetchDoubtsFeed,
    staleTime: 60_000,
  });
}
