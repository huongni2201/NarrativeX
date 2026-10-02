import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ChapterProductionResponse,
  ChapterProductionStatus,
  GenerationStrategy,
} from "@narrativex/client-contracts";
import {
  type GenerateShotTakeInput,
  type SelectTakeInput,
  videoProductionApi,
} from "../api/video-production.api";

export const videoProductionQueryKeys = {
  all: ["video-production"] as const,

  chapterStatus: (projectId: string, chapterId: string) =>
    ["video-production", "chapter", projectId, chapterId, "status"] as const,

  chapterProduction: (projectId: string, chapterId: string) =>
    ["video-production", "chapter", projectId, chapterId, "production"] as const,

  shot: (projectId: string, shotId: string) =>
    ["video-production", "shot", projectId, shotId] as const,

  shotTakes: (projectId: string, shotId: string) =>
    ["video-production", "shot", projectId, shotId, "takes"] as const,
};

export function useChapterProductionStatus(projectId: string, chapterId: string | null) {
  return useQuery<ChapterProductionStatus>({
    queryKey: videoProductionQueryKeys.chapterStatus(projectId, chapterId ?? ""),
    queryFn: () => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      return videoProductionApi.getProductionStatus(projectId, chapterId);
    },
    enabled: Boolean(projectId && chapterId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const isBusy =
        data.generatingShots > 0 || data.validatingShots > 0 || data.queuedShots > 0;
      return isBusy ? 3000 : false;
    },
  });
}

export function useChapterProduction(projectId: string, chapterId: string | null) {
  return useQuery<ChapterProductionResponse>({
    queryKey: videoProductionQueryKeys.chapterProduction(projectId, chapterId ?? ""),
    queryFn: () => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      return videoProductionApi.getProduction(projectId, chapterId);
    },
    enabled: Boolean(projectId && chapterId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const isBusy = data.scenes.some((scene) =>
        scene.visualBeats.some((vb) =>
          vb.shotSequence?.shots.some((s) =>
            s.status === "QUEUED" ||
            s.status === "GENERATING" ||
            s.status === "VALIDATING" ||
            s.takes.some((t) => t.status === "PENDING" || t.status === "RUNNING"),
          ),
        ),
      );
      return isBusy ? 3000 : false;
    },
  });
}

export function useGenerateShot(projectId: string, chapterId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shotId, input = {} }: { shotId: string; input?: GenerateShotTakeInput }) =>
      videoProductionApi.generateTake(projectId, shotId, input),
    onSettled: async () => {
      const promises: Promise<unknown>[] = [
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
      ];
      if (chapterId) {
        promises.push(
          queryClient.invalidateQueries({
            queryKey: videoProductionQueryKeys.chapterStatus(projectId, chapterId),
          }),
          queryClient.invalidateQueries({
            queryKey: videoProductionQueryKeys.chapterProduction(projectId, chapterId),
          }),
          queryClient.invalidateQueries({
            queryKey: ["projects", projectId, "chapters", chapterId, "production"],
          }),
        );
      }
      await Promise.all(promises);
    },
  });
}

export function useRetakeShot(projectId: string, chapterId?: string | null) {
  return useGenerateShot(projectId, chapterId);
}

export function useSelectTake(projectId: string, chapterId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shotId, input }: { shotId: string; input: SelectTakeInput }) =>
      videoProductionApi.selectTake(projectId, shotId, input),
    onSettled: async () => {
      const promises: Promise<unknown>[] = [
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
      ];
      if (chapterId) {
        promises.push(
          queryClient.invalidateQueries({
            queryKey: videoProductionQueryKeys.chapterStatus(projectId, chapterId),
          }),
          queryClient.invalidateQueries({
            queryKey: videoProductionQueryKeys.chapterProduction(projectId, chapterId),
          }),
          queryClient.invalidateQueries({
            queryKey: ["projects", projectId, "chapters", chapterId, "production"],
          }),
        );
      }
      await Promise.all(promises);
    },
  });
}

export function useUpdateShotStrategy(projectId: string, chapterId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shotId, strategy }: { shotId: string; strategy: GenerationStrategy }) =>
      videoProductionApi.updateStrategy(projectId, shotId, strategy),
    onSettled: async () => {
      if (chapterId) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: videoProductionQueryKeys.chapterStatus(projectId, chapterId),
          }),
          queryClient.invalidateQueries({
            queryKey: videoProductionQueryKeys.chapterProduction(projectId, chapterId),
          }),
          queryClient.invalidateQueries({
            queryKey: ["projects", projectId, "chapters", chapterId, "production"],
          }),
        ]);
      }
    },
  });
}
