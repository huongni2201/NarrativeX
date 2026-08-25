import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput, DesktopProject } from "@narrativex/client-contracts";
import { projectsApi } from "../api/projects.api";

export const projectQueryKeys = {
  all: ["projects"] as const,
  list: () => [...projectQueryKeys.all, "list"] as const,
};

export function useProjectsQuery() {
  return useQuery({
    queryKey: projectQueryKeys.list(),
    queryFn: loadProjectsWithLocalFallback,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const project = await projectsApi.create(input);
      await window.narrativex.localProjects.upsert(project, { syncStatus: "LOCAL_ONLY" });
      await window.narrativex.localProjects.touch(project.id);
      return project;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectQueryKeys.all }),
  });
}

export function useToggleProjectFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; starred: boolean }) => input.starred ? projectsApi.removeFavorite(input.projectId) : projectsApi.addFavorite(input.projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectQueryKeys.all }),
  });
}

async function loadProjectsWithLocalFallback() {
  const localBeforeRefresh = await window.narrativex.localProjects.list();
  try {
    const remote = await projectsApi.list();
    const localAfterRefresh = await window.narrativex.localProjects.reconcile(remote.content);
    return {
      ...remote,
      content: mergeProjects(
        localAfterRefresh.map((entry) => entry.project),
        remote.content,
      ),
    };
  } catch (error) {
    if (localBeforeRefresh.length === 0) throw error;
    return {
      content: localBeforeRefresh.map((entry) => entry.project),
      nextCursor: null,
    };
  }
}

function mergeProjects(local: DesktopProject[], remote: DesktopProject[]): DesktopProject[] {
  const remoteById = new Map(remote.map((project) => [project.id, project]));
  const merged = local.map((project) => remoteById.get(project.id) ?? project);
  const localIds = new Set(local.map((project) => project.id));
  for (const project of remote) {
    if (!localIds.has(project.id)) merged.push(project);
  }
  return merged;
}
