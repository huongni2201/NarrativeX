import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/features/projects/api/projects.api";
import { queryKeys } from "@/lib/query-keys";
import type { ProjectId } from "@/types/api";

export function useProjectResources(projectId: ProjectId, activeTab: string, enabled = true) {
  const locationsQuery = useQuery({
    queryKey: queryKeys.projectLocations(projectId),
    queryFn: () => projectsApi.getLocations(projectId),
    enabled: enabled && activeTab === "locations",
  });

  const assetsQuery = useQuery({
    queryKey: queryKeys.projectAssets(projectId),
    queryFn: () => projectsApi.getAssets(projectId),
    enabled: enabled && activeTab === "assets",
  });

  return { locationsQuery, assetsQuery };
}
