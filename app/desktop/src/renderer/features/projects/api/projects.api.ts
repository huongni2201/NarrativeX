import type {
  CreateProjectInput,
  CursorPage,
  DesktopProject,
} from "@narrativex/client-contracts";
import { apiCommand, apiRequest } from "../../../api/client.ts";
import {
  assertContract,
  isNullableString,
  isNumber,
  isRecord,
  isString,
} from "../../../api/guards.ts";
import { collectCursorPages, parseCursorPage } from "../../../api/pagination.ts";

export interface ProjectDashboardCounts {
  all: number;
  active: number;
  draft: number;
}

export interface ProjectsPage extends CursorPage<DesktopProject> {
  counts: ProjectDashboardCounts;
}

const PROJECT_PAGE_LIMIT = 50;

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

async function listPage(cursor: string | null = null): Promise<ProjectsPage> {
  const params = new URLSearchParams({
    limit: String(PROJECT_PAGE_LIMIT),
    sort: "NEWEST",
  });
  if (cursor) params.set("cursor", cursor);
  return apiRequest<unknown>(`/api/v1/projects/dashboard?${params.toString()}`, {}, 20_000).then(
    parsePage,
  );
}

async function listAll(): Promise<ProjectsPage> {
  const pages = await collectCursorPages<ProjectsPage>(
    listPage,
    "Projects pagination returned a repeated cursor.",
  );
  const firstPage = pages[0];
  if (!firstPage) throw new Error("Projects pagination returned no page.");

  return {
    ...firstPage,
    content: pages.flatMap((page) => page.content),
    nextCursor: null,
    hasNext: false,
  };
}

export const projectsApi = {
  list: listAll,

  get: (projectId: string) =>
    apiRequest<DesktopProject>(`/api/v1/projects/${encodeURIComponent(projectId)}`),

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
