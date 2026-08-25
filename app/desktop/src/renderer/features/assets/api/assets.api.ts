import type { DesktopAsset, LocalAssetRegistration } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { assertContract, isRecord, isString } from "../../../api/guards";

function isAsset(value: unknown): value is DesktopAsset {
  return (
    isRecord(value) &&
    isString(value.id) &&
    (value.type === "AUDIO" || value.type === "IMAGE" || value.type === "VIDEO") &&
    isString(value.originalFilename) &&
    isString(value.status)
  );
}

function parseAssets(value: unknown) {
  assertContract(
    isRecord(value) && Array.isArray(value.items) && value.items.every(isAsset),
    "Assets response không đúng contract.",
  );

  return {
    items: value.items,
    nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null,
  };
}

export const assetsApi = {
  list: (params = "limit=100") =>
    apiRequest<unknown>(`/api/v1/assets?${params}`).then(parseAssets),

  get: (assetId: string) =>
    apiRequest<DesktopAsset>(`/api/v1/assets/${encodeURIComponent(assetId)}`),

  downloadUrl: (assetId: string) =>
    apiRequest<{
      url: string;
      expiresAt: string;
      contentType: string;
      filename: string;
    }>(`/api/v1/assets/${encodeURIComponent(assetId)}/download-url`),

  registerLocal: (input: LocalAssetRegistration) =>
    apiRequest<DesktopAsset>("/api/v1/assets/local", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
