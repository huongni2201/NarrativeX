export type DesktopRenderJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED"
  | "UNKNOWN"
  | "STALLED"
  | "PAUSED_COST_LIMIT";

export interface DesktopRenderJob {
  jobId: string;
  type: string;
  status: DesktopRenderJobStatus;
  progress: number;
  currentStep: string | null;
  errorCode: string | null;
}

export type GenerationJobStatus = DesktopRenderJobStatus;

export interface GenerationJob {
  jobId: string;
  type: string;
  status: GenerationJobStatus;
  progress: number;
  currentStep: string | null;
  errorCode: string | null;
}

export type VisualGenerationMode = "IMAGE" | "VIDEO";
export type ImageGenerationProvider = "GEMINI_WEB" | "API";
export type ImageGenerationStrategy =
  | "GENERATE_NEW"
  | "REUSE_APPROVED"
  | "REFRAME_DERIVED";

export interface AnalyzeChapterInput {
  visualGenerationMode: VisualGenerationMode;
  imageProvider?: ImageGenerationProvider | null;
}

export type MediaAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
export type MediaQualityTier = "DRAFT" | "STANDARD" | "HIGH";
export type MediaImageStyle = "CINEMATIC" | "STORYBOOK_WATERCOLOR";

export interface CreateMediaJobInput {
  productionMode: "IMAGE_MOTION";
  aspectRatio: MediaAspectRatio;
  qualityTier: MediaQualityTier;
  maxAuthorizedCost: number;
  imageStyle?: MediaImageStyle;
  visualGenerationMode: VisualGenerationMode;
  imageProvider?: ImageGenerationProvider | null;
  imageGenerationStrategy?: ImageGenerationStrategy | null;
}

export interface MediaJobCostEstimate {
  visualBeatCount: number;
  unitEstimatedCost: string;
  estimatedCost: string;
  currency: string;
}

export interface MediaGenerationItem {
  id: string;
  visualBeatId: string;
  itemKey?: string;
  mediaAssetId: string | null;
  executionStatus: string;
  reviewStatus: "NOT_READY" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  attemptNumber?: number;
  errorCode?: string | null;
  rowVersion: number;
}

export interface MediaJobDetails {
  jobId: string;
  mediaPlanId: string;
  mediaPlanRevision: number;
  totalItems: number;
  readyItems: number;
  reviewItems: number;
  items: MediaGenerationItem[];
}

export interface MediaReviewInput {
  decision: "APPROVED" | "REJECTED";
  rowVersion: number;
}
