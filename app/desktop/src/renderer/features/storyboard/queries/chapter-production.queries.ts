import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GenerationStrategy } from "@narrativex/client-contracts";
import {
  chapterProductionApi,
  chapterProductionQueryKey,
  type GenerateShotTakeInput,
  type SelectTakeInput,
} from "../api/chapter-production.api";

export function useChapterProductionQuery(projectId: string, chapterId: string | null) {
  return useQuery({
    queryKey: chapterProductionQueryKey(projectId, chapterId ?? ""),
    queryFn: () => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      return chapterProductionApi.getProduction(projectId, chapterId);
    },
    enabled: Boolean(projectId && chapterId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      // If any shot is generating/validating/queued, poll every 3s
      const isBusy = data.scenes.some((scene) =>
        scene.visualBeats.some((vb) =>
          vb.shotSequence?.shots.some((s) =>
            s.status === "QUEUED" ||
            s.status === "GENERATING" ||
            s.status === "VALIDATING" ||
            s.takes.some((t) => t.status === "PENDING" || t.status === "RUNNING")
          )
        )
      );
      return isBusy ? 3000 : false;
    },
  });
}

export function useChapterProductionMutations(projectId: string, chapterId: string | null) {
  const queryClient = useQueryClient();

  const generateTake = useMutation({
    mutationFn: ({ shotId, input }: { shotId: string; input: GenerateShotTakeInput }) =>
      chapterProductionApi.generateTake(projectId, shotId, input),
    onSettled: async () => {
      await Promise.all([
        chapterId
          ? queryClient.invalidateQueries({
              queryKey: chapterProductionQueryKey(projectId, chapterId),
            })
          : Promise.resolve(),
        chapterId
          ? queryClient.invalidateQueries({
              queryKey: ["video-production", "chapter", projectId, chapterId, "status"],
            })
          : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
      ]);
    },
  });

  const selectTake = useMutation({
    mutationFn: ({ shotId, input }: { shotId: string; input: SelectTakeInput }) =>
      chapterProductionApi.selectTake(projectId, shotId, input),
    onSettled: async () => {
      await Promise.all([
        chapterId
          ? queryClient.invalidateQueries({
              queryKey: chapterProductionQueryKey(projectId, chapterId),
            })
          : Promise.resolve(),
        chapterId
          ? queryClient.invalidateQueries({
              queryKey: ["video-production", "chapter", projectId, chapterId, "status"],
            })
          : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
      ]);
    },
  });

  const updateStrategy = useMutation({
    mutationFn: ({ shotId, strategy }: { shotId: string; strategy: GenerationStrategy }) =>
      chapterProductionApi.updateStrategy(projectId, shotId, strategy),
    onSettled: async () => {
      if (chapterId) {
        await queryClient.invalidateQueries({
          queryKey: chapterProductionQueryKey(projectId, chapterId),
        });
      }
    },
  });

  return { generateTake, selectTake, updateStrategy };
}
