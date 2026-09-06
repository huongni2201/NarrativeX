import type {
  StoryboardGenerationBatch,
  StoryboardGenerationBeatSnapshot,
} from "@narrativex/client-contracts";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useRef } from "react";
import { assetsApi } from "../../assets/api/assets.api";
import { productionApi } from "../../production/api/production.api";
import {
  storyboardApi,
  type StoryboardVisualBeat,
} from "../api/storyboard.api";
import { GeminiReferenceMaterializer } from "../model/gemini-reference-materializer";
import {
  generateGeminiStoryboardImage,
  persistStoryboardImage,
  type PersistStoryboardImageDeps,
} from "./storyboard-media.mutations";
import { resolveStoryboardImagePreview } from "../model/storyboard-image-preview";
import { runBackgroundRefresh } from "../model/storyboard-media-refresh";
import { storyboardKeys } from "./storyboard.queries";

async function invalidateStoryboardMedia(
  queryClient: QueryClient,
  projectId: string,
  chapterId: string | null,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
    chapterId
      ? queryClient.invalidateQueries({ queryKey: storyboardKeys.chapter(projectId, chapterId) })
      : Promise.resolve(),
    queryClient.invalidateQueries({ queryKey: ["assets", "library"] }),
  ]);
}

export function refreshStoryboardMediaInBackground(
  queryClient: QueryClient,
  projectId: string,
  chapterId: string | null,
  context: string,
): void {
  runBackgroundRefresh(() => invalidateStoryboardMedia(queryClient, projectId, chapterId), (error) => {
    console.warn("Storyboard media cache refresh failed", {
      context,
      lane: "STORYBOARD",
      projectId,
      chapterId,
      error,
    });
  });
}

function createPersistDeps(): PersistStoryboardImageDeps {
  return {
    registerLocal: (input) => assetsApi.registerLocal(input),
    commitGeminiImage: (input) => window.narrativex.geminiWeb.commitImage(input),
    commitSelectedAsset: (input) => window.narrativex.localStorage.commitSelectedAsset(input),
    attachBeatPreview: (
      projectId,
      chapterId,
      sceneId,
      beatId,
      beatRowVersion,
      mediaAssetId,
    ) =>
      storyboardApi.attachPreviewMedia(
        projectId,
        chapterId,
        sceneId,
        beatId,
        beatRowVersion,
        mediaAssetId,
      ),
    updateBeatMedia: (projectId, beatId, input) =>
      productionApi.updateBeatMedia(projectId, beatId, input),
  };
}

export function useStoryboardMediaMutations(projectId: string, chapterId: string | null) {
  const queryClient = useQueryClient();
  const referenceMaterializerRef = useRef(new GeminiReferenceMaterializer());
  const persistDeps = createPersistDeps();

  const importImage = useMutation({
    mutationFn: async ({
      beat,
      hasProductionTimelineBeat,
    }: {
      beat: Pick<StoryboardVisualBeat, "id" | "sceneId" | "rowVersion">;
      hasProductionTimelineBeat: boolean;
    }) => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return null;

      const assetId = await persistStoryboardImage(persistDeps, {
        projectId,
        chapterId,
        sceneId: beat.sceneId,
        beatId: beat.id,
        beatRowVersion: beat.rowVersion,
        hasProductionTimelineBeat,
        selection,
        source: "MANUAL",
      });
      return { assetId };
    },
    onSettled: (result, error) => {
      if (!result && !error) return;
      refreshStoryboardMediaInBackground(queryClient, projectId, chapterId, "manual-import");
    },
  });

  const generateGeminiImage = useMutation({
    mutationFn: async ({
      batch,
      snapshot,
      attemptId,
      onReferencesResolved,
      hasProductionTimelineBeat,
    }: {
      batch: StoryboardGenerationBatch;
      snapshot: StoryboardGenerationBeatSnapshot;
      attemptId: string;
      onReferencesResolved?: (referenceCount: number) => void;
      hasProductionTimelineBeat: boolean;
    }) => {
      if (!chapterId) throw new Error("Chưa chọn chapter để generate Gemini.");
      onReferencesResolved?.(snapshot.references.length);

      return generateGeminiStoryboardImage(
        {
          getPreparedBatch: (targetProjectId, targetChapterId, batchId) =>
            storyboardApi.getGeminiGenerationBatch(targetProjectId, targetChapterId, batchId),
          materializeRemoteAsset: (input) =>
            window.narrativex.localStorage.materializeRemoteAsset(input),
          generateImage: (input) => window.narrativex.geminiWeb.generateImage(input),
          persistImage: (input) => persistStoryboardImage(persistDeps, input),
        },
        {
          projectId,
          chapterId,
          batch,
          snapshot,
          attemptId,
          hasProductionTimelineBeat,
          referenceMaterializer: referenceMaterializerRef.current,
        },
      );
    },
    onSettled: () => {
      refreshStoryboardMediaInBackground(queryClient, projectId, chapterId, "gemini-generate");
    },
  });

  return {
    importImage,
    generateGeminiImage,
  };
}

export function useStoryboardImagePreview({
  projectId,
  assetId,
}: Readonly<{
  projectId: string;
  assetId: string | null | undefined;
  enabled: boolean;
}>) {
  const preview = assetId ? resolveStoryboardImagePreview({ projectId, assetId }) : null;
  return {
    isLoading: false,
    isError: false,
    data: preview?.url ? { url: preview.url } : undefined,
  };
}
