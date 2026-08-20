import { useQuery } from "@tanstack/react-query";
import { jobHistoryApi, type ListJobHistoryParams } from "../api/job-history.api";
import { useAuthStore } from "@/store/useAuthStore";

export const JOB_HISTORY_QUERY_KEY = ["job-history"] as const;

export function useJobHistory(params: ListJobHistoryParams = {}) {
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = status === "authenticated";

  return useQuery({
    queryKey: [...JOB_HISTORY_QUERY_KEY, params],
    queryFn: () => jobHistoryApi.list(params),
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasActive = data.content.some((job) =>
        ["QUEUED", "RUNNING", "UNKNOWN", "STALLED", "PAUSED_COST_LIMIT"].includes(job.status),
      );
      return hasActive ? 3000 : false;
    },
  });
}
