import { apiRequest } from "@/shared/api/client";

export type VisualBeatReviewStatus = "NEEDS_REVIEW" | "APPROVED";

export interface ApiStoryboardVisualBeat {
  id: number;
  sceneId: number;
  orderIndex: number;
  title: string;
  visualIntent: string;
  reviewStatus: VisualBeatReviewStatus;
  motionAction: string;
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

export function isApiStoryboardVisualBeat(value: unknown): value is ApiStoryboardVisualBeat {
  return (
    isRecord(value) &&
    isNumber(value.id) &&
    isNumber(value.sceneId) &&
    isNumber(value.orderIndex) &&
    isString(value.title) &&
    isString(value.visualIntent) &&
    isReviewStatus(value.reviewStatus) &&
    isString(value.motionAction) &&
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
  get: (projectId: number, chapterId: number) =>
    apiRequest<ApiChapterStoryboard>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/storyboard`,
      {},
      isApiChapterStoryboard,
    ),

  createVisualBeat: (
    projectId: number,
    chapterId: number,
    sceneId: number,
    input: CreateVisualBeatInput,
  ) =>
    apiRequest<ApiStoryboardVisualBeat>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/scenes/${sceneId}/visual-beats`,
      { method: "POST", json: input },
      isApiStoryboardVisualBeat,
    ),

  updateReviewStatus: (
    projectId: number,
    chapterId: number,
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
