import type {
  AnalyzeChapterInput,
  CreateMediaJobInput,
  GenerationJob,
  MediaJobDetails,
  MediaReviewInput,
} from "@narrativex/client-contracts";
import { apiCommand, apiRequest } from "../../../api/client.ts";

export interface CurrentMediaJob {
  jobId: string | null;
}

export function normalizeCreateMediaJobInput(input: CreateMediaJobInput): CreateMediaJobInput {
  if (input.visualGenerationMode !== "IMAGE") {
    return { ...input, imageProvider: null };
  }

  return {
    ...input,
    imageProvider: input.imageProvider ?? "API",
  };
}

let analyzeChapterPreferences: AnalyzeChapterInput = {
  visualGenerationMode: "IMAGE",
  imageProvider: "GEMINI_WEB",
};

export function setAnalyzeChapterPreferences(input: AnalyzeChapterInput) {
  analyzeChapterPreferences = {
    visualGenerationMode: input.visualGenerationMode,
    imageProvider: input.visualGenerationMode === "IMAGE" ? input.imageProvider ?? "GEMINI_WEB" : null,
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
