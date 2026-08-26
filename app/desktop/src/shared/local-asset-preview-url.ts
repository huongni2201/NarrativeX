export const LOCAL_ASSET_PREVIEW_SCHEME = "narrativex-media";

export function localAssetPreviewUrl(projectId: string, assetId: string): string {
  return `${LOCAL_ASSET_PREVIEW_SCHEME}://asset/${encodeURIComponent(projectId)}/${encodeURIComponent(assetId)}`;
}

export function parseLocalAssetPreviewUrl(value: string): {
  projectId: string;
  assetId: string;
} | null {
  try {
    const url = new URL(value);
    if (url.protocol !== `${LOCAL_ASSET_PREVIEW_SCHEME}:` || url.hostname !== "asset") {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    return { projectId: parts[0], assetId: parts[1] };
  } catch {
    return null;
  }
}
