import { apiRequest } from "@/shared/api/client";
import type { ProjectId } from "@/types/api";

export type VisualBeatReviewStatus = "NEEDS_REVIEW" | "APPROVED";
export type MotionMode = "STILL" | "BASIC_MOTION" | "AI_VIDEO";
export type CameraMovement =
  | "NONE"
  | "PAN"
  | "TILT"
  | "PUSH_IN"
  | "PULL_OUT"
  | "TRACK"
  | "ZOOM_IN"
  | "ZOOM_OUT"
  | "PARALLAX";

export interface ApiStoryboardVisualBeat {
  id: number;
  sceneId: number;
  orderIndex: number;
  title: string;
  visualIntent: string;
  motionMode: MotionMode;
  cameraMovement: CameraMovement;
  reviewStatus: VisualBeatReviewStatus;
  aspectRatioOverride: string | null;
  qualityTierOverride: string | null;
  rowVersion: number;
}

export interface ApiStoryboardScene {
  id: number;
  orderIndex: number;
  title: string;
  status: string;
  approvedBeatCount: number;
  totalBeatCount: number;
  visualBeats: ApiStoryboardVisualBeat[];
}

export interface ApiChapterStoryboard {
  chapter: {
    id: number;
    orderIndex: number;
    title: string;
  };
  scenes: ApiStoryboardScene[];
}

export interface CreateVisualBeatInput {
  title: string;
  visualIntent: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isReviewStatus(value: unknown): value is VisualBeatReviewStatus {
  return value === "NEEDS_REVIEW" || value === "APPROVED";
}

function isMotionMode(value: unknown): value is MotionMode {
  return value === "STILL" || value === "BASIC_MOTION" || value === "AI_VIDEO";
}

function isCameraMovement(value: unknown): value is CameraMovement {
  return (
    value === "NONE" ||
    value === "PAN" ||
    value === "TILT" ||
    value === "PUSH_IN" ||
    value === "PULL_OUT" ||
    value === "TRACK" ||
    value === "ZOOM_IN" ||
    value === "ZOOM_OUT" ||
    value === "PARALLAX"
  );
}

export function isApiStoryboardVisualBeat(value: unknown): value is ApiStoryboardVisualBeat {
  return (
    isRecord(value) &&
    isNumber(value.id) &&
    isNumber(value.sceneId) &&
    isNumber(value.orderIndex) &&
    isString(value.title) &&
    isString(value.visualIntent) &&
    isMotionMode(value.motionMode) &&
    isCameraMovement(value.cameraMovement) &&
    isReviewStatus(value.reviewStatus) &&
    isNullableString(value.aspectRatioOverride) &&
    isNullableString(value.qualityTierOverride) &&
    isNumber(value.rowVersion)
  );
}

function isApiStoryboardScene(value: unknown): value is ApiStoryboardScene {
  return (
    isRecord(value) &&
    isNumber(value.id) &&
    isNumber(value.orderIndex) &&
    isString(value.title) &&
    isString(value.status) &&
    isNumber(value.approvedBeatCount) &&
    isNumber(value.totalBeatCount) &&
    Array.isArray(value.visualBeats) &&
    value.visualBeats.every(isApiStoryboardVisualBeat)
  );
}

function isApiChapterStoryboard(value: unknown): value is ApiChapterStoryboard {
  if (!isRecord(value) || !isRecord(value.chapter) || !Array.isArray(value.scenes)) {
    return false;
  }
  return (
    isNumber(value.chapter.id) &&
    isNumber(value.chapter.orderIndex) &&
    isString(value.chapter.title) &&
    value.scenes.every(isApiStoryboardScene)
  );
}

export const storyboardApi = {
  get: (projectId: ProjectId, chapterId: string | number) =>
    apiRequest<ApiChapterStoryboard>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/storyboard`,
      {},
      isApiChapterStoryboard,
    ),

  createVisualBeat: (
    projectId: ProjectId,
    chapterId: string | number,
    sceneId: number,
    input: CreateVisualBeatInput,
  ) =>
    apiRequest<ApiStoryboardVisualBeat>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/scenes/${sceneId}/visual-beats`,
      { method: "POST", json: input },
      isApiStoryboardVisualBeat,
    ),

  updateReviewStatus: (
    projectId: ProjectId,
    chapterId: string | number,
    sceneId: number,
    beatId: number,
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
