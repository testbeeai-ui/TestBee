import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { pushTokenApi } from "@/services/api/pushToken.api";
import { supportsRemotePush } from "@/services/push/pushCapabilities";

export const PUSH_ENABLED_KEY = "push.enabled.v1";
export const PUSH_TOKEN_STORAGE_KEY = "push.lastToken.v1";

type NotificationsModule = typeof import("expo-notifications");

let notificationsModule: NotificationsModule | null | undefined;

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!supportsRemotePush()) return null;
  if (notificationsModule !== undefined) return notificationsModule;
  try {
    notificationsModule = await import("expo-notifications");
    return notificationsModule;
  } catch {
    notificationsModule = null;
    return null;
  }
}

export async function configurePushNotificationsHandler(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function isPushEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PUSH_ENABLED_KEY);
  return raw !== "false";
}

export async function setPushEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PUSH_ENABLED_KEY, enabled ? "true" : "false");
}

export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
}

async function storePushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

async function clearStoredPushToken(): Promise<void> {
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const fromExtra = extra?.eas?.projectId?.trim();
  if (fromExtra) return fromExtra;
  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || undefined;
}

/** Request OS permission and return Expo push token (null on emulator / denied / Expo Go). */
export async function obtainExpoPushToken(): Promise<string | null> {
  const Notifications = await loadNotifications();
  if (!Notifications || !Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "EduBlast",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId = resolveExpoProjectId();
  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return tokenResult.data;
}

/** Register device token with backend when push is enabled. */
export async function syncPushRegistration(): Promise<{ ok: boolean; token: string | null }> {
  const enabled = await isPushEnabled();
  if (!enabled) {
    return { ok: false, token: null };
  }

  const token = await obtainExpoPushToken();
  if (!token) {
    return { ok: false, token: null };
  }

  await pushTokenApi.register(token);
  await storePushToken(token);
  return { ok: true, token };
}

/** Remove token from backend and local storage. */
export async function unregisterPushToken(): Promise<void> {
  const token = await getStoredPushToken();
  if (token) {
    try {
      await pushTokenApi.unregister(token);
    } catch {
      // best effort when offline
    }
    await clearStoredPushToken();
  }
}
