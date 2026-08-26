import type {
  DesktopAsset,
  LocalAssetRegistration,
  RegisterLocalAssetRequest,
} from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client.ts";
import { assertContract, isRecord, isString } from "../../../api/guards.ts";

const ASSET_PAGE_LIMIT = 100;

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

async function listAll(): Promise<DesktopAsset[]> {
  const assets: DesktopAsset[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({ limit: String(ASSET_PAGE_LIMIT) });
    if (cursor) params.set("cursor", cursor);
    const page = await apiRequest<unknown>(`/api/v1/assets?${params.toString()}`).then(parseAssets);
    assets.push(...page.items);
    if (!page.nextCursor) break;
    if (seenCursors.has(page.nextCursor)) {
      throw new Error("Assets pagination returned a repeated cursor.");
    }
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (true);

  return assets;
}

export function toRegisterLocalAssetRequest(
  input: LocalAssetRegistration,
): RegisterLocalAssetRequest {
  return {
    type: input.type,
    originalFilename: input.originalFilename,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256,
    durationMs: input.durationMs,
  };
}

export const assetsApi = {
  list: (params = "limit=100") =>
    apiRequest<unknown>(`/api/v1/assets?${params}`).then(parseAssets),
  listAll,

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
      body: JSON.stringify(toRegisterLocalAssetRequest(input)),
    }),
};