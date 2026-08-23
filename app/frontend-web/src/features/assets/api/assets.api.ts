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
  uploadUrl: string | null;
  uploadHeaders: Record<string, string>;
  status: string;
  expiresAt: string;
}

export interface ApiUploadFinalizeResult {
  uploadSessionId: string;
  status: "VALIDATING" | "READY" | "REJECTED";
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
    (candidate.uploadUrl === null
      ? candidate.status === "READY"
      : isHttpUrl(candidate.uploadUrl)) &&
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
    (candidate.status === "VALIDATING" || candidate.status === "READY" || candidate.status === "REJECTED") &&
    (typeof candidate.mediaAssetId === "string" || candidate.mediaAssetId === null)
  );
}

export const assetsApi = {
  waitForAsset: (id: string, timeoutMs = 30_000) => pollAsset(id, timeoutMs),
  get: (id: string) =>
    apiRequest<ApiMediaAsset>(`/api/v1/assets/${encodeURIComponent(id)}`, {}, isApiMediaAsset),
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
  uploadVoiceReference: async (file: File, idempotencyKey = crypto.randomUUID()) => {
    const contentType = file.type.trim().toLowerCase();
    if (!VOICE_REFERENCE_CONTENT_TYPES.has(contentType)) {
      throw new Error("Mẫu giọng phải là MP3, WAV, OGG, M4A hoặc WEBM hợp lệ.");
    }
    const expectedSha256 = await sha256(file);
    const intent = await assetsApi.createUploadIntent(
      {
        type: "AUDIO",
        originalFilename: file.name,
        contentType,
        expectedSizeBytes: file.size,
        expectedSha256,
      },
      idempotencyKey,
    );
    if (!intent.uploadUrl) {
      const settled = await assetsApi.finalizeUpload(intent.id);
      if (settled.status === "READY" && settled.mediaAssetId) return settled.mediaAssetId;
      throw new Error("Upload intent này không còn mở để upload.");
    }
    const uploadResponse = await fetch(intent.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        ...intent.uploadHeaders,
      },
      body: file,
      credentials: "omit",
    });
    if (!uploadResponse.ok) throw new Error(`Upload mẫu giọng thất bại (${uploadResponse.status}).`);
    const finalized = await assetsApi.finalizeUpload(intent.id);
    if (finalized.status === "REJECTED" || !finalized.mediaAssetId) {
      throw new Error("Backend từ chối mẫu giọng sau khi verify.");
    }
    if (finalized.status === "READY") return finalized.mediaAssetId;
    const validated = await pollAsset(finalized.mediaAssetId);
    if (validated.status !== "READY") {
      throw new Error("Mẫu giọng đang được kiểm tra. Vui lòng thử lại sau.");
    }
    return validated.id;
  },
};

const VOICE_REFERENCE_CONTENT_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/webm",
]);

async function pollAsset(id: string, timeoutMs = 30_000): Promise<ApiMediaAsset> {
  const deadline = Date.now() + timeoutMs;
  let asset = await assetsApi.get(id);
  while (asset.status === "VALIDATING" && Date.now() < deadline) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
    asset = await assetsApi.get(id);
  }
  return asset;
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
