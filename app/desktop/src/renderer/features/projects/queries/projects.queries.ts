import { useQuery } from "@tanstack/react-query";
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
