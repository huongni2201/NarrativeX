import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateMediaJobInput, MediaReviewInput } from "@narrativex/client-contracts";
import { generationApi } from "../api/generation.api.ts";
import {
  isActiveGenerationJobStatus,
  isActiveMediaExecutionStatus,
} from "../generation-status.ts";

export const generationQueryKeys = {
  all: ["generation"] as const,
  generationJob: (jobId: string) =>
    [...generationQueryKeys.all, "generation-job", jobId] as const,
  mediaJob: (jobId: string) =>
    [...generationQueryKeys.all, "media-job", jobId] as const,
};

export function useAnalyzeChapter() {
  return useMutation({
    mutationFn: (input: { projectId: string; chapterId: string }) =>
      generationApi.analyze(input.projectId, input.chapterId),
  });
}

export function useEstimateMediaJob() {
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      chapterId: string;
      qualityTier: CreateMediaJobInput["qualityTier"];
    }) =>
      generationApi.estimate(input.projectId, input.chapterId, {
        qualityTier: input.qualityTier,
      }),
  });
}

export function useCreateMediaJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      projectId: string;
      chapterId: string;
      request: CreateMediaJobInput;
      idempotencyKey: string;
    }) =>
      generationApi.createMediaJob(
        input.projectId,
        input.chapterId,
        input.request,
        input.idempotencyKey,
      ),
    onSuccess: (job) =>
      queryClient.invalidateQueries({
        queryKey: generationQueryKeys.mediaJob(job.jobId),
      }),
  });
}

export function useMediaJob(jobId: string | null) {
  return useQuery({
    queryKey: generationQueryKeys.mediaJob(jobId ?? "none"),
    queryFn: () => generationApi.getJob(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) =>
      query.state.data &&
      query.state.data.items.some((item) => isActiveMediaExecutionStatus(item.executionStatus))
        ? 2_000
        : false,
  });
}

export function useGenerationJob(jobId: string | null) {
  return useQuery({
    queryKey: generationQueryKeys.generationJob(jobId ?? "none"),
    queryFn: () => generationApi.getGenerationJob(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) =>
      isActiveGenerationJobStatus(query.state.data?.status) ? 2_000 : false,
  });
}

export function useReviewMediaItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { itemId: string; review: MediaReviewInput; jobId?: string }) =>
      generationApi.review(input.itemId, input.review),
    onSuccess: (_value, input) => {
      if (input.jobId) {
        void queryClient.invalidateQueries({
          queryKey: generationQueryKeys.mediaJob(input.jobId),
        });
      }
    },
  });
}
