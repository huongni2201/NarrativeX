import { apiRequest } from "@/shared/api/client";
import type { AssetType } from "@/types/assets";

export interface ApiMediaAsset {
  id: string;
  type: "AUDIO" | "IMAGE" | "VIDEO";
  origin: string;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  durationMs: number | null;
  status: string;
  createdAt: string;
}

export interface ApiMediaAssetPage {
  items: ApiMediaAsset[];
  nextCursor: string | null;
}

export interface ApiUploadIntent {
  id: string;
  type: "AUDIO" | "IMAGE" | "VIDEO";
  originalFilename: string;
  contentType: string;
  expectedSizeBytes: number;
  expectedSha256: string;
  storageKey: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  status: string;
  expiresAt: string;
}

export interface ApiUploadFinalizeResult {
  uploadSessionId: string;
  status: "READY" | "REJECTED";
  mediaAssetId: string | null;
}

function isApiMediaAsset(value: unknown): value is ApiMediaAsset {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiMediaAsset>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.originalFilename === "string" &&
    typeof candidate.status === "string"
  );
}

function isApiMediaAssetPage(value: unknown): value is ApiMediaAssetPage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiMediaAssetPage>;
  return (
    Array.isArray(candidate.items) &&
    candidate.items.every(isApiMediaAsset) &&
    (typeof candidate.nextCursor === "string" || candidate.nextCursor === null)
  );
}

function isApiUploadIntent(value: unknown): value is ApiUploadIntent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiUploadIntent>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.originalFilename === "string" &&
    typeof candidate.contentType === "string" &&
    typeof candidate.expectedSizeBytes === "number" &&
    typeof candidate.expectedSha256 === "string" &&
    typeof candidate.uploadUrl === "string" &&
    typeof candidate.uploadHeaders === "object" &&
    candidate.uploadHeaders !== null &&
    Object.values(candidate.uploadHeaders as Record<string, unknown>).every(
      (header) => typeof header === "string",
    ) &&
    typeof candidate.status === "string" &&
    typeof candidate.expiresAt === "string"
  );
}

function isApiUploadFinalizeResult(value: unknown): value is ApiUploadFinalizeResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiUploadFinalizeResult>;
  return (
    typeof candidate.uploadSessionId === "string" &&
    (candidate.status === "READY" || candidate.status === "REJECTED") &&
    (typeof candidate.mediaAssetId === "string" || candidate.mediaAssetId === null)
  );
}

export const assetsApi = {
  list: (params: { type?: string; status?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    return apiRequest<ApiMediaAssetPage>(
      `/api/v1/assets${query.size ? `?${query.toString()}` : ""}`,
      {},
      isApiMediaAssetPage,
    );
  },
  approve: (id: string) =>
    apiRequest<ApiMediaAsset>(`/api/v1/assets/${encodeURIComponent(id)}/approve`, { method: "POST" }, isApiMediaAsset),
  delete: (id: string) =>
    apiRequest<void>(`/api/v1/assets/${encodeURIComponent(id)}`, { method: "DELETE" }),
  createUploadIntent: (request: {
    type: Extract<AssetType, "AUDIO" | "IMAGE" | "VIDEO">;
    originalFilename: string;
    contentType: string;
    expectedSizeBytes: number;
    expectedSha256: string;
  }, idempotencyKey = crypto.randomUUID()) =>
    apiRequest<ApiUploadIntent>(
      "/api/v1/assets/upload-intents",
      {
        method: "POST",
        json: request,
        headers: { "Idempotency-Key": idempotencyKey },
      },
      isApiUploadIntent,
    ),
  finalizeUpload: (uploadSessionId: string) =>
    apiRequest<ApiUploadFinalizeResult>(
      `/api/v1/assets/upload-intents/${encodeURIComponent(uploadSessionId)}/finalize`,
      { method: "POST" },
      isApiUploadFinalizeResult,
    ),
};
