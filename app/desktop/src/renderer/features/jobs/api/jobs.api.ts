import type { DesktopJobHistoryPage } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client.ts";

export const jobsApi = {
  getJobHistory: (limit = 50, cursor?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) {
      params.set("cursor", cursor);
    }
    return apiRequest<DesktopJobHistoryPage>(`/api/v1/jobs/history?${params.toString()}`);
  },
};