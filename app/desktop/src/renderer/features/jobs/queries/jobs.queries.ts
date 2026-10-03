import { useQuery } from "@tanstack/react-query";
import type { DesktopJobHistoryPage } from "@narrativex/client-contracts";
import { jobsApi } from "../api/jobs.api.ts";

export const jobQueryKeys = {
  all: ["jobs"] as const,
  history: (projectOrLimit?: string | number, limit?: number) => {
    if (typeof projectOrLimit === "number") {
      return [...jobQueryKeys.all, "history", projectOrLimit] as const;
    }
    if (projectOrLimit) {
      return [...jobQueryKeys.all, "history", projectOrLimit, limit ?? 50] as const;
    }
    return [...jobQueryKeys.all, "history", limit ?? 50] as const;
  },
};

export function useJobHistoryQuery(projectId?: string, limit = 50) {
  return useQuery<DesktopJobHistoryPage>({
    queryKey: jobQueryKeys.history(projectId, limit),
    queryFn: () => jobsApi.getJobHistory(limit, undefined, projectId),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}