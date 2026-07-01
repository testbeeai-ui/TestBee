import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes("Network")) {
          return failureCount < 1;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      networkMode: "offlineFirst",
    },
  },
});
