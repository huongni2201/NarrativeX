import type {
  AnalyzeChapterInput,
  CreateMediaJobInput,
  CreateVisualBeatImageAttemptInput,
  GenerationJob,
  MediaJobDetails,
  MediaReviewInput,
  VisualBeatImageAttempt,
} from "../../../../shared/api-types";
import { apiCommand, apiRequest } from "../../../api/client.ts";

export interface CurrentMediaJob {
  jobId: string | null;
}

export function normalizeCreateMediaJobInput(input: CreateMediaJobInput): CreateMediaJobInput {
  const productionMode = input.productionMode ?? "VIDEO_FIRST";
  const visualGenerationMode = input.visualGenerationMode ?? "VIDEO";
  if (visualGenerationMode !== "IMAGE") {
    return { ...input, productionMode, visualGenerationMode, imageProvider: null };
  }

  return {
    ...input,
    productionMode,
    visualGenerationMode,
    imageProvider: input.imageProvider ?? "API",
  };
}

let analyzeChapterPreferences: AnalyzeChapterInput = {
  visualGenerationMode: "VIDEO",
  imageProvider: null,
};

export function setAnalyzeChapterPreferences(input: AnalyzeChapterInput) {
  analyzeChapterPreferences = {
    visualGenerationMode: input.visualGenerationMode,
    imageProvider: input.visualGenerationMode === "IMAGE" ? "API" : null,
  };
}

export function getAnalyzeChapterPreferences(): AnalyzeChapterInput {
  return { ...analyzeChapterPreferences };
}

export const generationApi = {
  analyze: (
    projectId: string,
    chapterId: string,
    input: AnalyzeChapterInput | undefined,
    idempotencyKey: string,
  ) =>
    apiRequest<GenerationJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/analysis-jobs`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input ?? getAnalyzeChapterPreferences()),
      },
    ),


  createMediaJob: (
    projectId: string,
    chapterId: string,
    input: CreateMediaJobInput,
    idempotencyKey: string,
  ) =>
    apiRequest<GenerationJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/media-jobs`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(normalizeCreateMediaJobInput(input)),
      },
    ),

  createVisualBeatImageAttempt: (
    projectId: string,
    chapterId: string,
    visualBeatId: string,
    input: CreateVisualBeatImageAttemptInput,
    idempotencyKey: string,
  ) =>
    apiRequest<GenerationJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/visual-beats/${encodeURIComponent(visualBeatId)}/image-attempts`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    ),

  getVisualBeatImageAttempts: (projectId: string, chapterId: string, visualBeatId: string) =>
    apiRequest<VisualBeatImageAttempt[]>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/visual-beats/${encodeURIComponent(visualBeatId)}/image-attempts`,
    ),

  reviewVisualBeatImageAttempt: (
    projectId: string,
    chapterId: string,
    visualBeatId: string,
    itemId: string,
    input: MediaReviewInput,
  ) =>
    apiCommand(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/visual-beats/${encodeURIComponent(visualBeatId)}/image-attempts/${encodeURIComponent(itemId)}/review`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  selectVisualBeatImageAttempt: (
    projectId: string,
    chapterId: string,
    visualBeatId: string,
    itemId: string,
    expectedVisualBeatRowVersion: number,
  ) =>
    apiRequest<unknown>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/visual-beats/${encodeURIComponent(visualBeatId)}/selected-image`,
      {
        method: "PUT",
        body: JSON.stringify({ itemId, expectedVisualBeatRowVersion }),
      },
    ),

  getCurrentMediaJob: (projectId: string, chapterId: string) =>
    apiRequest<CurrentMediaJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/media-jobs/current`,
    ),

  getGenerationJob: (jobId: string) =>
    apiRequest<GenerationJob>(
      `/api/v1/generation-jobs/${encodeURIComponent(jobId)}`,
    ),

  getJob: (jobId: string) =>
    apiRequest<MediaJobDetails>(`/api/v1/media-jobs/${encodeURIComponent(jobId)}`),

  review: (itemId: string, input: MediaReviewInput) =>
    apiCommand(
      `/api/v1/media-generation-items/${encodeURIComponent(itemId)}/review`,
      { method: "POST", body: JSON.stringify(input) },
    ),
};
