import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";
import type {
  CreateChapterInput,
  DesktopChapterDetails,
  DesktopChapterWorkspace,
  UpdateChapterInput,
} from "@narrativex/client-contracts";
import { chaptersApi } from "../api/chapters.api";

export const chapterQueryKeys = {
  all: (projectId: string) => ["projects", projectId, "chapters"] as const,
  list: (projectId: string, storyVersionId: string) =>
    [...chapterQueryKeys.all(projectId), storyVersionId] as const,
  workspace: (projectId: string, chapterId: string) =>
    [...chapterQueryKeys.all(projectId), chapterId, "workspace"] as const,
};

export function useChapterWorkspacesQuery(
  projectId: string,
  chapters: DesktopChapterDetails[],
  pollingChapterId?: string | null,
  forcePollingChapterId?: string | null,
) {
  return useQueries({
    queries: chapters.map((chapter) => ({
      queryKey: chapterQueryKeys.workspace(projectId, chapter.id),
      queryFn: () => chaptersApi.workspace(projectId, chapter.id),
      enabled: Boolean(projectId && chapter.id),
      refetchInterval: (query: Query<DesktopChapterWorkspace, Error, DesktopChapterWorkspace>) => {
        if (chapter.id !== pollingChapterId) return false;

        // The enqueue endpoint can return before the workspace projection has switched
        // from NOT_STARTED to QUEUED. Keep polling the chapter that was just submitted
        // so the UI cannot fall back to an idle state and enable duplicate clicks.
        if (chapter.id === forcePollingChapterId) return 1500;

        return isAudioProcessingStatus(query.state.data?.pipeline.audio.status) ? 3000 : false;
      },
    })),
  });
}

export function isAudioProcessingStatus(status: string | null | undefined) {
  if (!status) return false;
  return [
    "QUEUED",
    "RUNNING",
    "GENERATING",
    "STALLED",
    "UNKNOWN",
    "PAUSED_COST_LIMIT",
  ].includes(status);
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chapterQueryKeys.all(projectId) }),
        // Creating the first chapter may also create the project's StoryVersion.
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
      ]);
    },
  });
}

export function useUpdateChapter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateChapterInput & { chapterId: string }) =>
      chaptersApi.update(projectId, input.chapterId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chapterQueryKeys.all(projectId) }),
  });
}

export function useDeleteChapter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chapterId: string) => chaptersApi.remove(projectId, chapterId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chapterQueryKeys.all(projectId) }),
  });
}
