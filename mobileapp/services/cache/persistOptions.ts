import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { queryKeys } from "./queryKeys";

export const QUERY_CACHE_KEY = "edublast.query-cache.v1";

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 2_000,
});

/** Keys worth persisting for offline read. */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  if (typeof root !== "string") return false;
  return (
    root === "dashboard" ||
    root === queryKeys.curriculum.full[0] ||
    root === queryKeys.newsBlog.all[0] ||
    root === "notifications" ||
    root === queryKeys.profile.hub[0]
  );
}

export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
