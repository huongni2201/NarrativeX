export type ChapterStatus =
  | "DRAFT"
  | "ANALYZING"
  | "ANALYZED"
  | "PLANNING"
  | "GENERATING_VISUALS"
  | "VISUAL_REVIEW"
  | "VISUAL_READY"
  | "GENERATING_AUDIO"
  | "AUDIO_READY"
  | "RENDERING"
  | "RENDERED"
  | "FAILED"
  | "EMPTY";

export type VisualBeatStatus =
  | "APPROVED"
  | "NEEDS_REVIEW"
  | "PENDING"
  | "PROCESSING"
  | "REJECTED"
  | "FAILED";

export type ProductionViewMode =
  | "overview"
  | "workspace"
  | "storyboard"
  | "visual-review"
  | "render"
  | "preview";

export interface VisualBeat {
  id: string;
  number: number;
  sceneId: string;
  chapterId: string;
  prompt: string;
  description: string;
  status: VisualBeatStatus;
  imageUrl: string;
  durationSeconds: number;
  cameraMovement?: string;
  lighting?: string;
}

export interface Scene {
  id: string;
  number: string; // e.g. "01"
  title: string;
  chapterId: string;
  beatsCount: number;
  approvedBeatsCount: number;
  thumbnail: string;
  status: "DRAFT" | "READY" | "IN_PROGRESS";
  visualBeats?: VisualBeat[];
}

export interface Chapter {
  id: string;
  number: string; // e.g. "01", "02", "06"
  title: string;
  status: ChapterStatus;
  scenesCount: number;
  duration: string; // e.g. "06:12"
  lastUpdated: string;
  scenes: Scene[];
  storyExcerpt?: string;
  progressPercent: number;
  generatedVisualsCount: number;
  totalVisualsCount: number;
}

export interface ProjectProductionDetail {
  id: string;
  title: string;
  planBadge: string; // "PRO" | "CREATOR"
  description: string;
  createdAt: string;
  updatedAt: string;
  coverImage: string;
  totalChapters: number;
  readyChapters: number;
  renderedChapters: number;
  processingJobs: number;
  estimatedDuration: string; // e.g. "58:42"
  totalScenes: number;
  approvedVisuals: number;
  overallProgress: number; // e.g. 60%
  chapters: Chapter[];
}
