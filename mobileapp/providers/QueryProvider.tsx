import { useEffect, useState, type ReactNode } from "react";
import { useIsRestoring } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  asyncStoragePersister,
  PERSIST_MAX_AGE_MS,
  shouldPersistQuery,
} from "@/services/cache/persistOptions";
import { queryClient } from "@/services/cache/queryClient";
import { setupOnlineManager } from "@/services/cache/onlineManager";

let onlineManagerReady = false;

function PersistGate({ children }: { children: ReactNode }) {
  const isRestoring = useIsRestoring();
  if (isRestoring) return null;
  return children;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!onlineManagerReady) {
      setupOnlineManager();
      onlineManagerReady = true;
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: PERSIST_MAX_AGE_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" && shouldPersistQuery(query.queryKey),
        },
      }}
    >
      <PersistGate>{children}</PersistGate>
    </PersistQueryClientProvider>
  );
}
