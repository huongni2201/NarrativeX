import type {
  ApiGenerationJob,
  ApiProject,
  ApiStoryVersion,
  CreateProjectApiInput,
  CreateStoryVersionApiInput,
  CursorPage,
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

export const projectsApi = {
  list: (params: ProjectListParams = {}) =>
    apiRequest<CursorPage<ApiProject>>(
      projectListPath(params),
      {},
      (value): value is CursorPage<ApiProject> => isCursorPage(value, isApiProject),
    ),
  getById: (projectId: number) =>
    apiRequest<ApiProject>(`/api/v1/projects/${projectId}`, {}, isApiProject),
  getOverview: (projectId: number) =>
    apiRequest<ApiProjectOverview>(
      `/api/v1/projects/${projectId}/overview`,
      {},
      isApiProjectOverview,
    ),
  create: (input: CreateProjectApiInput) =>
    apiRequest<ApiProject>("/api/v1/projects", { method: "POST", json: input }, isApiProject),
  getLatestStoryVersion: (projectId: number) =>
    apiRequest<ApiStoryVersion>(
      `/api/v1/projects/${projectId}/stories/latest`,
      {},
      isApiStoryVersion,
    ),
  createStoryVersion: (projectId: number, input: CreateStoryVersionApiInput) =>
    apiRequest<ApiStoryVersion>(
      `/api/v1/projects/${projectId}/stories`,
      { method: "POST", json: input },
      isApiStoryVersion,
    ),
  enqueueAnalysis: (projectId: number, chapterId: number) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/analysis-jobs`,
      { method: "POST" },
      isApiGenerationJob,
    ),
};
