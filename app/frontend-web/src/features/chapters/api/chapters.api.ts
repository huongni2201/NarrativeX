import type {
  ApiChapter,
  ApiChapterSummary,
  ApiChapterWorkspace,
  ApiGenerationJob,
  CreateChapterApiInput,
  UpdateChapterApiInput,
} from "@/types/api";
import {
  isApiChapter,
  isApiChapterSummary,
  isApiChapterWorkspace,
  isApiGenerationJob,
} from "@/types/api";
import { apiRequest } from "@/shared/api/client";

export const chaptersApi = {
  list: (projectId: number, storyVersionId: number) =>
    apiRequest<ApiChapterSummary[]>(
      `/api/v1/projects/${projectId}/chapters?storyVersionId=${storyVersionId}`,
      {},
      (value): value is ApiChapterSummary[] =>
        Array.isArray(value) && value.every(isApiChapterSummary),
    ),
  getById: (projectId: number, chapterId: number) =>
    apiRequest<ApiChapter>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}`,
      {},
      isApiChapter,
    ),
  getWorkspace: (projectId: number, chapterId: number) =>
    apiRequest<ApiChapterWorkspace>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/workspace`,
      {},
      isApiChapterWorkspace,
    ),
  create: (projectId: number, input: CreateChapterApiInput) =>
    apiRequest<ApiChapter>(
      `/api/v1/projects/${projectId}/chapters`,
      { method: "POST", json: input },
      isApiChapter,
    ),
  batchImport: (projectId: number, storyVersionId: number, file: File) => {
    const form = new FormData();
    form.set("storyVersionId", String(storyVersionId));
    form.set("file", file);
    return apiRequest<ApiChapter[]>(
      `/api/v1/projects/${projectId}/chapters/batch-import`,
      { method: "POST", body: form },
      (value): value is ApiChapter[] => Array.isArray(value) && value.every(isApiChapter),
    );
  },
  update: (
    projectId: number,
    chapterId: number,
    rowVersion: number,
    input: UpdateChapterApiInput,
  ) =>
    apiRequest<ApiChapter>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}`,
      {
        method: "PUT",
        headers: { "If-Match": `"${rowVersion}"` },
        json: input,
      },
      isApiChapter,
    ),
  analyze: (projectId: number, chapterId: number) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/analysis-jobs`,
      { method: "POST" },
      isApiGenerationJob,
    ),
  getAnalysisJob: (jobId: string) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/generation-jobs/${encodeURIComponent(jobId)}`,
      {},
      isApiGenerationJob,
    ),
};
