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
  phase?: "STRUCTURE" | "BOUNDARIES" | "SHARDS" | "VALIDATION" | "MATERIALIZATION" | null;
  completedShards?: number | null;
  totalShards?: number | null;
  reusedShards?: number | null;
  repairCount?: number | null;
  continuityReportId?: string | null;
  pipelineVersion?: string | null;
}

export type VisualGenerationMode = "IMAGE" | "VIDEO";
export type ImageGenerationProvider = "GEMINI_WEB" | "API";

export interface AnalyzeChapterInput {
  visualGenerationMode: VisualGenerationMode;
  imageProvider?: ImageGenerationProvider | null;
}

export type ContinuityIssueSeverity = "BLOCKING" | "WARNING";
export type ContinuityIssueOrigin = "DETERMINISTIC" | "SEMANTIC" | "HUMAN";
export type ContinuityReportStatus = "PASS" | "NEEDS_REVIEW";

export interface ChapterContinuityIssue {
  code: string;
  severity: ContinuityIssueSeverity;
  scopeKeys: string[];
  evidenceAnchors: string[];
  message: string;
  origin: ContinuityIssueOrigin;
}

export interface ChapterContinuityReport {
  planId: string;
  revision: number;
  sourceHash: string;
  status: ContinuityReportStatus;
  issues: ChapterContinuityIssue[];
}

export interface CreateRegenerationPlanInput {
  expectedPlanId: string;
  beatIds: string[];
  reason: string;
}

export interface RegenerationPlan {
  regenerationPlanId: string;
  continuityPlanId: string;
  affectedBeatIds: string[];
  reusableBeatIds: string[];
  estimatedCost: string;
  currency: string;
  expiresAt: string;
  inputFingerprint: string;
}

export interface CreateRegenerationJobInput {
  regenerationPlanId: string;
  maxAuthorizedCost: number;
}

export interface ContinuityReviewInput {
  planId: string;
  reportRevision: number;
  issueIds: string[];
  decision: "ACKNOWLEDGE_WARNING";
}

export type MediaAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
export type MediaImageStyle = "CINEMATIC" | "STORYBOOK_WATERCOLOR";

export interface CreateMediaJobInput {
  productionMode: "IMAGE_MOTION";
  aspectRatio: MediaAspectRatio;
  maxAuthorizedCost: number;
  imageStyle?: MediaImageStyle;
  visualGenerationMode: VisualGenerationMode;
  imageProvider?: ImageGenerationProvider | null;
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
