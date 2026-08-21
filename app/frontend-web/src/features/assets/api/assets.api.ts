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
    (candidate.type === "AUDIO" || candidate.type === "IMAGE" || candidate.type === "VIDEO") &&
    typeof candidate.origin === "string" &&
    typeof candidate.storageKey === "string" &&
    typeof candidate.originalFilename === "string" &&
    typeof candidate.contentType === "string" &&
    typeof candidate.sizeBytes === "number" &&
    Number.isSafeInteger(candidate.sizeBytes) &&
    candidate.sizeBytes >= 0 &&
    typeof candidate.sha256 === "string" &&
    /^[0-9a-f]{64}$/i.test(candidate.sha256) &&
    (typeof candidate.durationMs === "number" || candidate.durationMs === null) &&
    typeof candidate.status === "string" &&
    typeof candidate.createdAt === "string"
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
    (candidate.type === "AUDIO" || candidate.type === "IMAGE" || candidate.type === "VIDEO") &&
    typeof candidate.originalFilename === "string" &&
    typeof candidate.contentType === "string" &&
    typeof candidate.expectedSizeBytes === "number" &&
    Number.isSafeInteger(candidate.expectedSizeBytes) &&
    candidate.expectedSizeBytes > 0 &&
    typeof candidate.expectedSha256 === "string" &&
    /^[0-9a-f]{64}$/i.test(candidate.expectedSha256) &&
    typeof candidate.storageKey === "string" &&
    isHttpUrl(candidate.uploadUrl) &&
    typeof candidate.uploadHeaders === "object" &&
    candidate.uploadHeaders !== null &&
    Object.values(candidate.uploadHeaders as Record<string, unknown>).every(
      (header) => typeof header === "string",
    ) &&
    typeof candidate.status === "string" &&
    typeof candidate.expiresAt === "string"
  );
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
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
