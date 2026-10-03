import type {
  ChapterProductionResponse,
  ChapterProductionStatus,
  DesktopSelectedTake,
  DesktopTake,
  GenerationStrategy,
  GenerateShotTakeInput,
} from "@narrativex/client-contracts";
import { apiCommand, apiRequest } from "../../../api/client.ts";

export type { GenerateShotTakeInput } from "@narrativex/client-contracts";

export interface SelectTakeInput {
  takeId: string;
  sourceInMs: number;
  sourceOutMs: number;
  expectedShotRowVersion?: number;
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

  updateStrategy: (projectId: string, shotId: string, strategy: GenerationStrategy) =>
    apiCommand(
      `/api/v1/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/strategy`,
      {
        method: "PUT",
        body: JSON.stringify({ strategy }),
      },
    ),
};
