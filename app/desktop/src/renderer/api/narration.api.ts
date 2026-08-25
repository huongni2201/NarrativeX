import type { GenerateBatchNarrationInput, GenerateNarrationInput, GenerationJob } from "@narrativex/client-contracts";
import { apiRequest } from "./client";

export const narrationApi = {
  generate: (projectId: string, input: GenerateNarrationInput) => apiRequest<GenerationJob>(`/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(input.chapterId)}/narration-jobs`, { method: "POST", body: JSON.stringify({ voiceId: input.voiceId, speakingRate: input.speakingRate, voiceReferenceAssetId: input.voiceReferenceAssetId }) }),
  generateBatch: (input: GenerateBatchNarrationInput) => apiRequest<Array<{ chapterId: string; job: GenerationJob }>>(`/api/v1/projects/${encodeURIComponent(input.projectId)}/narration-jobs:batch`, { method: "POST", body: JSON.stringify({ chapterIds: input.chapterIds, voiceId: input.voiceId, speakingRate: input.speakingRate, voiceReferenceAssetId: input.voiceReferenceAssetId }) }),
};
