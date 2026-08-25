import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput } from "@narrativex/client-contracts";
import { projectsApi } from "../api/projects.api";

export const projectQueryKeys = {
  all: ["projects"] as const,
  list: () => [...projectQueryKeys.all, "list"] as const,
};

export function useProjectsQuery() {
  return useQuery({
    queryKey: projectQueryKeys.list(),
    queryFn: projectsApi.list,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
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
