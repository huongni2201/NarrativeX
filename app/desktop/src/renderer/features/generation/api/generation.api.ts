import type {
  CreateMediaJobInput,
  GenerationJob,
  MediaJobDetails,
  MediaReviewInput,
} from "@narrativex/client-contracts";
import { apiCommand, apiRequest } from "../../../api/client.ts";

export const generationApi = {
  analyze: (projectId: string, chapterId: string) =>
    apiRequest<GenerationJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/analysis-jobs`,
      { method: "POST" },
    ),

  estimate: (
    projectId: string,
    chapterId: string,
    input: Pick<CreateMediaJobInput, "qualityTier">,
  ) =>
    apiRequest<{
      visualBeatCount: number;
      unitEstimatedCost: string;
      estimatedCost: string;
      currency: string;
    }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/media-jobs/estimate`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  createMediaJob: (
    projectId: string,
    chapterId: string,
    input: CreateMediaJobInput,
  ) =>
    apiRequest<GenerationJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/media-jobs`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(input),
      },
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
