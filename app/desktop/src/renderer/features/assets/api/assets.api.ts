import type {
  DesktopAsset,
  LocalAssetRegistration,
  RegisterLocalAssetRequest,
} from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client.ts";
import { assertContract, isRecord, isString } from "../../../api/guards.ts";

const ASSET_PAGE_LIMIT = 100;

export type AssetLibraryScope = "all" | "audio" | "visual";

function isAsset(value: unknown): value is DesktopAsset {
  return (
    isRecord(value) &&
    isString(value.id) &&
    (value.type === "AUDIO" || value.type === "IMAGE" || value.type === "VIDEO") &&
    isString(value.origin) &&
    isString(value.originalFilename) &&
    isString(value.contentType) &&
    typeof value.sizeBytes === "number" &&
    Number.isFinite(value.sizeBytes) &&
    isString(value.status) &&
    isString(value.createdAt) &&
    (value.durationMs === null ||
      (typeof value.durationMs === "number" && Number.isFinite(value.durationMs)))
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

async function listAllByType(
  projectId: string,
  type?: DesktopAsset["type"],
): Promise<DesktopAsset[]> {
  const assets: DesktopAsset[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({
      projectId,
      limit: String(ASSET_PAGE_LIMIT),
    });
    if (type) params.set("type", type);
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

async function listAll(
  projectId: string,
  scope: AssetLibraryScope = "all",
): Promise<DesktopAsset[]> {
  if (scope === "audio") return listAllByType(projectId, "AUDIO");
  if (scope === "visual") {
    const groups = await Promise.all([
      listAllByType(projectId, "IMAGE"),
      listAllByType(projectId, "VIDEO"),
    ]);
    return groups.flat().sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
  return listAllByType(projectId);
}

export function toRegisterLocalAssetRequest(
  input: LocalAssetRegistration,
): RegisterLocalAssetRequest {
  return {
    projectId: input.projectId,
    type: input.type,
    originalFilename: input.originalFilename,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256,
    durationMs: input.durationMs,
  };
}

function projectAssetPath(projectId: string, assetId: string, suffix = "") {
  const params = new URLSearchParams({ projectId });
  return `/api/v1/assets/${encodeURIComponent(assetId)}${suffix}?${params.toString()}`;
}

export const assetsApi = {
  listAll,

  get: (projectId: string, assetId: string) =>
    apiRequest<DesktopAsset>(projectAssetPath(projectId, assetId)),

  downloadUrl: (projectId: string, assetId: string) =>
    apiRequest<{
      url: string;
      expiresAt: string;
      contentType: string;
      filename: string;
    }>(projectAssetPath(projectId, assetId, "/download-url")),

  registerLocal: (input: LocalAssetRegistration) =>
    apiRequest<DesktopAsset>("/api/v1/assets/local", {
      method: "POST",
      body: JSON.stringify(toRegisterLocalAssetRequest(input)),
    }),
};