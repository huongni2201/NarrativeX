import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput, DesktopProject } from "@narrativex/client-contracts";
import {
  projectsApi,
  type ProjectDashboardCounts,
  type ProjectsPage,
} from "../api/projects.api";
import {
  mergeBackendProject,
  withoutBackendWorkflow,
} from "../model/project-continuation.ts";

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
      const currentDetail = queryClient.getQueryData<DesktopProject>(projectQueryKeys.detail(project.id));
      const updatedProject = currentDetail ? mergeBackendProject(currentDetail, project) : project;
      queryClient.setQueryData<DesktopProject>(projectQueryKeys.detail(project.id), updatedProject);
      queryClient.setQueryData<ProjectsPage>(projectQueryKeys.list(), (current) => {
        if (!current) return current;
        return {
          ...current,
          content: current.content.map((item) =>
            item.id === project.id ? mergeBackendProject(item, project) : item,
          ),
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
  const localProjects = await readDeviceLocalProjects();
  let content = localProjects.map(withoutBackendWorkflow);
  if (localProjects.length > 0) {
    try {
      const backendProjects = await readBackendProjectSummaries(localProjects.map((project) => project.id));
      content = localProjects.map((localProject) => {
        const backendProject = backendProjects.get(localProject.id);
        return backendProject
          ? mergeBackendProject(localProject, backendProject)
          : withoutBackendWorkflow(localProject);
      });
    } catch (error) {
      console.warn(
        "Backend workflow state is unavailable; continuing from the local project catalog conservatively.",
        error,
      );
    }
  }
  return {
    content,
    nextCursor: null,
    limit: Math.max(content.length, 50),
    hasNext: false,
    counts: countProjects(content),
  };
}

async function readBackendProjectSummaries(projectIds: string[]) {
  const remaining = new Set(projectIds);
  const projects = new Map<string, DesktopProject>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = await projectsApi.dashboard({ limit: 100, cursor });
    for (const project of page.content) {
      projects.set(project.id, project);
      remaining.delete(project.id);
    }
    if (remaining.size === 0 || !page.hasNext || !page.nextCursor) break;
    if (seenCursors.has(page.nextCursor)) {
      throw new Error("Project dashboard pagination returned a repeated cursor.");
    }
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (true);

  return projects;
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
