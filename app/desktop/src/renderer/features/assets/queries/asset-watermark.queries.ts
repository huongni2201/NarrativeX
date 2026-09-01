import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ProjectAssetWatermarkState = "PENDING" | "REMOVED" | "NOT_APPLICABLE";

export const assetWatermarkKeys = {
  project: (projectId: string, assetIds: readonly string[]) =>
    ["assets", "watermark", projectId, [...assetIds].sort().join(",")] as const,
};

export function useProjectAssetWatermarkStates(projectId: string, assetIds: readonly string[]) {
  return useQuery({
    queryKey: assetWatermarkKeys.project(projectId, assetIds),
    queryFn: () =>
      window.narrativex.geminiWeb.watermarkStates({ projectId, assetIds: [...assetIds] }),
    enabled: Boolean(projectId) && assetIds.length > 0,
  });
}

export function useProjectAssetWatermarkRemoval(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetIds: string[]) =>
      window.narrativex.geminiWeb.removeWatermarks({ projectId, assetIds }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assets", "watermark", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["assets", "local-state", projectId] }),
      ]);
    },
  });
}
