import { apiRequest } from "@/shared/api/client";
import { type ApiGenerationJob, isApiGenerationJob } from "@/types/api";
import type {
  GenerateBatchNarrationInput,
  GenerateNarrationInput,
} from "../types/narration.types";

export interface BatchNarrationJobResult {
  chapterId: number;
  job: ApiGenerationJob;
}

function isBatchNarrationJobResult(value: unknown): value is BatchNarrationJobResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BatchNarrationJobResult>;
  return typeof candidate.chapterId === "number" && isApiGenerationJob(candidate.job);
}

export const narrationApi = {
  generateNarration: (
    projectId: number,
    chapterId: number,
    input: GenerateNarrationInput,
  ) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/narration-jobs`,
      {
        method: "POST",
        json: {
          voiceId: input.voiceId,
          speakingRate: input.speakingRate ?? 1.0,
          voiceReferenceAssetId: input.voiceReferenceAssetId ?? null,
        },
      },
      isApiGenerationJob,
    ),
  generateBatchNarration: (projectId: number, input: GenerateBatchNarrationInput) =>
    apiRequest<BatchNarrationJobResult[]>(
      `/api/v1/projects/${projectId}/narration-jobs:batch`,
      {
        method: "POST",
        json: {
          chapterIds: input.chapterIds,
          voiceId: input.voiceId,
          speakingRate: input.speakingRate ?? 1.0,
          voiceReferenceAssetId: input.voiceReferenceAssetId ?? null,
        },
      },
      (value): value is BatchNarrationJobResult[] =>
        Array.isArray(value) && value.every(isBatchNarrationJobResult),
    ),
};
