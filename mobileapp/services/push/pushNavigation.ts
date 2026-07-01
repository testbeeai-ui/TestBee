import { router } from "expo-router";
import { routes } from "@/core/navigation/routes";
import { supportsRemotePush } from "@/services/push/pushCapabilities";

type NotificationResponse = import("expo-notifications").NotificationResponse;

function routeFromPushData(data: Record<string, unknown> | undefined): string {
  const route = typeof data?.route === "string" ? data.route : null;
  if (route === "/notifications" || route === routes.notifications) {
    return routes.notifications;
  }
  if (route?.startsWith("/(tabs)/")) {
    return route;
  }
  if (data?.type === "motivation") {
    return routes.notifications;
  }
  return routes.notifications;
}

/** Navigate when user taps a push notification. */
export function handlePushNotificationResponse(response: NotificationResponse | null): void {
  if (!response) return;
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  const path = routeFromPushData(data);
  router.push(path as never);
}

export function subscribeToPushNotificationResponses(): () => void {
  if (!supportsRemotePush()) {
    return () => {};
  }

  let disposed = false;
  let removeListener: (() => void) | undefined;

  void (async () => {
    const Notifications = await import("expo-notifications");
    if (disposed) return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handlePushNotificationResponse(response);
    });
    removeListener = () => sub.remove();

    const response = await Notifications.getLastNotificationResponseAsync();
    if (!disposed && response) {
      handlePushNotificationResponse(response);
    }
  })();

  return () => {
    disposed = true;
    removeListener?.();
  };
}
