import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { BeatMediaFitMode, DesktopAsset, DesktopTimelineBeat } from "@narrativex/client-contracts";
import { assetsApi } from "../../assets/api/assets.api";
import { productionApi } from "../../production/api/production.api";
import {
  createEditorMediaAttachInput,
  persistEditorMedia,
  type EditorMediaAttachInput,
  type EditorMediaKind,
} from "../model/editor-media-workflow";

async function invalidateEditorMedia(queryClient: QueryClient, projectId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
    queryClient.invalidateQueries({ queryKey: ["assets", "library"] }),
  ]);
}

export function useEditorMediaMutations(projectId: string | null) {
  const queryClient = useQueryClient();

  const importMedia = useMutation({
    mutationFn: async ({
      beat,
      expectedType,
      isCurrent,
    }: {
      beat: DesktopTimelineBeat;
      expectedType?: EditorMediaKind;
      isCurrent?: () => boolean;
    }) => {
      if (!projectId) throw new Error("Project timeline chưa sẵn sàng.");
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection || (isCurrent && !isCurrent())) return null;

      return persistEditorMedia(
        {
          registerLocal: (input) => assetsApi.registerLocal(input),
          commitSelectedAsset: (input) => window.narrativex.localStorage.commitSelectedAsset(input),
          updateBeatMedia: (targetProjectId, beatId, input) =>
            productionApi.updateBeatMedia(targetProjectId, beatId, input),
        },
        {
          projectId,
          beatId: beat.visualBeatId,
          beatDurationMs: beat.durationMs,
          selection,
          expectedType,
        },
      );
    },
    onSuccess: async (result) => {
      if (result && projectId) await invalidateEditorMedia(queryClient, projectId);
    },
  });

  const attachMedia = useMutation({
    mutationFn: async (input: EditorMediaAttachInput) => {
      if (!projectId) throw new Error("Project timeline chưa sẵn sàng.");
      await productionApi.updateBeatMedia(projectId, input.beatId, {
        mediaAssetId: input.mediaAssetId,
        fitMode: input.fitMode,
        trimStartMs: input.trimStartMs,
      });
    },
    onSuccess: async () => {
      if (projectId) await invalidateEditorMedia(queryClient, projectId);
    },
  });

  const chooseExistingAsset = useMutation({
    mutationFn: async ({ beat, asset }: { beat: DesktopTimelineBeat; asset: DesktopAsset }) => {
      if (!projectId) throw new Error("Project timeline chưa sẵn sàng.");
      if (asset.type !== "IMAGE" && asset.type !== "VIDEO") {
        throw new Error("Asset này không thể dùng làm visual media.");
      }
      const input = createEditorMediaAttachInput(
        beat.visualBeatId,
        beat.durationMs,
        asset.id,
        asset.type,
        asset.durationMs,
      );
      await productionApi.updateBeatMedia(projectId, beat.visualBeatId, {
        mediaAssetId: input.mediaAssetId,
        fitMode: input.fitMode,
        trimStartMs: input.trimStartMs,
      });
      return { ...input, originalFilename: asset.originalFilename };
    },
    onSuccess: async () => {
      if (projectId) await invalidateEditorMedia(queryClient, projectId);
    },
  });

  const updateFitMode = useMutation({
    mutationFn: async ({
      beat,
      fitMode,
    }: {
      beat: DesktopTimelineBeat;
      fitMode: BeatMediaFitMode;
    }) => {
      if (!projectId || !beat.mediaAssetId) throw new Error("Beat chưa có media để cập nhật.");
      await productionApi.updateBeatMedia(projectId, beat.visualBeatId, {
        mediaAssetId: beat.mediaAssetId,
        fitMode,
        trimStartMs: beat.trimStartMs,
      });
    },
    onSuccess: async () => {
      if (projectId) await invalidateEditorMedia(queryClient, projectId);
    },
  });

  const resetMedia = useMutation({
    mutationFn: async ({ beatId }: { beatId: string }) => {
      if (!projectId) throw new Error("Project timeline chưa sẵn sàng.");
      await productionApi.resetBeatMedia(projectId, beatId);
    },
    onSuccess: async () => {
      if (projectId) await invalidateEditorMedia(queryClient, projectId);
    },
  });

  return {
    importMedia,
    attachMedia,
    chooseExistingAsset,
    updateFitMode,
    resetMedia,
  };
}
