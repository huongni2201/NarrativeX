import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { assetsApi } from "../../assets/api/assets.api";
import { productionApi } from "../../production/api/production.api";
import { storyboardApi, type StoryboardVisualBeat } from "../api/storyboard.api";
import { resolveStoryboardImagePreview } from "../model/storyboard-image-preview";
import { runBackgroundRefresh } from "../model/storyboard-media-refresh";
import { persistStoryboardImage } from "./storyboard-media.mutations";
import { storyboardKeys } from "./storyboard.queries";

async function invalidate(queryClient: QueryClient, projectId: string, chapterId: string | null) {
  await Promise.all([queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }), chapterId ? queryClient.invalidateQueries({ queryKey: storyboardKeys.chapter(projectId, chapterId) }) : Promise.resolve(), queryClient.invalidateQueries({ queryKey: ["assets", "library"] })]);
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
    onSettled: () => runBackgroundRefresh(() => invalidate(queryClient, projectId, chapterId), (error) => console.warn("Storyboard media refresh failed", error)),
  });
  return { importImage };
}

export function useStoryboardImagePreview({ projectId, assetId }: Readonly<{ projectId: string; assetId: string | null | undefined; enabled: boolean }>) {
  const preview = assetId ? resolveStoryboardImagePreview({ projectId, assetId }) : null;
  return { isLoading: false, isError: false, data: preview?.url ? { url: preview.url } : undefined };
}
