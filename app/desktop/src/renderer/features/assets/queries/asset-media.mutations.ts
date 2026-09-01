import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assetsApi } from "../api/assets.api";

export interface ProjectAssetImportResult {
  originalFilename: string;
  durationMs: number | null;
  repaired: boolean;
}

export function useProjectAssetImport(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (repairAssetId?: string): Promise<ProjectAssetImportResult | null> => {
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return null;
      if (selection.kind === "OTHER") {
        throw new Error("Chỉ hỗ trợ image, audio hoặc video asset.");
      }

      const assetId = repairAssetId
        ? repairAssetId
        : (
            await assetsApi.registerLocal({
              projectId,
              type: selection.kind,
              originalFilename: selection.originalFilename,
              contentType: selection.contentType,
              sizeBytes: selection.sizeBytes,
              checksumSha256: selection.checksumSha256,
              durationMs: selection.durationMs,
            })
          ).id;

      if (repairAssetId) {
        await window.narrativex.localStorage.repairSelectedAsset({
          projectId,
          assetId,
          kind: selection.kind,
          selectionToken: selection.selectionToken,
        });
      } else {
        await window.narrativex.localStorage.commitSelectedAsset({
          projectId,
          assetId,
          kind: selection.kind,
          selectionToken: selection.selectionToken,
        });
      }

      return {
        originalFilename: selection.originalFilename,
        durationMs: selection.durationMs ?? null,
        repaired: Boolean(repairAssetId),
      };
    },
    onSuccess: async (result) => {
      if (!result) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assets", "library"] }),
        queryClient.invalidateQueries({ queryKey: ["assets", "local-state", projectId] }),
      ]);
    },
  });
}
