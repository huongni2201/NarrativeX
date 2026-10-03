import type { QueryClient } from "@tanstack/react-query";

export const videoProductionQueryKeys = {
  all: ["video-production"] as const,
  chapters: (projectId: string) => ["video-production", "chapter", projectId] as const,
  chapter: (projectId: string, chapterId: string) => ["video-production", "chapter", projectId, chapterId] as const,
  chapterStatus: (projectId: string, chapterId: string) => ["video-production", "chapter", projectId, chapterId, "status"] as const,
  chapterProduction: (projectId: string, chapterId: string) => ["video-production", "chapter", projectId, chapterId, "production"] as const,
};

export function refreshProduction(client: QueryClient, projectId: string, chapterId?: string | null) {
  return Promise.all([
    client.invalidateQueries({ queryKey: chapterId ? videoProductionQueryKeys.chapter(projectId, chapterId) : videoProductionQueryKeys.chapters(projectId) }),
    client.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
    client.invalidateQueries({ queryKey: chapterId ? ["projects", projectId, "chapters", chapterId] : ["projects", projectId, "chapters"] }),
    client.invalidateQueries({ queryKey: ["generation", "current-media-job", projectId, ...(chapterId ? [chapterId] : [])] }),
  ]);
}

export function productionPollInterval(busy: boolean, connected: boolean): number | false {
  // Disconnected idle probes also discover enqueues whose SSE event was lost.
  return connected ? (busy ? 30_000 : false) : (busy ? 3_000 : 15_000);
}
