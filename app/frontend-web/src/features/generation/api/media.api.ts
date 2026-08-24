import type {
  ApiGenerationJob,
  ApiMediaCostEstimate,
  ChapterId,
  MediaPlanId,
  ProjectId,
  ResourceId,
  VisualBeatId,
} from "@/types/api";
import { isApiGenerationJob } from "@/types/api";
import { apiRequest } from "@/shared/api/client";

export interface CreateMediaJobInput {
  productionMode: "IMAGE_MOTION";
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  qualityTier: "DRAFT" | "STANDARD" | "HIGH";
  maxAuthorizedCost: string;
  imageStyle: "CINEMATIC" | "STORYBOOK_WATERCOLOR";
}

export interface EstimateMediaJobInput {
  productionMode: "IMAGE_MOTION";
  aspectRatio: CreateMediaJobInput["aspectRatio"];
  qualityTier: CreateMediaJobInput["qualityTier"];
  imageStyle: CreateMediaJobInput["imageStyle"];
}

export interface RenderChapterInput {
  mediaPlanId: MediaPlanId;
  mediaPlanRevision: number;
  resolution: "720p" | "1080p";
  format: "mp4";
  maxAuthorizedCost: string;
}

function isApiMediaCostEstimate(value: unknown): value is ApiMediaCostEstimate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApiMediaCostEstimate>;
  return (
    typeof candidate.visualBeatCount === "number" &&
    typeof candidate.unitEstimatedCost === "string" &&
    typeof candidate.estimatedCost === "string" &&
    typeof candidate.currency === "string"
  );
}

export interface MediaGenerationItem {
  id: ResourceId;
  visualBeatId: VisualBeatId;
  itemKey: string;
  executionStatus: string;
  reviewStatus: "NOT_READY" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  attemptNumber: number;
  mediaAssetId: ResourceId | null;
  errorCode: string | null;
  rowVersion: number;
}

export interface MediaJobDetails {
  jobId: ResourceId;
  mediaPlanId: MediaPlanId | null;
  mediaPlanRevision: number | null;
  totalItems: number;
  readyItems: number;
  reviewItems: number;
  items: MediaGenerationItem[];
}

function isMediaJobDetails(value: unknown): value is MediaJobDetails {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MediaJobDetails>;
  return (
    typeof candidate.jobId === "string" &&
    (candidate.mediaPlanId === null || typeof candidate.mediaPlanId === "string") &&
    (candidate.mediaPlanRevision === null || typeof candidate.mediaPlanRevision === "number") &&
    typeof candidate.totalItems === "number" &&
    typeof candidate.readyItems === "number" &&
    typeof candidate.reviewItems === "number" &&
    Array.isArray(candidate.items) &&
    candidate.items.every((item) => {
      if (!item || typeof item !== "object") return false;
      const itemValue = item as Partial<MediaGenerationItem>;
      return typeof itemValue.id === "string" &&
        typeof itemValue.visualBeatId === "string" &&
        typeof itemValue.itemKey === "string" &&
        typeof itemValue.executionStatus === "string" &&
        typeof itemValue.reviewStatus === "string" &&
        typeof itemValue.attemptNumber === "number" &&
        (itemValue.mediaAssetId === null || typeof itemValue.mediaAssetId === "string") &&
        (itemValue.errorCode === null || typeof itemValue.errorCode === "string") &&
        typeof itemValue.rowVersion === "number";
    })
  );
}

export const mediaApi = {
  estimate: (projectId: ProjectId, chapterId: ChapterId, input: EstimateMediaJobInput) =>
    apiRequest<ApiMediaCostEstimate>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/media-jobs/estimate`,
      { method: "POST", json: input },
      isApiMediaCostEstimate,
    ),
  createJob: (projectId: ProjectId, chapterId: ChapterId, input: CreateMediaJobInput, idempotencyKey: string) =>
    apiRequest<ApiGenerationJob>(`/api/v1/projects/${projectId}/chapters/${chapterId}/media-jobs`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, json: input }, isApiGenerationJob),
  getJob: (jobId: ResourceId) => apiRequest<ApiGenerationJob>(`/api/v1/generation-jobs/${encodeURIComponent(jobId)}`, {}, isApiGenerationJob),
  getDetails: (jobId: ResourceId) => apiRequest<MediaJobDetails>(`/api/v1/media-jobs/${encodeURIComponent(jobId)}`, {}, isMediaJobDetails),
  review: (itemId: ResourceId, decision: "APPROVED" | "REJECTED", rowVersion: number) =>
    apiRequest<void>(`/api/v1/media-generation-items/${encodeURIComponent(itemId)}/review`, { method: "POST", json: { decision, rowVersion } }),
  render: (projectId: ProjectId, chapterId: ChapterId, input: RenderChapterInput, idempotencyKey: string) =>
    apiRequest<ApiGenerationJob>(`/api/v1/projects/${projectId}/chapters/${chapterId}/render`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, json: input }, isApiGenerationJob),
};
