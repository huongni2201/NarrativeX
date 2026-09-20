export type BeatMediaFitMode = "TRIM" | "LOOP" | "FREEZE_END" | "SPEED_ADJUST";
export type BeatMediaType = "IMAGE" | "VIDEO";
export type AutoEditStyle = "AUTO" | "CINEMATIC" | "BALANCED" | "DYNAMIC";
export type RenderResolution = "720p" | "1080p" | "1440p";
export type RenderFrameRate = 24 | 30 | 60;

export interface EditDecisionTransition {
  type: "CUT" | "DISSOLVE" | "FADE_BLACK";
  durationMs: number;
}

export interface EditDecision {
  decisionId: string;
  orderIndex: number;
  shotId: string;
  takeId: string;
  mediaAssetId: string;
  sourceInMs: number;
  sourceOutMs: number;
  timelineInMs: number;
  timelineOutMs: number;
  transition?: EditDecisionTransition;
}

export interface EditDecisionList {
  schemaVersion: "1.0";
  projectId: string;
  storyVersionId?: string | null;
  chapterId: string;
  totalDurationMs: number;
  fps: RenderFrameRate;
  resolution: { width: number; height: number };
  audioClockSource: "VIENEU_MASTER" | "SCRIPTLOCK";
  audioAssetId: string;
  decisions: EditDecision[];
}

export interface DesktopTimelineBeat {
  chapterId: string;
  sceneIndex: number;
  storyBeatId?: string | null;
  beatIndex: number;
  visualBeatId: string;
  shotId?: string | null;
  takeId?: string | null;
  title: string;
  visualIntent: string;
  cameraMovement: string;
  assetStrategy: string;
  mediaAssetId: string | null;
  mediaType: BeatMediaType | null;
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
  storyVersionId: string | null;
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

/** Render-only visual treatment. Beat timing is derived from narration alignment and is not editable. */
export interface ProjectRenderBeatOverride {
  visualBeatId: string;
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

export interface LocalRenderPreflightAssetInput {
  assetId: string;
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
