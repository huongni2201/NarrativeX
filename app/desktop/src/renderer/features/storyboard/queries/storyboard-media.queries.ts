import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { assetsApi } from "../../assets/api/assets.api";
import { productionApi } from "../../production/api/production.api";
import { videoProductionQueryKeys } from "../../production/queries/production-cache.ts";
import { chapterAnalysisQueryKeys } from "../../chapters/model/chapter-analysis-query-contract.ts";
import { storyQueryKeys } from "../../story/queries/story.queries.ts";
import { assetLibraryQueryKey } from "../../workspace/queries/useProjectWorkspace.ts";
import { storyboardApi, type StoryboardVisualBeat } from "../api/storyboard.api";
import { resolveStoryboardImagePreview } from "../model/storyboard-image-preview";
import { runBackgroundRefresh } from "../model/storyboard-media-refresh";
import { persistStoryboardImage } from "./storyboard-media.mutations";
import { storyboardKeys } from "./storyboard.queries";

export function invalidatePreviewMediaQueries(
  queryClient: QueryClient,
  projectId: string,
  chapterId: string | null,
) {
  return Promise.all([
    chapterId
      ? queryClient.invalidateQueries({ queryKey: storyboardKeys.chapter(projectId, chapterId) })
      : Promise.resolve(),
    chapterId
      ? queryClient.invalidateQueries({ queryKey: storyQueryKeys.chapterStory(projectId, chapterId) })
      : Promise.resolve(),
    chapterId
      ? queryClient.invalidateQueries({ queryKey: videoProductionQueryKeys.chapter(projectId, chapterId) })
      : Promise.resolve(),
    queryClient.invalidateQueries({ queryKey: chapterAnalysisQueryKeys.timeline(projectId) }),
    queryClient.invalidateQueries({ queryKey: assetLibraryQueryKey(projectId, "all") }),
    queryClient.invalidateQueries({ queryKey: assetLibraryQueryKey(projectId, "visual") }),
  ]);
}

export function useStoryboardMediaMutations(projectId: string, chapterId: string | null) {
  const queryClient = useQueryClient();
  const importImage = useMutation({
    mutationFn: async ({ beat, hasProductionTimelineBeat }: { beat: Pick<StoryboardVisualBeat, "id" | "sceneId" | "rowVersion">; hasProductionTimelineBeat: boolean }) => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return null;
      return { assetId: await persistStoryboardImage({ registerLocal: assetsApi.registerLocal, commitSelectedAsset: window.narrativex.localStorage.commitSelectedAsset, attachBeatPreview: storyboardApi.attachPreviewMedia, updateBeatMedia: productionApi.updateBeatMedia }, { projectId, chapterId, sceneId: beat.sceneId, beatId: beat.id, beatRowVersion: beat.rowVersion, hasProductionTimelineBeat, selection }) };
    },
    onSettled: () =>
      runBackgroundRefresh(
        async () => {
          await invalidatePreviewMediaQueries(queryClient, projectId, chapterId);
        },
        (error) => console.warn("Storyboard media refresh failed", error),
      ),
  });
  return { importImage };
}

export function useStoryboardImagePreview({ projectId, assetId }: Readonly<{ projectId: string; assetId: string | null | undefined; enabled: boolean }>) {
  const preview = assetId ? resolveStoryboardImagePreview({ projectId, assetId }) : null;
  return { isLoading: false, isError: false, data: preview?.url ? { url: preview.url } : undefined };
}
