import { useQuery } from "@tanstack/react-query";
import type { DesktopJobHistoryPage } from "../../../../shared/api-types";
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
    // Faster while something runs, so a progress bar moves instead of jumping every 10 s.
    refetchInterval: (query) =>
      query.state.data?.content.some((job) => job.status === "RUNNING") ? 3_000 : 10_000,
    staleTime: 5_000,
  });
}