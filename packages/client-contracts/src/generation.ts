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

export interface CreateMediaJobInput {
  productionMode: "IMAGE_MOTION";
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  qualityTier: "DRAFT" | "STANDARD" | "HIGH";
  maxAuthorizedCost: number;
  imageStyle?: "CINEMATIC" | "STORYBOOK_WATERCOLOR";
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
