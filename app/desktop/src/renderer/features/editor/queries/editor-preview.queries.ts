import { useQuery } from "@tanstack/react-query";
import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url";
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
  narrationChapterId,
  narrationAssetId,
  narrationSizeBytes,
  narrationChecksum,
}: Readonly<{
  projectId: string | null;
  mediaAssetId: string | null;
  narrationChapterId: string | null;
  narrationAssetId: string | null;
  narrationSizeBytes: number | null;
  narrationChecksum: string | null;
}>): EditorPreviewSources {
  const mediaUrl =
    projectId && mediaAssetId
      ? localAssetPreviewUrl(projectId, mediaAssetId)
      : null;

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

  const narrationUrl = localNarration.data ?? null;
  const loading = Boolean(narrationAssetId) && localNarration.isLoading;
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
