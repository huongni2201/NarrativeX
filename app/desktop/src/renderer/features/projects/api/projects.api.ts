import type { CreateProjectInput, DesktopProject } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { assertContract, isRecord, isString } from "../../../api/guards";

export interface ProjectsPage {
  content: DesktopProject[];
  nextCursor: string | null;
}

function isProject(value: unknown): value is DesktopProject {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.status)
  );
}

function parsePage(value: unknown): ProjectsPage {
  assertContract(
    isRecord(value) && Array.isArray(value.content),
    "Projects response không đúng contract.",
  );
  assertContract(
    value.content.every(isProject),
    "Projects response chứa project không hợp lệ.",
  );

  return {
    content: value.content,
    nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null,
  };
}

export const projectsApi = {
  list: () =>
    apiRequest<unknown>(
      "/api/v1/projects/dashboard?limit=50&sort=NEWEST",
      {},
      20_000,
    ).then(parsePage),

  create: (input: CreateProjectInput) =>
    apiRequest<DesktopProject>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  addFavorite: (projectId: string) =>
    apiRequest<void>(`/api/v1/projects/${encodeURIComponent(projectId)}/favorite`, {
      method: "PUT",
    }),

  removeFavorite: (projectId: string) =>
    apiRequest<void>(`/api/v1/projects/${encodeURIComponent(projectId)}/favorite`, {
      method: "DELETE",
    }),

  latestStory: (projectId: string) =>
    apiRequest<{ id: string; projectId: string }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/stories/latest`,
    ),
};
