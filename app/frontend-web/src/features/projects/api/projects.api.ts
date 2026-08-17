import type {
  ApiGenerationJob,
  ApiProject,
  ApiStoryVersion,
  CreateProjectApiInput,
  CreateStoryVersionApiInput,
  PaginationResponse,
} from "@/types/api";
import {
  isApiGenerationJob,
  isApiProject,
  isApiStoryVersion,
  isPaginationResponse,
} from "@/types/api";
import { apiRequest } from "@/shared/api/client";

const DEFAULT_PROJECT_PAGE = 0;
const DEFAULT_PROJECT_PAGE_SIZE = 20;

export interface ProjectListParams {
  page?: number;
  size?: number;
}

function projectListPath({ page = DEFAULT_PROJECT_PAGE, size = DEFAULT_PROJECT_PAGE_SIZE }: ProjectListParams = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return `/api/v1/projects?${params.toString()}`;
}

export const projectsApi = {
  list: (params: ProjectListParams = {}) =>
    apiRequest<PaginationResponse<ApiProject>>(
      projectListPath(params),
      {},
      (value): value is PaginationResponse<ApiProject> => isPaginationResponse(value, isApiProject),
    ),
  create: (input: CreateProjectApiInput) =>
    apiRequest<ApiProject>("/api/v1/projects", { method: "POST", json: input }, isApiProject),
  createStoryVersion: (projectId: number, input: CreateStoryVersionApiInput) =>
    apiRequest<ApiStoryVersion>(
      `/api/v1/projects/${projectId}/stories`,
      { method: "POST", json: input },
      isApiStoryVersion,
    ),
  enqueueAnalysis: (projectId: number) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/analysis-jobs`,
      { method: "POST" },
      isApiGenerationJob,
    ),
};
