import { useQuery } from "@tanstack/react-query";
import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url";
import { assetsApi } from "../../assets/api/assets.api";

export interface EditorPreviewSources {
  mediaUrl: string | null;
  narrationUrl: string | null;
  loading: boolean;
  message: string | null;
}

export function useEditorPreviewSources({
  projectId,
  mediaAssetId,
  mediaStorageMode,
  narrationAssetId,
  narrationStorageMode,
}: Readonly<{
  projectId: string | null;
  mediaAssetId: string | null;
  mediaStorageMode?: string | null;
  narrationAssetId: string | null;
  narrationStorageMode?: string | null;
}>): EditorPreviewSources {
  const mediaIsLocalOnly = mediaStorageMode === "LOCAL_ONLY";
  const narrationIsLocalOnly = narrationStorageMode === "LOCAL_ONLY";
  const localMediaUrl =
    projectId && mediaAssetId
      ? localAssetPreviewUrl(projectId, mediaAssetId)
      : null;
  const localNarrationUrl =
    projectId && narrationAssetId
      ? localAssetPreviewUrl(projectId, narrationAssetId)
      : null;

  const remoteMedia = useQuery({
    queryKey: ["assets", mediaAssetId ?? "none", "download-url"],
    queryFn: () => assetsApi.downloadUrl(mediaAssetId as string),
    enabled: Boolean(projectId && mediaAssetId && !mediaIsLocalOnly),
    staleTime: 30_000,
  });

  const remoteNarration = useQuery({
    queryKey: ["assets", narrationAssetId ?? "none", "download-url"],
    queryFn: () => assetsApi.downloadUrl(narrationAssetId as string),
    enabled: Boolean(projectId && narrationAssetId && !narrationIsLocalOnly),
    staleTime: 30_000,
  });

  const mediaUrl =
    (mediaIsLocalOnly ? localMediaUrl : remoteMedia.data?.url ?? localMediaUrl) ?? null;
  const narrationUrl =
    (narrationIsLocalOnly
      ? localNarrationUrl
      : remoteNarration.data?.url ?? localNarrationUrl) ?? null;
  const loading =
    (Boolean(mediaAssetId && !mediaIsLocalOnly) && remoteMedia.isLoading) ||
    (Boolean(narrationAssetId && !narrationIsLocalOnly) && remoteNarration.isLoading);
  const messages: string[] = [];
  if (!loading && mediaAssetId && !mediaUrl) {
    messages.push("Không lấy được media preview URL.");
  }

  return {
    mediaUrl,
    narrationUrl,
    loading,
    message: messages.length ? messages.join(" ") : null,
  };
}
