import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, queryStaleTimes } from "@/services/cache/queryKeys";
import { fetchMotivationNotifications } from "@/services/supabase/notifications.repository";
import {
  getNotificationSeenSnapshot,
  loadNotificationSeen,
  markNotificationSeen,
  subscribeNotificationSeen,
} from "@/services/notifications/notificationSeenStore";
import type { StudentNotification } from "@/core/domain/notifications";

export function useMotivationNotifications(userId: string | undefined) {
  const seenIds = useSyncExternalStore(
    subscribeNotificationSeen,
    () => (userId ? getNotificationSeenSnapshot(userId) : new Set<string>()),
    () => new Set<string>()
  );

  const query = useQuery({
    queryKey: userId ? queryKeys.notifications.list(userId) : ["notifications", "none"],
    queryFn: async () => {
      const rows = await fetchMotivationNotifications(userId!);
      await loadNotificationSeen(userId!);
      return rows;
    },
    enabled: Boolean(userId),
    staleTime: queryStaleTimes.notifications,
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !seenIds.has(n.id)).length;

  const markSeen = async (id: string) => {
    if (!userId) return;
    await markNotificationSeen(userId, id);
  };

  return {
    notifications,
    unreadCount,
    seenIds,
    markSeen,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

export function useNotificationUnread(userId: string | undefined) {
  const { unreadCount, isLoading } = useMotivationNotifications(userId);
  return { unreadCount, isLoading };
}

export type { StudentNotification };
