import type {
  ApiChapter,
  ApiChapterSummary,
  ApiChapterWorkspace,
  ApiChapterContentVariant,
  ApiChapterLanguageStatus,
  ApiGenerationJob,
  ChapterId,
  CreateChapterApiInput,
  CursorPage,
  ProjectId,
  ResourceId,
  StoryVersionId,
  UpdateChapterApiInput,
} from "@/types/api";
import {
  isApiChapter,
  isApiChapterSummary,
  isApiChapterWorkspace,
  isApiGenerationJob,
  isCursorPage,
} from "@/types/api";
import { apiRequest } from "@/shared/api/client";

export interface ChapterListParams {
  cursor?: string;
  limit?: number;
}

function chapterListPath(
  projectId: ProjectId,
  storyVersionId: StoryVersionId,
  { cursor, limit = 50 }: ChapterListParams = {},
): string {
  const params = new URLSearchParams({ storyVersionId, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return `/api/v1/projects/${projectId}/chapters?${params.toString()}`;
}

export const chaptersApi = {
  list: (projectId: ProjectId, storyVersionId: StoryVersionId, params: ChapterListParams = {}) =>
    apiRequest<CursorPage<ApiChapterSummary>>(
      chapterListPath(projectId, storyVersionId, params),
      {},
      (value): value is CursorPage<ApiChapterSummary> => isCursorPage(value, isApiChapterSummary),
    ),
  getById: (projectId: ProjectId, chapterId: ChapterId) =>
    apiRequest<ApiChapter>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}`,
      {},
      isApiChapter,
    ),
  getWorkspace: (projectId: ProjectId, chapterId: ChapterId) =>
    apiRequest<ApiChapterWorkspace>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/workspace`,
      {},
      isApiChapterWorkspace,
    ),
  create: (projectId: ProjectId, input: CreateChapterApiInput, idempotencyKey = crypto.randomUUID()) =>
    apiRequest<ApiChapter>(
      `/api/v1/projects/${projectId}/chapters`,
      { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, json: input },
      isApiChapter,
    ),
  batchImport: (projectId: ProjectId, file: File, storyVersionId?: StoryVersionId) => {
    const form = new FormData();
    if (storyVersionId !== undefined) form.set("storyVersionId", storyVersionId);
    form.set("file", file);
    return apiRequest<ApiChapter[]>(
      `/api/v1/projects/${projectId}/chapters/batch-import`,
      { method: "POST", body: form },
      (value): value is ApiChapter[] => Array.isArray(value) && value.every(isApiChapter),
    );
  },
  update: (
    projectId: ProjectId,
    chapterId: ChapterId,
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
  delete: (projectId: ProjectId, chapterId: ChapterId) =>
    apiRequest<void>(`/api/v1/projects/${projectId}/chapters/${chapterId}`, { method: "DELETE" }),
  importContent: (projectId: ProjectId, chapterId: ChapterId, content: string, title?: string) =>
    apiRequest<{ variantId: ResourceId; variantType: string; languageDetectionStatus: string }>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/content`,
      { method: "POST", json: { content, title } },
      (value): value is { variantId: ResourceId; variantType: string; languageDetectionStatus: string } =>
        typeof value === "object" && value !== null &&
        typeof (value as { variantId?: unknown }).variantId === "string" &&
        typeof (value as { variantType?: unknown }).variantType === "string" &&
        typeof (value as { languageDetectionStatus?: unknown }).languageDetectionStatus === "string",
    ),
  getLanguageStatus: (projectId: ProjectId, chapterId: ChapterId) =>
    apiRequest<ApiChapterLanguageStatus>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/language-status`,
      {},
      (value): value is ApiChapterLanguageStatus => {
        if (typeof value !== "object" || value === null) return false;
        const candidate = value as Record<string, unknown>;
        return typeof candidate.sourceVariantId === "string" &&
          (candidate.detectedLanguage === null || typeof candidate.detectedLanguage === "string") &&
          (candidate.confidence === null || typeof candidate.confidence === "number") &&
          (candidate.detector === null || typeof candidate.detector === "string") &&
          typeof candidate.projectLanguage === "string" &&
          typeof candidate.translationStatus === "string" &&
          (candidate.existingTranslationVariantId === null || typeof candidate.existingTranslationVariantId === "string");
      },
    ),
  listContentVariants: (projectId: ProjectId, chapterId: ChapterId) =>
    apiRequest<ApiChapterContentVariant[]>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/content-variants`,
      {},
      (value): value is ApiChapterContentVariant[] => Array.isArray(value) && value.every((item) => {
        if (typeof item !== "object" || item === null) return false;
        const candidate = item as Record<string, unknown>;
        return typeof candidate.id === "string" && typeof candidate.chapterId === "string" &&
          (candidate.sourceVariantId === null || typeof candidate.sourceVariantId === "string") &&
          (candidate.variantType === "ORIGINAL" || candidate.variantType === "TRANSLATION") &&
          typeof candidate.languageCode === "string" && typeof candidate.content === "string" &&
          typeof candidate.contentHash === "string" &&
          (candidate.sourceContentHash === null || typeof candidate.sourceContentHash === "string") &&
          typeof candidate.translationStatus === "string" && typeof candidate.createdAt === "string";
      }),
    ),
  confirmTranslation: (
    projectId: ProjectId,
    chapterId: ChapterId,
    input: { sourceVariantId: ResourceId; sourceContentHash: string; targetLanguage: string },
  ) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/translations`,
      { method: "POST", json: input },
      isApiGenerationJob,
    ),
  analyze: (projectId: ProjectId, chapterId: ChapterId, contentVariantId?: ResourceId) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/analysis-jobs${contentVariantId ? `?contentVariantId=${contentVariantId}` : ""}`,
      { method: "POST" },
      isApiGenerationJob,
    ),
  getAnalysisJob: (jobId: ResourceId) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/generation-jobs/${encodeURIComponent(jobId)}`,
      {},
      isApiGenerationJob,
    ),
};
