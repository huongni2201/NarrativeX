import type {
  ConfirmChapterTranslationInput,
  CreateMediaJobInput,
  GenerationJob,
  MediaJobCostEstimate,
  MediaJobDetails,
  MediaReviewInput,
} from "@narrativex/client-contracts";
import { apiCommand, apiRequest } from "../../../api/client.ts";

export interface CurrentMediaJob {
  jobId: string | null;
}

export const generationApi = {
  analyze: (projectId: string, chapterId: string, contentVariantId?: string | null) => {
    const params = new URLSearchParams();
    if (contentVariantId) params.set("contentVariantId", contentVariantId);
    const query = params.size ? `?${params.toString()}` : "";
    return apiRequest<GenerationJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/analysis-jobs${query}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      },
    );
  },

  translateChapter: (
    projectId: string,
    chapterId: string,
    input: ConfirmChapterTranslationInput,
  ) =>
    apiRequest<GenerationJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/translations`,
      { method: "POST", body: JSON.stringify(input) },
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
        body: JSON.stringify(input),
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
