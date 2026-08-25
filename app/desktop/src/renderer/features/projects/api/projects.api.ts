import type {
  CreateProjectInput,
  CursorPage,
  DesktopProject,
} from "@narrativex/client-contracts";
import { apiCommand, apiRequest } from "../../../api/client";
import {
  assertContract,
  isNullableString,
  isNumber,
  isRecord,
  isString,
} from "../../../api/guards";
import { parseCursorPage } from "../../../api/pagination";

export interface ProjectDashboardCounts {
  all: number;
  active: number;
  draft: number;
}

export interface ProjectsPage extends CursorPage<DesktopProject> {
  counts: ProjectDashboardCounts;
}

function isProject(value: unknown): value is DesktopProject {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNullableString(value.description) &&
    isNullableString(value.coverImageUrl) &&
    isString(value.status) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    typeof value.isStarred === "boolean" &&
    isRecord(value.metrics) &&
    isNumber(value.metrics.totalChapters) &&
    isNumber(value.metrics.totalScenes) &&
    isNumber(value.metrics.estimatedDurationSeconds)
  );
}

function parsePage(value: unknown): ProjectsPage {
  const page = parseCursorPage(
    value,
    isProject,
    "Projects response không đúng contract.",
  );
  assertContract(isRecord(value), "Projects response không đúng contract.");

  const counts = value.counts;
  assertContract(
    isRecord(counts) &&
      isNumber(counts.all) &&
      isNumber(counts.active) &&
      isNumber(counts.draft),
    "Projects response counts không đúng contract.",
  );

  return {
    ...page,
    counts: {
      all: counts.all,
      active: counts.active,
      draft: counts.draft,
    },
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
