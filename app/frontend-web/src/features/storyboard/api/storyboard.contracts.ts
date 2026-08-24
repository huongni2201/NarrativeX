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
export type CameraAngle =
  | "WIDE"
  | "MEDIUM"
  | "CLOSE_UP"
  | "EXTREME_CLOSE_UP"
  | "LOW_ANGLE"
  | "HIGH_ANGLE"
  | "OVER_THE_SHOULDER"
  | "POV";

export interface ApiStoryboardVisualBeat {
  id: string;
  sceneId: string;
  orderIndex: number;
  title: string;
  visualIntent: string;
  motionMode: MotionMode;
  cameraMovement: CameraMovement;
  cameraAngle: CameraAngle;
  reviewStatus: VisualBeatReviewStatus;
  aspectRatioOverride: string | null;
  qualityTierOverride: string | null;
  rowVersion: number;
}

export interface ApiStoryboardScene {
  id: string;
  orderIndex: number;
  title: string;
  status: string;
  approvedBeatCount: number;
  totalBeatCount: number;
  visualBeats: ApiStoryboardVisualBeat[];
}

export interface ApiChapterStoryboard {
  chapter: {
    id: string;
    orderIndex: number;
    title: string;
  };
  scenes: ApiStoryboardScene[];
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

function isCameraAngle(value: unknown): value is CameraAngle {
  return (
    value === "WIDE" ||
    value === "MEDIUM" ||
    value === "CLOSE_UP" ||
    value === "EXTREME_CLOSE_UP" ||
    value === "LOW_ANGLE" ||
    value === "HIGH_ANGLE" ||
    value === "OVER_THE_SHOULDER" ||
    value === "POV"
  );
}

export function isApiStoryboardVisualBeat(value: unknown): value is ApiStoryboardVisualBeat {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.sceneId) &&
    isNumber(value.orderIndex) &&
    isString(value.title) &&
    isString(value.visualIntent) &&
    isMotionMode(value.motionMode) &&
    isCameraMovement(value.cameraMovement) &&
    isCameraAngle(value.cameraAngle) &&
    isReviewStatus(value.reviewStatus) &&
    isNullableString(value.aspectRatioOverride) &&
    isNullableString(value.qualityTierOverride) &&
    isNumber(value.rowVersion)
  );
}

function isApiStoryboardScene(value: unknown): value is ApiStoryboardScene {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isNumber(value.orderIndex) &&
    isString(value.title) &&
    isString(value.status) &&
    isNumber(value.approvedBeatCount) &&
    isNumber(value.totalBeatCount) &&
    Array.isArray(value.visualBeats) &&
    value.visualBeats.every(isApiStoryboardVisualBeat)
  );
}

export function isApiChapterStoryboard(value: unknown): value is ApiChapterStoryboard {
  if (!isRecord(value) || !isRecord(value.chapter) || !Array.isArray(value.scenes)) {
    return false;
  }
  return (
    isString(value.chapter.id) &&
    isNumber(value.chapter.orderIndex) &&
    isString(value.chapter.title) &&
    value.scenes.every(isApiStoryboardScene)
  );
}
