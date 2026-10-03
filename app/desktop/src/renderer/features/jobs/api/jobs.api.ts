import type { DesktopJobHistoryPage } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client.ts";

export const jobsApi = {
  getJobHistory: (limit = 50, cursor?: string, projectId?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) {
      params.set("cursor", cursor);
    }
    if (projectId) {
      params.set("projectId", projectId);
    }
    return apiRequest<DesktopJobHistoryPage>(`/api/v1/jobs/history?${params.toString()}`);
  },
};