import { apiRequest } from "@/shared/api/client";
import { type ApiGenerationJob, isApiGenerationJob } from "@/types/api";
import type { GenerateNarrationInput } from "../types/narration.types";

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
        },
      },
      isApiGenerationJob,
    ),
};
