import { apiRequest } from "@/shared/api/client";
import type { ProjectId } from "@/types/api";
import type {
  ApiProjectDashboardPage,
  ProjectDashboardSort,
  ProjectDashboardStatus,
} from "./project-dashboard.types";
import { isApiProjectDashboardPage } from "./project-dashboard.types";

export interface ProjectDashboardListParams {
  cursor?: string;
  limit?: number;
  status?: ProjectDashboardStatus;
  q?: string;
  sort?: ProjectDashboardSort;
}

function dashboardPath({
  cursor,
  limit = 20,
  status,
  q,
  sort = "NEWEST",
}: ProjectDashboardListParams = {}): string {
  const params = new URLSearchParams({ limit: String(limit), sort });
  if (cursor) params.set("cursor", cursor);
  if (status) params.set("status", status);
  if (q?.trim()) params.set("q", q.trim());
  return `/api/v1/projects/dashboard?${params.toString()}`;
}

export const projectDashboardApi = {
  list: (params: ProjectDashboardListParams = {}) =>
    apiRequest<ApiProjectDashboardPage>(dashboardPath(params), {}, isApiProjectDashboardPage),
  favorite: (projectId: ProjectId) =>
    apiRequest<void>(`/api/v1/projects/${projectId}/favorite`, { method: "PUT" }),
  unfavorite: (projectId: ProjectId) =>
    apiRequest<void>(`/api/v1/projects/${projectId}/favorite`, { method: "DELETE" }),
};
