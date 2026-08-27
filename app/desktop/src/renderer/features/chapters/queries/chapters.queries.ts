import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CreateChapterInput,
  DesktopChapterDetails,
  DesktopChapterWorkspace,
  UpdateChapterInput,
} from "@narrativex/client-contracts";
import { chaptersApi } from "../api/chapters.api";
import { isAudioProcessingStatus } from "../model/chapter-ui";

export const chapterQueryKeys = {
  all: (projectId: string) => ["projects", projectId, "chapters"] as const,
  list: (projectId: string, storyVersionId: string) =>
    [...chapterQueryKeys.all(projectId), storyVersionId] as const,
  workspace: (projectId: string, chapterId: string) =>
    [...chapterQueryKeys.all(projectId), chapterId, "workspace"] as const,
  workspaces: (projectId: string, chapterIds: string[]) =>
    [...chapterQueryKeys.all(projectId), "workspaces", chapterIds] as const,
};

function invalidateChapterData(queryClient: QueryClient, projectId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: chapterQueryKeys.all(projectId) }),
    // Production timeline contains chapter identity/version/title and is therefore
    // backend-derived chapter data too. Keep it synchronized after every CRUD write.
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
  ]);
}

export function useChapterWorkspacesQuery(
  projectId: string,
  chapters: DesktopChapterDetails[],
  pollingChapterId?: string | null,
) {
  const chapterIds = chapters.map((chapter) => chapter.id);
  const batchQuery = useQuery({
    queryKey: chapterQueryKeys.workspaces(projectId, chapterIds),
    queryFn: () => chaptersApi.workspaces(projectId, chapterIds),
    enabled: Boolean(projectId && chapterIds.length),
    staleTime: 30_000,
  });

  const pollingEnabled = Boolean(
    pollingChapterId && chapterIds.includes(pollingChapterId),
  );
  const pollingQuery = useQuery({
    queryKey: chapterQueryKeys.workspace(projectId, pollingChapterId ?? "none"),
    queryFn: () => chaptersApi.workspace(projectId, pollingChapterId as string),
    enabled: pollingEnabled,
    refetchInterval: (query) =>
      isAudioProcessingStatus(
        (query.state.data as DesktopChapterWorkspace | undefined)?.pipeline.audio.status,
      )
        ? 3000
        : false,
  });

  const workspacesByChapterId = new Map(
    (batchQuery.data ?? []).map((workspace) => [workspace.chapter.id, workspace]),
  );
  if (pollingQuery.data && pollingChapterId) {
    workspacesByChapterId.set(pollingChapterId, pollingQuery.data);
  }

  return chapters.map((chapter) => ({
    data: workspacesByChapterId.get(chapter.id),
    isError:
      batchQuery.isError ||
      (chapter.id === pollingChapterId && pollingQuery.isError && !workspacesByChapterId.has(chapter.id)),
    refetch: chapter.id === pollingChapterId ? pollingQuery.refetch : batchQuery.refetch,
  }));
}

export function useChaptersQuery(projectId: string | null, storyVersionId: string | null) {
  return useQuery({
    queryKey: chapterQueryKeys.list(projectId ?? "none", storyVersionId ?? "none"),
    queryFn: () => chaptersApi.list(projectId as string, storyVersionId as string),
    enabled: Boolean(projectId && storyVersionId),
  });
}

export function useCreateChapter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChapterInput) => chaptersApi.create(projectId, input),
    onSuccess: () => invalidateChapterData(queryClient, projectId),
  });
}

export function useUpdateChapter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateChapterInput & { chapterId: string }) =>
      chaptersApi.update(projectId, input.chapterId, input),
    onSuccess: () => invalidateChapterData(queryClient, projectId),
  });
}

export function useDeleteChapter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chapterId: string) => chaptersApi.remove(projectId, chapterId),
    onSuccess: () => invalidateChapterData(queryClient, projectId),
  });
}
