import { useQuery } from "@tanstack/react-query";

export type ProjectAssetLocalState = "AVAILABLE" | "MISSING" | "CORRUPT";

export const assetLocalStateKeys = {
  project: (projectId: string, assetIds: readonly string[]) =>
    ["assets", "local-state", projectId, [...assetIds].sort().join(",")] as const,
};

export function useProjectAssetLocalStates(projectId: string, assetIds: readonly string[]) {
  return useQuery({
    queryKey: assetLocalStateKeys.project(projectId, assetIds),
    queryFn: async (): Promise<Record<string, ProjectAssetLocalState>> => {
      const entries = await window.narrativex.localStorage.verifyProject(projectId);
      return Object.fromEntries(entries.map((entry) => [entry.assetId, entry.state]));
    },
    enabled: Boolean(projectId),
  });
}
