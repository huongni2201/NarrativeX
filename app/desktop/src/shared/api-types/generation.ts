import type { GenerationStrategy } from "./story";

type VideoAudioMode = "LTX_NATIVE_AV";

export interface GenerateShotTakeInput {
  strategy?: GenerationStrategy;
  seed?: number;
  retryFromTakeId?: string;
  retryReason?: string;
  audioMode?: VideoAudioMode;
  /** Keep this key for transport replay; use a new input/key for regeneration. */
  idempotencyKey?: string;
}

export type DesktopRenderJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED"
  | "UNKNOWN"
  | "STALLED";

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

type VisualGenerationMode = "IMAGE" | "VIDEO";
type ImageGenerationProvider = "API";

export interface AnalyzeChapterInput {
  visualGenerationMode: VisualGenerationMode;
  imageProvider?: ImageGenerationProvider | null;
  /** Decimal revision the user previewed; a different current revision fails with PROMPT_SETTINGS_CHANGED. */
  expectedPromptRevision?: string;
}

type MediaAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
type MediaImageStyle = "CINEMATIC" | "STORYBOOK_WATERCOLOR" | "CINEMATIC_ANIME";

export interface CreateMediaJobInput {
  productionMode: "VIDEO_FIRST" | "IMAGE_MOTION" | "LEGACY_IMAGE";
  aspectRatio?: MediaAspectRatio;
  /** @deprecated Ignored by the backend; the style comes from Settings → Prompt. */
  imageStyle?: MediaImageStyle;
  visualGenerationMode: VisualGenerationMode;
  imageProvider?: ImageGenerationProvider | null;
}

export interface CreateVisualBeatImageAttemptInput {
  aspectRatio?: MediaAspectRatio;
  expectedPromptRevision?: number | null;
}

export interface VisualBeatImageAttempt {
  itemId: string;
  jobId: string;
  mediaPlanId: string;
  storyboardRevisionId?: string | null;
  currentStoryboardRevision: boolean;
  attemptNumber: number;
  executionStatus: string;
  mediaAssetId: string | null;
  reviewStatus: "NOT_READY" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  reviewedAt?: string | null;
  errorCode?: string | null;
  rowVersion: number;
}

interface MediaGenerationItem {
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

interface ResolutionProfile {
  width: number;
  height: number;
  fps: number;
}

export type RuntimeCapabilityStatus =
  | "READY"
  | "BUSY"
  | "DEGRADED"
  | "OFFLINE"
  | "UNAVAILABLE";

export interface VideoRuntimeCapability {
  available: boolean;
  status?: RuntimeCapabilityStatus;
  provider: string;
  model: string;
  profile: string;
  strategies: GenerationStrategy[];
  supportedAspectRatios: string[];
  resolutionProfiles: ResolutionProfile[];
  audioModes: string[];
  reason?: string | null;
}

export interface RuntimeCapabilityView {
  videoGeneration: VideoRuntimeCapability;
}

