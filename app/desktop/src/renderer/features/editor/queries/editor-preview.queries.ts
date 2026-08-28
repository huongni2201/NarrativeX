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
  mediaStorageMode: string | null | undefined;
  narrationAssetId: string | null;
  narrationStorageMode: string | null | undefined;
}>): EditorPreviewSources {
  const mediaIsLocalOnly = mediaStorageMode === "LOCAL_ONLY";
  const narrationIsLocalOnly = narrationStorageMode === "LOCAL_ONLY";
  const localMediaUrl =
    projectId && mediaIsLocalOnly && mediaAssetId
      ? localAssetPreviewUrl(projectId, mediaAssetId)
      : null;
  const localNarrationUrl =
    projectId && narrationIsLocalOnly && narrationAssetId
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

  const mediaUrl = localMediaUrl ?? remoteMedia.data?.url ?? null;
  const narrationUrl = localNarrationUrl ?? remoteNarration.data?.url ?? null;
  const loading = remoteMedia.isLoading || remoteNarration.isLoading;
  const messages: string[] = [];
  if (!loading && mediaAssetId && !mediaUrl) {
    messages.push("Không lấy được media preview URL.");
  }
  if (!loading && narrationAssetId && !narrationUrl) {
    messages.push("Không lấy được narration preview URL.");
  }

  return {
    mediaUrl,
    narrationUrl,
    loading,
    message: messages.length ? messages.join(" ") : null,
  };
}
