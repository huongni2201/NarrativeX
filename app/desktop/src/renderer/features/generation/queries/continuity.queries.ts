import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ContinuityReviewInput,
  CreateRegenerationJobInput,
  CreateRegenerationPlanInput,
} from "@narrativex/client-contracts";
import { continuityApi } from "../api/continuity.api.ts";
import { generationQueryKeys } from "./generation.queries.ts";

export const continuityQueryKeys = {
  all: ["continuity"] as const,
  chapter: (projectId: string, chapterId: string) =>
    [...continuityQueryKeys.all, projectId, chapterId] as const,
};

export function useChapterContinuity(projectId: string, chapterId: string | null) {
  return useQuery({
    queryKey: continuityQueryKeys.chapter(projectId, chapterId ?? "none"),
    queryFn: () => continuityApi.get(projectId, chapterId as string),
    enabled: Boolean(projectId && chapterId),
    retry: false,
  });
}

export function useCreateRegenerationPlan(projectId: string, chapterId: string | null) {
  return useMutation({
    mutationFn: (input: CreateRegenerationPlanInput) => {
      if (!chapterId) throw new Error("Chưa chọn chapter để lập regeneration plan.");
      return continuityApi.createRegenerationPlan(projectId, chapterId, input);
    },
  });
}

export function useCreateRegenerationJob(projectId: string, chapterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      request: CreateRegenerationJobInput;
      idempotencyKey: string;
    }) => {
      if (!chapterId) throw new Error("Chưa chọn chapter để regenerate.");
      return continuityApi.createRegenerationJob(
        projectId,
        chapterId,
        input.request,
        input.idempotencyKey,
      );
    },
    onSuccess: (job) => {
      void queryClient.invalidateQueries({
        queryKey: generationQueryKeys.generationJob(job.jobId),
      });
    },
  });
}

export function useReviewContinuity(projectId: string, chapterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ContinuityReviewInput) => {
      if (!chapterId) throw new Error("Chưa chọn chapter để review continuity.");
      return continuityApi.review(projectId, chapterId, input);
    },
    onSuccess: (report) => {
      if (!chapterId) return;
      queryClient.setQueryData(continuityQueryKeys.chapter(projectId, chapterId), report);
    },
  });
}
