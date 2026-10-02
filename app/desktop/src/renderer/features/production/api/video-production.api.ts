import type {
  ChapterProductionResponse,
  ChapterProductionStatus,
  DesktopSelectedTake,
  DesktopTake,
  GenerationStrategy,
} from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";

export interface GenerateShotTakeInput {
  strategy?: GenerationStrategy;
  seed?: number;
  retryFromTakeId?: string;
  retryReason?: string;
}

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

  generateTake: (projectId: string, shotId: string, input: GenerateShotTakeInput = {}) =>
    apiRequest<DesktopTake>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/takes`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),

  selectTake: (projectId: string, shotId: string, input: SelectTakeInput) =>
    apiRequest<DesktopSelectedTake>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/selected-take`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    ),

  updateStrategy: (projectId: string, shotId: string, strategy: GenerationStrategy) =>
    apiRequest<void>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/strategy`,
      {
        method: "PUT",
        body: JSON.stringify({ strategy }),
      },
    ),
};
