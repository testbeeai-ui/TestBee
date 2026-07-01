import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { supportsRemotePush } from "@/services/push/pushCapabilities";
import {
  configurePushNotificationsHandler,
  isPushEnabled,
  setPushEnabled,
  syncPushRegistration,
  unregisterPushToken,
} from "@/services/push/pushRegistration";
import { subscribeToPushNotificationResponses } from "@/services/push/pushNavigation";

type PushContextValue = {
  pushEnabled: boolean;
  pushReady: boolean;
  pushSupported: boolean;
  lastToken: string | null;
  setPushNotificationsEnabled: (enabled: boolean) => Promise<void>;
  refreshPushRegistration: () => Promise<void>;
};

const PushContext = createContext<PushContextValue | null>(null);

export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const pushSupported = supportsRemotePush();
  const [pushEnabled, setPushEnabledState] = useState(true);
  const [pushReady, setPushReady] = useState(false);
  const [lastToken, setLastToken] = useState<string | null>(null);

  const refreshPushRegistration = useCallback(async () => {
    if (!isAuthenticated || !pushSupported) return;
    const result = await syncPushRegistration();
    setLastToken(result.token);
  }, [isAuthenticated, pushSupported]);

  useEffect(() => {
    void configurePushNotificationsHandler();
  }, []);

  useEffect(() => {
    void (async () => {
      const enabled = await isPushEnabled();
      setPushEnabledState(pushSupported ? enabled : false);
      setPushReady(true);
    })();
  }, [pushSupported]);

  useEffect(() => {
    if (!isAuthenticated || !pushReady || !pushSupported) return;
    if (pushEnabled) {
      void refreshPushRegistration();
    }
  }, [isAuthenticated, pushEnabled, pushReady, pushSupported, refreshPushRegistration]);

  useEffect(() => {
    if (!isAuthenticated || !pushSupported) return;
    return subscribeToPushNotificationResponses();
  }, [isAuthenticated, pushSupported]);

  useEffect(() => {
    if (!isAuthenticated || !pushSupported) return;

    let disposed = false;
    let removeListener: (() => void) | undefined;

    void (async () => {
      const Notifications = await import("expo-notifications");
      if (disposed) return;

      const sub = Notifications.addNotificationReceivedListener(() => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      });
      removeListener = () => sub.remove();
    })();

    return () => {
      disposed = true;
      removeListener?.();
    };
  }, [isAuthenticated, pushSupported, queryClient]);

  const setPushNotificationsEnabled = useCallback(
    async (enabled: boolean) => {
      if (!pushSupported) return;
      await setPushEnabled(enabled);
      setPushEnabledState(enabled);
      if (enabled) {
        await refreshPushRegistration();
      } else {
        await unregisterPushToken();
        setLastToken(null);
      }
    },
    [pushSupported, refreshPushRegistration]
  );

  return (
    <PushContext.Provider
      value={{
        pushEnabled,
        pushReady,
        pushSupported,
        lastToken,
        setPushNotificationsEnabled,
        refreshPushRegistration,
      }}
    >
      {children}
    </PushContext.Provider>
  );
}

export function usePushNotifications(): PushContextValue {
  const ctx = useContext(PushContext);
  if (!ctx) {
    throw new Error("usePushNotifications must be used within PushNotificationsProvider");
  }
  return ctx;
}
