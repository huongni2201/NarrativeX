import type {
  ApiChapter,
  ApiChapterSummary,
  ApiChapterWorkspace,
  ApiChapterContentVariant,
  ApiChapterLanguageStatus,
  ApiGenerationJob,
  CreateChapterApiInput,
  CursorPage,
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
  projectId: number,
  storyVersionId: number,
  { cursor, limit = 50 }: ChapterListParams = {},
): string {
  const params = new URLSearchParams({
    storyVersionId: String(storyVersionId),
    limit: String(limit),
  });
  if (cursor) params.set("cursor", cursor);
  return `/api/v1/projects/${projectId}/chapters?${params.toString()}`;
}

export const chaptersApi = {
  list: (projectId: number, storyVersionId: number, params: ChapterListParams = {}) =>
    apiRequest<CursorPage<ApiChapterSummary>>(
      chapterListPath(projectId, storyVersionId, params),
      {},
      (value): value is CursorPage<ApiChapterSummary> =>
        isCursorPage(value, isApiChapterSummary),
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
  importContent: (projectId: number, chapterId: number, content: string, title?: string) =>
    apiRequest<{ variantId: number; variantType: string; languageDetectionStatus: string }>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/content`,
      { method: "POST", json: { content, title } },
      (value): value is { variantId: number; variantType: string; languageDetectionStatus: string } =>
        typeof value === "object" && value !== null &&
        typeof (value as { variantId?: unknown }).variantId === "number" &&
        typeof (value as { variantType?: unknown }).variantType === "string" &&
        typeof (value as { languageDetectionStatus?: unknown }).languageDetectionStatus === "string",
    ),
  getLanguageStatus: (projectId: number, chapterId: number) =>
    apiRequest<ApiChapterLanguageStatus>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/language-status`,
      {},
      (value): value is ApiChapterLanguageStatus => {
        if (typeof value !== "object" || value === null) return false;
        const candidate = value as Record<string, unknown>;
        return typeof candidate.sourceVariantId === "number" &&
          (candidate.detectedLanguage === null || typeof candidate.detectedLanguage === "string") &&
          (candidate.confidence === null || typeof candidate.confidence === "number") &&
          (candidate.detector === null || typeof candidate.detector === "string") &&
          typeof candidate.projectLanguage === "string" &&
          typeof candidate.translationStatus === "string" &&
          (candidate.existingTranslationVariantId === null || typeof candidate.existingTranslationVariantId === "number");
      },
    ),
  listContentVariants: (projectId: number, chapterId: number) =>
    apiRequest<ApiChapterContentVariant[]>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/content-variants`,
      {},
      (value): value is ApiChapterContentVariant[] => Array.isArray(value) && value.every((item) => {
        if (typeof item !== "object" || item === null) return false;
        const candidate = item as Record<string, unknown>;
        return typeof candidate.id === "number" && typeof candidate.chapterId === "number" &&
          (candidate.sourceVariantId === null || typeof candidate.sourceVariantId === "number") &&
          (candidate.variantType === "ORIGINAL" || candidate.variantType === "TRANSLATION") &&
          typeof candidate.languageCode === "string" && typeof candidate.content === "string" &&
          typeof candidate.contentHash === "string" &&
          (candidate.sourceContentHash === null || typeof candidate.sourceContentHash === "string") &&
          typeof candidate.translationStatus === "string" && typeof candidate.createdAt === "string";
      }),
    ),
  confirmTranslation: (
    projectId: number,
    chapterId: number,
    input: { sourceVariantId: number; sourceContentHash: string; targetLanguage: string },
  ) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/translations`,
      { method: "POST", json: input },
      isApiGenerationJob,
    ),
  analyze: (projectId: number, chapterId: number, contentVariantId?: number) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/analysis-jobs${contentVariantId ? `?contentVariantId=${contentVariantId}` : ""}`,
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
