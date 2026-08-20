import { apiRequest } from "@/shared/api/client";
import { type JobHistoryPage, isJobHistoryPage } from "../types/job-history.types";

export interface ListJobHistoryParams {
  cursor?: string;
  limit?: number;
}

export const jobHistoryApi = {
  list: (params: ListJobHistoryParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set("cursor", params.cursor);
    if (params.limit) searchParams.set("limit", String(params.limit));

    const query = searchParams.toString();
    const endpoint = `/api/v1/jobs/history${query ? `?${query}` : ""}`;

    return apiRequest<JobHistoryPage>(endpoint, {}, isJobHistoryPage);
  },
};
