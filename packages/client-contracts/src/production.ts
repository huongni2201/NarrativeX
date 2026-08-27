export type BeatMediaFitMode = "TRIM" | "LOOP" | "FREEZE_END" | "SPEED_ADJUST";
export type BeatMediaType = "IMAGE" | "VIDEO";
export type BeatMediaStorageMode = "REMOTE" | "LOCAL_ONLY" | "HYBRID";
export type AutoEditStyle = "AUTO" | "CINEMATIC" | "BALANCED" | "DYNAMIC";

export interface DesktopTimelineBeat {
  chapterId: string;
  sceneIndex: number;
  beatIndex: number;
  visualBeatId: string;
  title: string;
  visualIntent: string;
  cameraMovement: string;
  assetStrategy: string;
  mediaAssetId: string | null;
  mediaType: BeatMediaType | null;
  storageMode: BeatMediaStorageMode | null;
  sourceDurationMs: number | null;
  fitMode: BeatMediaFitMode;
  trimStartMs: number;
  mediaSelectionActive: boolean;
  startMs: number;
  endMs: number;
  durationMs: number;
  assetReady: boolean;
}

export interface DesktopTimeline {
  projectId: string;
  storyVersionId: string;
  totalDurationMs: number;
  aspectRatio: string;
  readyForRender: boolean;
  chapters: import("./chapter").DesktopChapter[];
  beats: DesktopTimelineBeat[];
}

export interface UpdateBeatMediaInput {
  mediaAssetId: string;
  fitMode?: BeatMediaFitMode;
  trimStartMs?: number;
}

/** Render-only edit parameters. Media selection itself is persisted through updateBeatMedia. */
export interface ProjectRenderBeatOverride {
  visualBeatId: string;
  durationMs?: number;
  cameraMovement?: string;
  fitMode?: BeatMediaFitMode;
  trimStartMs?: number;
}

export interface AutoEditBeatDecision extends ProjectRenderBeatOverride {
  fitMode: BeatMediaFitMode;
  trimStartMs: number;
  cameraMovement: string;
  source: "AI_DIRECTED" | "RULE_ENGINE";
  reason: string;
}

export interface AutoEditPlan {
  version: 1;
  projectId: string;
  style: AutoEditStyle;
  decisions: AutoEditBeatDecision[];
  renderOverrides: ProjectRenderBeatOverride[];
}

export interface LocalRenderPreflightAsset {
  assetId: string;
  state: "AVAILABLE" | "MISSING" | "CORRUPT";
  message: string | null;
}

export type LocalRenderPreflightBlockerCode =
  | "FFMPEG_UNAVAILABLE"
  | "EXECUTOR_OFFLINE"
  | "EXECUTOR_UNPAIRED"
  | "EXECUTOR_CONNECTING"
  | "DEVICE_MISMATCH"
  | "USER_MISMATCH"
  | "INSUFFICIENT_DISK"
  | "DISK_UNKNOWN"
  | "ASSET_MISSING"
  | "ASSET_CORRUPT";

export interface LocalRenderPreflight {
  ready: boolean;
  blockers: LocalRenderPreflightBlockerCode[];
  warnings: string[];
  assets: LocalRenderPreflightAsset[];
  diskFreeBytes: number | null;
  estimatedOutputBytes: number;
  requiredTemporaryBytes: number;
}
