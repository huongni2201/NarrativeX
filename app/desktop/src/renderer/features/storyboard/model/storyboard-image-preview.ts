import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url.ts";

export function resolveStoryboardImagePreview(input: {
  projectId: string;
  assetId: string;
  storageMode: string | null | undefined;
  remoteUrl: string | null | undefined;
}) {
  if (input.storageMode === "LOCAL_ONLY") {
    return {
      url: localAssetPreviewUrl(input.projectId, input.assetId),
      requiresRemoteUrl: false,
    };
  }

  return {
    url: input.remoteUrl ?? null,
    requiresRemoteUrl: true,
  };
}
