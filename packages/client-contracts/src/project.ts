export type ProjectAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";

export interface ProjectWorkflowSummary {
  hasChapter: boolean;
  analysisReady: boolean;
  canonReady: boolean;
  storyReady: boolean;
  productionStarted: boolean;
  productionReady: boolean;
  editorReady: boolean;
  renderInProgress: boolean;
  latestStage: "SOURCE" | "CANON" | "STORY" | "PRODUCTION" | "EDITOR" | "RENDER";
}

export interface DesktopProject {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  status: string;
  imageAspectRatio?: ProjectAspectRatio;
  createdAt?: string;
  updatedAt?: string;
  isStarred?: boolean;
  workflow?: ProjectWorkflowSummary | null;
  metrics?: {
    totalChapters: number;
    totalScenes: number;
    estimatedDurationSeconds: number;
  };
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  sourceLanguage?: string;
  narrationLanguage?: string;
  metadataLanguage?: string;
  imageAspectRatio?: ProjectAspectRatio;
}
