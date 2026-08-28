import {
  useMutation,
  useQuery,
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
import {
  generateGeminiStoryboardImage,
  persistStoryboardImage,
  type PersistStoryboardImageDeps,
} from "./storyboard-media.mutations";
import { resolveStoryboardImagePreview } from "../model/storyboard-image-preview";
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

function createPersistDeps(): PersistStoryboardImageDeps {
  return {
    registerLocal: (input) => assetsApi.registerLocal(input),
    commitGeminiImage: (input) => window.narrativex.geminiWeb.commitImage(input),
    commitSelectedAsset: (input) => window.narrativex.localStorage.commitSelectedAsset(input),
    updateBeatMedia: (projectId, beatId, input) =>
      productionApi.updateBeatMedia(projectId, beatId, input),
  };
}

export function useStoryboardMediaMutations(projectId: string, chapterId: string | null) {
  const queryClient = useQueryClient();
  const materializedReferenceIdsRef = useRef(new Set<string>());
  const persistDeps = createPersistDeps();

  const importImage = useMutation({
    mutationFn: async ({ beatId }: { beatId: string }) => {
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return null;

      const assetId = await persistStoryboardImage(persistDeps, {
        projectId,
        beatId,
        selection,
        source: "MANUAL",
      });
      return { assetId };
    },
    onSuccess: async (result) => {
      if (!result) return;
      await invalidateStoryboardMedia(queryClient, projectId, chapterId);
    },
  });

  const generateGeminiImage = useMutation({
    mutationFn: async ({
      beat,
      onReferencesResolved,
    }: {
      beat: Pick<StoryboardVisualBeat, "id">;
      onReferencesResolved?: (referenceCount: number) => void;
    }) => {
      if (!chapterId) throw new Error("Chưa chọn chapter để resolve character reference.");

      return generateGeminiStoryboardImage(
        {
          getGeminiContext: async (targetProjectId, targetChapterId, beatId) => {
            const context = await storyboardApi.geminiContext(
              targetProjectId,
              targetChapterId,
              beatId,
            );
            onReferencesResolved?.(context.references.length);
            return context;
          },
          materializeRemoteAsset: (input) =>
            window.narrativex.localStorage.materializeRemoteAsset(input),
          generateImage: (input) => window.narrativex.geminiWeb.generateImage(input),
          persistImage: (input) => persistStoryboardImage(persistDeps, input),
        },
        {
          projectId,
          chapterId,
          beat,
          materializedReferenceIds: materializedReferenceIdsRef.current,
        },
      );
    },
    onSuccess: async () => {
      await invalidateStoryboardMedia(queryClient, projectId, chapterId);
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
  storageMode,
  enabled,
}: Readonly<{
  projectId: string;
  assetId: string | null | undefined;
  storageMode: string | null | undefined;
  enabled: boolean;
}>) {
  const initialPreview = assetId
    ? resolveStoryboardImagePreview({ projectId, assetId, storageMode, remoteUrl: null })
    : null;
  const remotePreview = useQuery({
    queryKey: ["assets", assetId ?? "none", "download-url"],
    queryFn: () => assetsApi.downloadUrl(assetId as string),
    enabled: Boolean(assetId && enabled && initialPreview?.requiresRemoteUrl),
    staleTime: 30_000,
  });

  const preview = assetId
    ? resolveStoryboardImagePreview({
      projectId,
      assetId,
      storageMode,
      remoteUrl: remotePreview.data?.url,
    })
    : null;

  return {
    ...remotePreview,
    data: preview?.url ? { url: preview.url } : undefined,
  };
}
