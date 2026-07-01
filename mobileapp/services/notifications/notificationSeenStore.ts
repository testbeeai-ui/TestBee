import AsyncStorage from "@react-native-async-storage/async-storage";

const seenKey = (userId: string) => `notif.seenMotivation.v1:${userId}`;

type Listener = () => void;
const listeners = new Set<Listener>();
const cache = new Map<string, Set<string>>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeNotificationSeen(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNotificationSeenSnapshot(userId: string): Set<string> {
  return cache.get(userId) ?? new Set();
}

export async function loadNotificationSeen(userId: string): Promise<Set<string>> {
  const existing = cache.get(userId);
  if (existing) return existing;

  try {
    const raw = await AsyncStorage.getItem(seenKey(userId));
    if (!raw) {
      const empty = new Set<string>();
      cache.set(userId, empty);
      return empty;
    }
    const ids = JSON.parse(raw) as unknown;
    const set = new Set(
      Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []
    );
    cache.set(userId, set);
    return set;
  } catch {
    const empty = new Set<string>();
    cache.set(userId, empty);
    return empty;
  }
}

export async function markNotificationSeen(userId: string, notificationId: string): Promise<void> {
  const current = cache.get(userId) ?? (await loadNotificationSeen(userId));
  if (current.has(notificationId)) return;
  const next = new Set(current);
  next.add(notificationId);
  cache.set(userId, next);
  await AsyncStorage.setItem(seenKey(userId), JSON.stringify([...next]));
  notify();
}

export async function markManyNotificationsSeen(
  userId: string,
  notificationIds: string[]
): Promise<void> {
  const current = cache.get(userId) ?? (await loadNotificationSeen(userId));
  const next = new Set(current);
  for (const id of notificationIds) next.add(id);
  cache.set(userId, next);
  await AsyncStorage.setItem(seenKey(userId), JSON.stringify([...next]));
  notify();
}
