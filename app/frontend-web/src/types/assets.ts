export type AssetType =
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "REFERENCE"
  | "MOTION"
  | "FINAL_OUTPUT";

export type AssetStatus =
  | "PENDING_UPLOAD"
  | "UPLOADING"
  | "VALIDATING"
  | "PROCESSING"
  | "GENERATED"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "LOCKED"
  | "READY"
  | "FAILED"
  | "COMPLETED"
  | "DELETED";

export interface AssetUsedIn {
  type: "scene_beat" | "character" | "location" | "chapter" | "project";
  title: string;
  subtitle?: string;
  linkText?: string;
  targetView?: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  type: AssetType;
  status: AssetStatus;
  thumbnailUrl: string;
  fileSize: string;
  dimensions?: string;
  duration?: string;
  aspectRatio?: string;
  quality?: string;
  createdAt: string;
  provider?: string;
  projectTitle: string;
  chapterTitle?: string;
  sceneTitle?: string;
  beatTitle?: string;
  characterName?: string;
  locationName?: string;
  attempt?: string;
  progressPercent?: number;
  audioWaveform?: number[];
  audioSampleRate?: string;
  usedIn?: AssetUsedIn[];
  prompt?: string;
}

export type AssetFilterType =
  | "all"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "REFERENCE"
  | "MOTION"
  | "FINAL_OUTPUT";

export type AssetSortOption = "newest" | "oldest" | "name" | "size";
