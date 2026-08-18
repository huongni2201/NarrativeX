import type {
  ApiChapter,
  ApiChapterSummary,
  CreateChapterApiInput,
  UpdateChapterApiInput,
} from "@/types/api";
import { isApiChapter, isApiChapterSummary } from "@/types/api";
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
  create: (projectId: number, input: CreateChapterApiInput) =>
    apiRequest<ApiChapter>(
      `/api/v1/projects/${projectId}/chapters`,
      { method: "POST", json: input },
      isApiChapter,
    ),
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
};
