import type {
  ChapterProductionResponse,
  ChapterProductionStatus,
  DesktopSelectedTake,
  DesktopTake,
  GenerationStrategy,
  GenerateShotTakeInput,
  ShotAudioCueAllocationSet,
  TakeContentReviewChecklist,
} from "../../../../shared/api-types";
import { apiCommand, apiRequest } from "../../../api/client.ts";

export type { GenerateShotTakeInput } from "../../../../shared/api-types";

export interface SelectTakeInput {
  takeId: string;
  sourceInMs: number;
  sourceOutMs: number;
  expectedRowVersion: number;
  contentReview: TakeContentReviewChecklist;
}

export interface ReplaceShotAudioCueAllocationsInput {
  expectedRowVersion: number;
  allocations: Array<{ audioCueId: string; shotId: string }>;
}

export const videoProductionApi = {
  getProductionStatus: (projectId: string, chapterId: string) =>
    apiRequest<ChapterProductionStatus>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/production/status`,
    ),

  getProduction: (projectId: string, chapterId: string) =>
    apiRequest<ChapterProductionResponse>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/production`,
    ),

  generateTake: (projectId: string, shotId: string, input: GenerateShotTakeInput = {}) => {
    input.idempotencyKey ??= crypto.randomUUID();
    const { idempotencyKey, ...body } = input;
    return apiRequest<DesktopTake>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/takes`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      },
    );
  },

  selectTake: (projectId: string, shotId: string, input: SelectTakeInput) =>
    apiRequest<DesktopSelectedTake>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/selected-take`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    ),

  getShotAudioCueAllocations: (projectId: string, sequenceId: string) =>
    apiRequest<ShotAudioCueAllocationSet>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/shot-sequences/${encodeURIComponent(sequenceId)}/audio-cue-allocations`,
    ),

  replaceShotAudioCueAllocations: (
    projectId: string,
    sequenceId: string,
    input: ReplaceShotAudioCueAllocationsInput,
  ) =>
    apiRequest<ShotAudioCueAllocationSet>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/shot-sequences/${encodeURIComponent(sequenceId)}/audio-cue-allocations`,
      { method: "PUT", body: JSON.stringify(input) },
    ),

  updateStrategy: (projectId: string, shotId: string, strategy: GenerationStrategy) =>
    apiCommand(
      `/api/v1/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/strategy`,
      {
        method: "PUT",
        body: JSON.stringify({ strategy }),
      },
    ),
};
