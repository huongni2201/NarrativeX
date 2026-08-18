import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@/shared/api/client";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Project and library reads are server state. Keep them fresh without
        // refetching on every render; job-specific polling can override this
        // per query once the jobs API is available.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 1;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
