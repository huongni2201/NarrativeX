import type {
  GenerateBatchNarrationInput,
  GenerateNarrationInput,
  GenerateVoicePreviewInput,
  GenerationJob,
  VoicePreviewResult,
} from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";

export function narrationJobPath(
  projectId: string,
  input: Pick<GenerateNarrationInput, "chapterId" | "forceRegenerate">,
) {
  const path = `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(input.chapterId)}/narration-jobs`;
  return input.forceRegenerate ? `${path}?forceRegenerate=true` : path;
}

export const narrationApi = {
  generate: (projectId: string, input: GenerateNarrationInput) =>
    apiRequest<GenerationJob>(narrationJobPath(projectId, input), {
      method: "POST",
      body: JSON.stringify({
        voiceId: input.voiceId,
        speakingRate: input.speakingRate,
        voiceReferenceAssetId: input.voiceReferenceAssetId,
      }),
    }),

  generateBatch: (input: GenerateBatchNarrationInput) =>
    apiRequest<Array<{ chapterId: string; job: GenerationJob }>>(
      `/api/v1/projects/${encodeURIComponent(input.projectId)}/narration-jobs:batch`,
      {
        method: "POST",
        body: JSON.stringify({
          chapterIds: input.chapterIds,
          voiceId: input.voiceId,
          speakingRate: input.speakingRate,
          voiceReferenceAssetId: input.voiceReferenceAssetId,
        }),
      },
    ),

  generatePreview: (projectId: string, input: GenerateVoicePreviewInput) =>
    apiRequest<GenerationJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/voice-preview-jobs`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),

  getPreviewResult: (projectId: string, jobId: string) =>
    apiRequest<VoicePreviewResult>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/voice-preview-jobs/${encodeURIComponent(jobId)}/result`,
    ),
};
