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

export interface ProjectRenderBeatOverride {
  visualBeatId: string;
  durationMs?: number;
  cameraMovement?: string;
  mediaAssetId?: string;
}

export interface LocalRenderPreflightAsset {
  assetId: string;
  state: "AVAILABLE" | "MISSING" | "CORRUPT";
  message: string | null;
}

export interface LocalRenderPreflight {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  assets: LocalRenderPreflightAsset[];
  diskFreeBytes: number | null;
  estimatedOutputBytes: number;
  requiredTemporaryBytes: number;
}
