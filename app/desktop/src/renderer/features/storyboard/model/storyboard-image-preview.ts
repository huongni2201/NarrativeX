import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url.ts";

export function resolveStoryboardImagePreview(input: {
  projectId: string;
  assetId: string;
}) {
  return { url: localAssetPreviewUrl(input.projectId, input.assetId) };
}
