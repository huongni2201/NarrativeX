import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput, DesktopProject } from "@narrativex/client-contracts";
import {
  projectsApi,
  type ProjectDashboardCounts,
  type ProjectsPage,
} from "../api/projects.api";

export const projectQueryKeys = {
  all: ["projects"] as const,
  list: () => [...projectQueryKeys.all, "list"] as const,
  detail: (projectId: string) => [...projectQueryKeys.all, "detail", projectId] as const,
};

export function useProjectsQuery() {
  return useQuery({
    queryKey: projectQueryKeys.list(),
    queryFn: loadDeviceLocalProjects,
  });
}

export function useProjectQuery(projectId: string | null) {
  return useQuery({
    queryKey: projectQueryKeys.detail(projectId ?? "none"),
    queryFn: () => loadDeviceLocalProject(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const project = await projectsApi.create(input);
      try {
        await window.narrativex.localProjects.upsert(project);
        await window.narrativex.localProjects.touch(project.id);
      } catch (error) {
        console.warn(
          "Project was created but could not be persisted to this device's local catalog.",
          error,
        );
        try {
          await projectsApi.remove(project.id);
        } catch (rollbackError) {
          console.error(
            "Could not archive backend project after local registration failed.",
            rollbackError,
          );
        }
        throw new Error("Project could not be registered on this device.");
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
    mutationFn: async (input: { projectId: string; desiredStarred: boolean }) => {
      if (input.desiredStarred) await projectsApi.addFavorite(input.projectId);
      else await projectsApi.removeFavorite(input.projectId);

      try {
        const authoritative = await projectsApi.get(input.projectId);
        await window.narrativex.localProjects.setFavorite(
          input.projectId,
          Boolean(authoritative.isStarred),
        );
        return authoritative;
      } catch (error) {
        throw new Error(
          "Favorite was updated on the server but could not be synchronized locally.",
          { cause: error },
        );
      }
    },
    onSuccess: (project) => {
      queryClient.setQueryData<DesktopProject>(projectQueryKeys.detail(project.id), project);
      queryClient.setQueryData<ProjectsPage>(projectQueryKeys.list(), (current) => {
        if (!current) return current;
        return {
          ...current,
          content: current.content.map((item) => (item.id === project.id ? project : item)),
        };
      });
      return queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      await projectsApi.remove(projectId);
      await window.narrativex.localProjects.markArchived(projectId);
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.removeQueries({ queryKey: projectQueryKeys.detail(projectId) });
      queryClient.setQueryData<ProjectsPage>(projectQueryKeys.list(), (current) => {
        if (!current) return current;
        const content = current.content.filter((project) => project.id !== projectId);
        return { ...current, content, counts: countProjects(content) };
      });
      return queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    },
  });
}

async function loadDeviceLocalProject(projectId: string): Promise<DesktopProject> {
  const localProjects = await readDeviceLocalProjects();
  const localProject = localProjects.find((project) => project.id === projectId);
  if (!localProject) {
    throw new Error("Project is not available on this device.");
  }

  try {
    return await projectsApi.get(projectId);
  } catch (error) {
    console.warn(
      "Backend project metadata is unavailable; using the registered local project metadata.",
      error,
    );
    return localProject;
  }
}

async function loadDeviceLocalProjects(): Promise<ProjectsPage> {
  const content = await readDeviceLocalProjects();
  return {
    content,
    nextCursor: null,
    limit: Math.max(content.length, 50),
    hasNext: false,
    counts: countProjects(content),
  };
}

async function readDeviceLocalProjects(): Promise<DesktopProject[]> {
  const entries = await window.narrativex.localProjects.list();
  return entries.map((entry) => entry.project);
}

function countProjects(projects: DesktopProject[]): ProjectDashboardCounts {
  return {
    all: projects.length,
    active: projects.filter((project) => project.status === "ACTIVE").length,
    draft: projects.filter((project) => project.status === "DRAFT").length,
  };
}
