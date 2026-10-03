import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GenerationStrategy,
} from "@narrativex/client-contracts";
import {
  type GenerateShotTakeInput,
  type SelectTakeInput,
  videoProductionApi,
} from "../api/video-production.api";

import { videoProductionQueryKeys, refreshProduction, productionPollInterval } from "./production-cache.ts";
import { isProjectSseActive } from "../../generation/realtime/project-event-subscription.ts";
export { videoProductionQueryKeys } from "./production-cache.ts";

export function useChapterProductionStatus(projectId: string, chapterId: string | null) {
  return useQuery(queryOptions({
    queryKey: videoProductionQueryKeys.chapterStatus(projectId, chapterId ?? ""),
    queryFn: () => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      return videoProductionApi.getProductionStatus(projectId, chapterId);
    },
    enabled: Boolean(projectId && chapterId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 15_000;
      const isBusy =
        data.generatingShots > 0 || data.validatingShots > 0 || data.queuedShots > 0;
      return productionPollInterval(isBusy, isProjectSseActive(projectId));
    },
  }));
}

export function useChapterProduction(projectId: string, chapterId: string | null) {
  return useQuery(queryOptions({
    queryKey: videoProductionQueryKeys.chapterProduction(projectId, chapterId ?? ""),
    queryFn: () => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      return videoProductionApi.getProduction(projectId, chapterId);
    },
    enabled: Boolean(projectId && chapterId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 15_000;
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
      return productionPollInterval(isBusy, isProjectSseActive(projectId));
    },
  }));
}

export function useGenerateShot(projectId: string, chapterId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { shotId: string; input?: GenerateShotTakeInput }) => {
      variables.input ??= {};
      return videoProductionApi.generateTake(projectId, variables.shotId, variables.input);
    },
    onSettled: () => refreshProduction(queryClient, projectId, chapterId),
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
    onSettled: () => refreshProduction(queryClient, projectId, chapterId),
  });
}

export function useUpdateShotStrategy(projectId: string, chapterId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shotId, strategy }: { shotId: string; strategy: GenerationStrategy }) =>
      videoProductionApi.updateStrategy(projectId, shotId, strategy),
    onSettled: () => refreshProduction(queryClient, projectId, chapterId),
  });
}
