import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  storyboardApi,
  storyboardQueryKey,
  type CreateVisualBeatInput,
  type StoryboardVisualBeat,
  type VisualBeatReviewStatus,
} from "../api/storyboard.api.ts";

export const storyboardKeys = {
  chapter: (projectId: string, chapterId: string) => storyboardQueryKey(projectId, chapterId),
  idle: (projectId: string) => ["projects", projectId, "storyboard", "idle"] as const,
};

export async function approveVisualBeats(
  projectId: string,
  chapterId: string,
  beats: readonly Pick<StoryboardVisualBeat, "id" | "sceneId" | "rowVersion">[],
) {
  const results = await Promise.allSettled(
    beats.map((beat) =>
      storyboardApi.updateReviewStatus(
        projectId,
        chapterId,
        beat.sceneId,
        beat.id,
        beat.rowVersion,
        "APPROVED",
      ),
    ),
  );

  return {
    approved: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}

export function useStoryboardQuery(projectId: string, chapterId: string | null) {
  return useQuery({
    queryKey: chapterId ? storyboardKeys.chapter(projectId, chapterId) : storyboardKeys.idle(projectId),
    queryFn: () => storyboardApi.get(projectId, chapterId as string),
    enabled: Boolean(chapterId),
  });
}

export function useCreateVisualBeat(projectId: string, chapterId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { sceneId: string; beat: CreateVisualBeatInput }) => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      return storyboardApi.createVisualBeat(projectId, chapterId, input.sceneId, input.beat);
    },
    onSuccess: async () => {
      if (!chapterId) return;
      await queryClient.invalidateQueries({ queryKey: storyboardKeys.chapter(projectId, chapterId) });
    },
  });
}

export function useUpdateVisualBeatReview(projectId: string, chapterId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { beat: StoryboardVisualBeat; status: VisualBeatReviewStatus }) => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      return storyboardApi.updateReviewStatus(
        projectId,
        chapterId,
        input.beat.sceneId,
        input.beat.id,
        input.beat.rowVersion,
        input.status,
      );
    },
    onSuccess: async () => {
      if (!chapterId) return;
      await queryClient.invalidateQueries({ queryKey: storyboardKeys.chapter(projectId, chapterId) });
    },
  });
}

export function useApproveVisualBeats(projectId: string, chapterId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (beats: readonly StoryboardVisualBeat[]) => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      return approveVisualBeats(projectId, chapterId, beats);
    },
    onSuccess: async () => {
      if (!chapterId) return;
      await queryClient.invalidateQueries({ queryKey: storyboardKeys.chapter(projectId, chapterId) });
    },
  });
}
