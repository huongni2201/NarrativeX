import { apiRequest } from "@/shared/api/client";
import {
  type ApiGenerationJob,
  type ChapterId,
  isApiGenerationJob,
  type ProjectId,
} from "@/types/api";
import type {
  GenerateBatchNarrationInput,
  GenerateNarrationInput,
} from "../types/narration.types";

export interface BatchNarrationJobResult {
  chapterId: ChapterId;
  job: ApiGenerationJob;
}

function isBatchNarrationJobResult(value: unknown): value is BatchNarrationJobResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BatchNarrationJobResult>;
  return typeof candidate.chapterId === "string" && isApiGenerationJob(candidate.job);
}

export const narrationApi = {
  generateNarration: (
    projectId: ProjectId,
    chapterId: ChapterId,
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
  generateBatchNarration: (projectId: ProjectId, input: GenerateBatchNarrationInput) =>
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
