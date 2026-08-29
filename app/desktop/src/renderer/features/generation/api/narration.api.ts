import type {
  GenerateBatchNarrationInput,
  GenerateNarrationInput,
  GenerateVoicePreviewInput,
  GenerationJob,
  VoicePreviewResult,
} from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";

export const narrationApi = {
  generate: (projectId: string, input: GenerateNarrationInput) =>
    apiRequest<GenerationJob>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(input.chapterId)}/narration-jobs?forceRegenerate=true`,
      {
        method: "POST",
        body: JSON.stringify({
          voiceId: input.voiceId,
          speakingRate: input.speakingRate,
          voiceReference: input.voiceReference,
        }),
      },
    ),

  generateBatch: (input: GenerateBatchNarrationInput) =>
    apiRequest<Array<{ chapterId: string; job: GenerationJob }>>(
      `/api/v1/projects/${encodeURIComponent(input.projectId)}/narration-jobs:batch`,
      {
        method: "POST",
        body: JSON.stringify({
          chapterIds: input.chapterIds,
          voiceId: input.voiceId,
          speakingRate: input.speakingRate,
          voiceReference: input.voiceReference,
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
