import type { DesktopAsset, LocalAssetRegistration } from "@narrativex/client-contracts";
import { apiRequest } from "./client";
import { assertContract, isRecord, isString } from "./guards";

function isAsset(value: unknown): value is DesktopAsset {
  return isRecord(value) && isString(value.id) && (value.type === "AUDIO" || value.type === "IMAGE" || value.type === "VIDEO") && isString(value.originalFilename) && isString(value.status);
}

export const assetsApi = {
  list: (params = "limit=100") => apiRequest<unknown>(`/api/v1/assets?${params}`).then((value) => { assertContract(isRecord(value) && Array.isArray(value.items) && value.items.every(isAsset), "Assets response không đúng contract."); return { items: value.items, nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null }; }),
  get: (assetId: string) => apiRequest<DesktopAsset>(`/api/v1/assets/${encodeURIComponent(assetId)}`),
  downloadUrl: (assetId: string) => apiRequest<{ url: string; expiresAt: string; contentType: string; filename: string }>(`/api/v1/assets/${encodeURIComponent(assetId)}/download-url`),
  registerLocal: (input: LocalAssetRegistration) => apiRequest<DesktopAsset>("/api/v1/assets/local", { method: "POST", body: JSON.stringify(input) }),
};
