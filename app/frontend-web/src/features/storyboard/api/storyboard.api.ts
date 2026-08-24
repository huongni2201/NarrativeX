import { apiRequest } from "@/shared/api/client";
import type { ChapterId, ProjectId, SceneId, VisualBeatId } from "@/types/api";
import {
  isApiChapterStoryboard,
  isApiStoryboardVisualBeat,
  type ApiChapterStoryboard,
  type ApiStoryboardVisualBeat,
  type VisualBeatReviewStatus,
} from "./storyboard.contracts";

export type {
  ApiChapterStoryboard,
  ApiStoryboardScene,
  ApiStoryboardVisualBeat,
  CameraAngle,
  CameraMovement,
  MotionMode,
  VisualBeatReviewStatus,
} from "./storyboard.contracts";

export { isApiChapterStoryboard, isApiStoryboardVisualBeat } from "./storyboard.contracts";

export interface CreateVisualBeatInput {
  title: string;
  visualIntent: string;
}

export const storyboardApi = {
  get: (projectId: ProjectId, chapterId: ChapterId) =>
    apiRequest<ApiChapterStoryboard>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/storyboard`,
      {},
      isApiChapterStoryboard,
    ),

  createVisualBeat: (
    projectId: ProjectId,
    chapterId: ChapterId,
    sceneId: SceneId,
    input: CreateVisualBeatInput,
  ) =>
    apiRequest<ApiStoryboardVisualBeat>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/scenes/${sceneId}/visual-beats`,
      { method: "POST", json: input },
      isApiStoryboardVisualBeat,
    ),

  updateReviewStatus: (
    projectId: ProjectId,
    chapterId: ChapterId,
    sceneId: SceneId,
    beatId: VisualBeatId,
    rowVersion: number,
    status: VisualBeatReviewStatus,
  ) =>
    apiRequest<ApiStoryboardVisualBeat>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/scenes/${sceneId}/visual-beats/${beatId}/review-status`,
      {
        method: "PUT",
        headers: { "If-Match": `"${rowVersion}"` },
        json: { status },
      },
      isApiStoryboardVisualBeat,
    ),
};
