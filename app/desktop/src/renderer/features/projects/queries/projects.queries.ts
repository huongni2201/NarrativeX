import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput, DesktopProject } from "@narrativex/client-contracts";
import {
  projectsApi,
  type ProjectDashboardCounts,
} from "../api/projects.api";

export const projectQueryKeys = {
  all: ["projects"] as const,
  list: () => [...projectQueryKeys.all, "list"] as const,
  detail: (projectId: string) => [...projectQueryKeys.all, "detail", projectId] as const,
};

export function useProjectsQuery() {
  return useQuery({
    queryKey: projectQueryKeys.list(),
    queryFn: loadProjectsWithLocalFallback,
  });
}

export function useProjectQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectQueryKeys.detail(projectId ?? "none"),
    queryFn: () => loadProjectWithLocalFallback(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const project = await projectsApi.create(input);
      try {
        await window.narrativex.localProjects.upsert(project, {
          cloudProjectId: project.id,
          syncStatus: "SYNCED",
        });
        await window.narrativex.localProjects.touch(project.id);
      } catch (error) {
        console.warn(
          "Project was created but could not be persisted to the local catalog.",
          error,
        );
      }
      return project;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all }),
  });
}

export function useToggleProjectFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { projectId: string; starred: boolean }) =>
      input.starred
        ? projectsApi.removeFavorite(input.projectId)
        : projectsApi.addFavorite(input.projectId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.all }),
  });
}

async function loadProjectWithLocalFallback(projectId: string): Promise<DesktopProject> {
  try {
    return await projectsApi.get(projectId);
  } catch (error) {
    const localProjects = await readLocalProjectsSafely();
    const localProject = localProjects.find((project) => project.id === projectId);
    if (localProject) return localProject;
    throw error;
  }
}

async function loadProjectsWithLocalFallback() {
  const localBeforeRefresh = await readLocalProjectsSafely();
  try {
    const remote = await projectsApi.list();
    const localAfterRefresh = await reconcileLocalProjectsSafely(
      remote.content,
      localBeforeRefresh,
    );
    return {
      ...remote,
      content: mergeProjects(localAfterRefresh, remote.content),
    };
  } catch (error) {
    if (localBeforeRefresh.length === 0) throw error;
    return {
      content: localBeforeRefresh,
      nextCursor: null,
      limit: 50,
      hasNext: false,
      counts: countProjects(localBeforeRefresh),
    };
  }
}

async function readLocalProjectsSafely(): Promise<DesktopProject[]> {
  try {
    return (await window.narrativex.localProjects.list()).map((entry) => entry.project);
  } catch (error) {
    console.warn(
      "Could not read the local project catalog; continuing with backend projects.",
      error,
    );
    return [];
  }
}

async function reconcileLocalProjectsSafely(
  remoteProjects: DesktopProject[],
  fallback: DesktopProject[],
): Promise<DesktopProject[]> {
  try {
    return (await window.narrativex.localProjects.reconcile(remoteProjects)).map(
      (entry) => entry.project,
    );
  } catch (error) {
    console.warn("Could not refresh the local project catalog.", error);
    return fallback;
  }
}

function mergeProjects(
  local: DesktopProject[],
  remote: DesktopProject[],
): DesktopProject[] {
  const remoteById = new Map(remote.map((project) => [project.id, project]));
  const merged = local.map((project) => remoteById.get(project.id) ?? project);
  const localIds = new Set(local.map((project) => project.id));

  for (const project of remote) {
    if (!localIds.has(project.id)) merged.push(project);
  }

  return merged;
}

function countProjects(projects: DesktopProject[]): ProjectDashboardCounts {
  return {
    all: projects.length,
    active: projects.filter((project) => project.status === "ACTIVE").length,
    draft: projects.filter((project) => project.status === "DRAFT").length,
  };
}
