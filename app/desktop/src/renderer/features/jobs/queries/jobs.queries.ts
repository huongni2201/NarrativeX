import { useQuery } from "@tanstack/react-query";
import type { DesktopJobHistoryPage } from "@narrativex/client-contracts";
import { jobsApi } from "../api/jobs.api.ts";

export const jobQueryKeys = {
  all: ["jobs"] as const,
  history: (limit?: number) => [...jobQueryKeys.all, "history", limit ?? 50] as const,
};

export function useJobHistoryQuery(limit = 50) {
  return useQuery<DesktopJobHistoryPage>({
    queryKey: jobQueryKeys.history(limit),
    queryFn: () => jobsApi.getJobHistory(limit),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}