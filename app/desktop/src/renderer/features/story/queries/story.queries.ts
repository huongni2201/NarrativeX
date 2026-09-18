import { useQuery } from "@tanstack/react-query";
import type { DesktopChapterStory } from "@narrativex/client-contracts";
import { storyApi } from "../api/story.api.ts";

export const storyQueryKeys = {
  all: ["story"] as const,
  chapterStory: (projectId: string, chapterId: string) =>
    [...storyQueryKeys.all, "chapter", projectId, chapterId] as const,
};

export function useChapterStoryQuery(projectId: string | null, chapterId: string | null) {
  return useQuery<DesktopChapterStory>({
    queryKey: storyQueryKeys.chapterStory(projectId ?? "", chapterId ?? ""),
    queryFn: () => {
      if (!projectId || !chapterId) {
        throw new Error("Missing projectId or chapterId");
      }
      return storyApi.getChapterStory(projectId, chapterId);
    },
    enabled: Boolean(projectId && chapterId),
    staleTime: 30_000,
  });
}
