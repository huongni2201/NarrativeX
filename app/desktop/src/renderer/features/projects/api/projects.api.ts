import type {
  CreateProjectInput,
  CursorPage,
  DesktopProject,
} from "@narrativex/client-contracts";
import { apiCommand, apiRequest } from "../../../api/client.ts";

export interface ProjectDashboardCounts {
  all: number;
  active: number;
  draft: number;
}

export interface ProjectsPage extends CursorPage<DesktopProject> {
  counts: ProjectDashboardCounts;
}

export const projectsApi = {
  get: (projectId: string) =>
    apiRequest<DesktopProject>(`/api/v1/projects/${encodeURIComponent(projectId)}`),

  create: (input: CreateProjectInput) =>
    apiRequest<DesktopProject>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  remove: (projectId: string) =>
    apiCommand(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    }),

  addFavorite: (projectId: string) =>
    apiCommand(`/api/v1/projects/${encodeURIComponent(projectId)}/favorite`, {
      method: "PUT",
    }),

  removeFavorite: (projectId: string) =>
    apiCommand(`/api/v1/projects/${encodeURIComponent(projectId)}/favorite`, {
      method: "DELETE",
    }),

  latestStory: (projectId: string) =>
    apiRequest<{ id: string; projectId: string }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/stories/latest`,
    ),
};
