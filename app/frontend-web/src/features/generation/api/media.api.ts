import type { ApiGenerationJob, ApiMediaCostEstimate } from "@/types/api";
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
  id: string;
  visualBeatId: number;
  itemKey: string;
  executionStatus: string;
  reviewStatus: "NOT_READY" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  attemptNumber: number;
  mediaAssetId: string | null;
  errorCode: string | null;
  rowVersion: number;
}

export interface MediaJobDetails {
  jobId: string;
  mediaPlanId: string | null;
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
      const value = item as Partial<MediaGenerationItem>;
      return typeof value.id === "string" && typeof value.visualBeatId === "number" && typeof value.itemKey === "string" && typeof value.executionStatus === "string" && typeof value.reviewStatus === "string" && typeof value.attemptNumber === "number" && (value.mediaAssetId === null || typeof value.mediaAssetId === "string") && (value.errorCode === null || typeof value.errorCode === "string") && typeof value.rowVersion === "number";
    })
  );
}

export const mediaApi = {
  estimate: (projectId: number, chapterId: number, input: EstimateMediaJobInput) =>
    apiRequest<ApiMediaCostEstimate>(
      `/api/v1/projects/${projectId}/chapters/${chapterId}/media-jobs/estimate`,
      { method: "POST", json: input },
      isApiMediaCostEstimate,
    ),
  createJob: (projectId: number, chapterId: number, input: CreateMediaJobInput, idempotencyKey: string) =>
    apiRequest<ApiGenerationJob>(`/api/v1/projects/${projectId}/chapters/${chapterId}/media-jobs`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, json: input }, isApiGenerationJob),
  getJob: (jobId: string) => apiRequest<ApiGenerationJob>(`/api/v1/generation-jobs/${encodeURIComponent(jobId)}`, {}, isApiGenerationJob),
  getDetails: (jobId: string) => apiRequest<MediaJobDetails>(`/api/v1/media-jobs/${encodeURIComponent(jobId)}`, {}, isMediaJobDetails),
  review: (itemId: string, decision: "APPROVED" | "REJECTED", rowVersion: number) =>
    apiRequest<void>(`/api/v1/media-generation-items/${encodeURIComponent(itemId)}/review`, { method: "POST", json: { decision, rowVersion } }),
  render: (projectId: number, chapterId: number, input: { mediaPlanId: string; mediaPlanRevision: number; resolution: "720p" | "1080p"; format: "mp4"; maxAuthorizedCost: string }, idempotencyKey: string) =>
    apiRequest<ApiGenerationJob>(`/api/v1/projects/${projectId}/chapters/${chapterId}/render`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, json: input }, isApiGenerationJob),
};
