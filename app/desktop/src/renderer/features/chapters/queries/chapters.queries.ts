import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateChapterInput, UpdateChapterInput } from "@narrativex/client-contracts";
import { chaptersApi } from "../api/chapters.api";

export const chapterQueryKeys = {
  all: (projectId: string) => ["projects", projectId, "chapters"] as const,
  list: (projectId: string, storyVersionId: string) => [...chapterQueryKeys.all(projectId), storyVersionId] as const,
  workspace: (projectId: string, chapterId: string) => [...chapterQueryKeys.all(projectId), chapterId, "workspace"] as const,
};

export function useChapterWorkspaceQuery(projectId: string, chapterId: string | null) {
  return useQuery({
    queryKey: chapterQueryKeys.workspace(projectId, chapterId ?? "none"),
    queryFn: () => chaptersApi.workspace(projectId, chapterId as string),
    enabled: Boolean(chapterId),
  });
}

export function useChaptersQuery(projectId: string | null, storyVersionId: string | null) {
  return useQuery({ queryKey: chapterQueryKeys.list(projectId ?? "none", storyVersionId ?? "none"), queryFn: () => chaptersApi.list(projectId as string, storyVersionId as string), enabled: Boolean(projectId && storyVersionId) });
}

export function useCreateChapter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: CreateChapterInput) => chaptersApi.create(projectId, input), onSuccess: () => queryClient.invalidateQueries({ queryKey: chapterQueryKeys.all(projectId) }) });
}

export function useUpdateChapter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: UpdateChapterInput & { chapterId: string }) => chaptersApi.update(projectId, input.chapterId, input), onSuccess: () => queryClient.invalidateQueries({ queryKey: chapterQueryKeys.all(projectId) }) });
}

export function useDeleteChapter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (chapterId: string) => chaptersApi.remove(projectId, chapterId), onSuccess: () => queryClient.invalidateQueries({ queryKey: chapterQueryKeys.all(projectId) }) });
}
