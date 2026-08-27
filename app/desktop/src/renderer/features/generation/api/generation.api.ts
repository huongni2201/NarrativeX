import type {
  AnalyzeChapterInput,
  CreateMediaJobInput,
  GenerationJob,
  ImageGenerationProvider,
  ImageGenerationStrategy,
  MediaJobCostEstimate,
  MediaJobDetails,
  MediaReviewInput,
} from "@narrativex/client-contracts";
import { apiCommand, apiRequest } from "../../../api/client.ts";

export interface CurrentMediaJob {
  jobId: string | null;
}

export function normalizeImageStrategy(
  provider: ImageGenerationProvider,
  strategy: ImageGenerationStrategy | null | undefined,
): ImageGenerationStrategy {
  if (provider === "GEMINI_WEB") return "GENERATE_NEW";
  return strategy ?? "GENERATE_NEW";
}

export function normalizeCreateMediaJobInput(input: CreateMediaJobInput): CreateMediaJobInput {
  if (input.visualGenerationMode !== "IMAGE") {
    return { ...input, imageProvider: null, imageGenerationStrategy: null };
  }

  const provider = input.imageProvider ?? "API";
  return {
    ...input,
    imageProvider: provider,
    imageGenerationStrategy: normalizeImageStrategy(provider, input.imageGenerationStrategy),
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
    input?: AnalyzeChapterInput,
  ) =>
    apiRequest<GenerationJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/analysis-jobs`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(input ?? getAnalyzeChapterPreferences()),
      },
    ),

  estimate: (
    projectId: string,
    chapterId: string,
    input: Pick<CreateMediaJobInput, "qualityTier">,
  ) =>
    apiRequest<MediaJobCostEstimate>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/media-jobs/estimate`,
      { method: "POST", body: JSON.stringify(input) },
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
