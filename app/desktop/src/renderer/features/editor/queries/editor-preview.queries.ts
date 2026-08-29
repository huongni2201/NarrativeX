import { useQuery } from "@tanstack/react-query";
import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url";
import { assetsApi } from "../../assets/api/assets.api";
import { materializeChapterNarrationPreview } from "../model/chapter-narration-preview";

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
  narrationChapterId,
  narrationAssetId,
  narrationSizeBytes,
  narrationChecksum,
}: Readonly<{
  projectId: string | null;
  mediaAssetId: string | null;
  mediaStorageMode?: string | null;
  narrationChapterId: string | null;
  narrationAssetId: string | null;
  narrationSizeBytes: number | null;
  narrationChecksum: string | null;
}>): EditorPreviewSources {
  const mediaIsLocalOnly = mediaStorageMode === "LOCAL_ONLY";
  const localMediaUrl =
    projectId && mediaAssetId
      ? localAssetPreviewUrl(projectId, mediaAssetId)
      : null;

  const remoteMedia = useQuery({
    queryKey: ["assets", mediaAssetId ?? "none", "download-url"],
    queryFn: () => assetsApi.downloadUrl(mediaAssetId as string),
    enabled: Boolean(projectId && mediaAssetId && !mediaIsLocalOnly),
    staleTime: 30_000,
  });

  const localNarration = useQuery({
    queryKey: [
      "projects",
      projectId ?? "none",
      "assets",
      narrationAssetId ?? "none",
      "materialized",
    ],
    queryFn: () =>
      materializeChapterNarrationPreview(
        {
          materializeChapterNarration: (input) =>
            window.narrativex.localStorage.materializeChapterNarration(input),
        },
        {
          projectId,
          chapterId: narrationChapterId,
          assetId: narrationAssetId,
          sizeBytes: narrationSizeBytes,
          checksumSha256: narrationChecksum,
        },
      ),
    enabled: Boolean(
      projectId &&
      narrationChapterId &&
      narrationAssetId &&
      narrationSizeBytes &&
      narrationChecksum,
    ),
    staleTime: Infinity,
  });

  const mediaUrl =
    (mediaIsLocalOnly ? localMediaUrl : remoteMedia.data?.url ?? localMediaUrl) ?? null;
  const narrationUrl = localNarration.data ?? null;
  const loading =
    (Boolean(mediaAssetId && !mediaIsLocalOnly) && remoteMedia.isLoading) ||
    (Boolean(narrationAssetId) && localNarration.isLoading);
  const messages: string[] = [];
  if (!loading && mediaAssetId && !mediaUrl) {
    messages.push("Không lấy được media preview URL.");
  }
  if (!loading && narrationAssetId && (localNarration.isError || !narrationUrl)) {
    messages.push("Không materialize được narration audio vào project local.");
  }

  return {
    mediaUrl,
    narrationUrl,
    loading,
    message: messages.length ? messages.join(" ") : null,
  };
}
