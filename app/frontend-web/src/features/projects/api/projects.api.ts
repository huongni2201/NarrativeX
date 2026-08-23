import type {
  ApiGenerationJob,
  ApiProject,
  ApiStoryVersion,
  CreateProjectApiInput,
  CreateStoryVersionApiInput,
  CursorPage,
  ProjectId,
} from "@/types/api";
import {
  isApiGenerationJob,
  isApiProject,
  isApiStoryVersion,
  isCursorPage,
} from "@/types/api";
import { apiRequest } from "@/shared/api/client";
import type { ApiProjectOverview } from "./project-overview.types";
import { isApiProjectOverview } from "./project-overview.types";
import type { ApiProjectAsset, ApiProjectLocation } from "./project-resources.types";
import { isApiProjectAsset, isApiProjectLocation } from "./project-resources.types";

const DEFAULT_PROJECT_PAGE_SIZE = 20;

export interface ProjectListParams {
  cursor?: string;
  limit?: number;
}

function projectListPath({
  cursor,
  limit = DEFAULT_PROJECT_PAGE_SIZE,
}: ProjectListParams = {}): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return `/api/v1/projects?${params.toString()}`;
}

function resourceListPath(
  basePath: string,
  { cursor, limit = DEFAULT_PROJECT_PAGE_SIZE }: ProjectListParams = {},
): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return `${basePath}?${params.toString()}`;
}

export const projectsApi = {
  list: (params: ProjectListParams = {}) =>
    apiRequest<CursorPage<ApiProject>>(
      projectListPath(params),
      {},
      (value): value is CursorPage<ApiProject> => isCursorPage(value, isApiProject),
    ),
  getById: (projectId: ProjectId) =>
    apiRequest<ApiProject>(`/api/v1/projects/${projectId}`, {}, isApiProject),
  getOverview: (projectId: ProjectId) =>
    apiRequest<ApiProjectOverview>(
      `/api/v1/projects/${projectId}/overview`,
      {},
      isApiProjectOverview,
    ),
  getLocations: (projectId: ProjectId, params: ProjectListParams = {}) =>
    apiRequest<CursorPage<ApiProjectLocation>>(
      resourceListPath(`/api/v1/projects/${projectId}/locations`, params),
      {},
      (value): value is CursorPage<ApiProjectLocation> =>
        isCursorPage(value, isApiProjectLocation),
    ),
  getAssets: (projectId: ProjectId, params: ProjectListParams = {}) =>
    apiRequest<CursorPage<ApiProjectAsset>>(
      resourceListPath(`/api/v1/projects/${projectId}/assets`, params),
      {},
      (value): value is CursorPage<ApiProjectAsset> => isCursorPage(value, isApiProjectAsset),
    ),
  create: (input: CreateProjectApiInput) =>
    apiRequest<ApiProject>("/api/v1/projects", { method: "POST", json: input }, isApiProject),
  getLatestStoryVersion: (projectId: ProjectId) =>
    apiRequest<ApiStoryVersion>(
      `/api/v1/projects/${projectId}/stories/latest`,
      {},
      isApiStoryVersion,
    ),
  createStoryVersion: (projectId: ProjectId, input: CreateStoryVersionApiInput) =>
    apiRequest<ApiStoryVersion>(
      `/api/v1/projects/${projectId}/stories`,
      { method: "POST", json: input },
      isApiStoryVersion,
    ),
  enqueueAnalysis: (projectId: ProjectId, chapterId: number) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/analysis-jobs`,
      { method: "POST" },
      isApiGenerationJob,
    ),
};
