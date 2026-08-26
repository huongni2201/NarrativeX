import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateMediaJobInput,
  GenerationJob,
  MediaReviewInput,
} from "@narrativex/client-contracts";
import { subscribeSse } from "../../../api/sse.ts";
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
  currentMediaJob: (projectId: string, chapterId: string) =>
    [...generationQueryKeys.all, "current-media-job", projectId, chapterId] as const,
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
    onSuccess: (job, input) => {
      void queryClient.invalidateQueries({
        queryKey: generationQueryKeys.mediaJob(job.jobId),
      });
      void queryClient.invalidateQueries({
        queryKey: generationQueryKeys.currentMediaJob(input.projectId, input.chapterId),
      });
    },
  });
}

export function useCurrentMediaJob(projectId: string, chapterId: string | null) {
  return useQuery({
    queryKey: generationQueryKeys.currentMediaJob(projectId, chapterId ?? "none"),
    queryFn: () => generationApi.getCurrentMediaJob(projectId, chapterId as string),
    enabled: Boolean(projectId && chapterId),
  });
}

export function useMediaJob(jobId: string | null) {
  return useQuery({
    queryKey: generationQueryKeys.mediaJob(jobId ?? "none"),
    queryFn: () => generationApi.getJob(jobId as string),
    enabled: Boolean(jobId),
    // Generation SSE invalidates this query whenever the durable job snapshot changes.
    // Keep only a slow watchdog for item-level changes that do not move job progress.
    refetchInterval: (query) =>
      query.state.data &&
      query.state.data.items.some((item) => isActiveMediaExecutionStatus(item.executionStatus))
        ? 15_000
        : false,
  });
}

export function useGenerationJob(jobId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = generationQueryKeys.generationJob(jobId ?? "none");
  const query = useQuery({
    queryKey,
    queryFn: () => generationApi.getGenerationJob(jobId as string),
    enabled: Boolean(jobId),
    // SSE is the primary status transport. Keep a slow watchdog so a backend/network
    // interruption cannot leave the UI stale forever. Retry even before the first
    // snapshot so a transient initial GET failure can self-heal.
    refetchInterval: (current) =>
      jobId &&
      (!current.state.data || isActiveGenerationJobStatus(current.state.data.status))
        ? 15_000
        : false,
  });

  useEffect(() => {
    if (!jobId || !isActiveGenerationJobStatus(query.data?.status)) return;

    return subscribeSse(
      `/api/v1/generation-jobs/${encodeURIComponent(jobId)}/events`,
      "snapshot",
      {
        onEvent: (event) => {
          try {
            const snapshot = JSON.parse(event.data) as GenerationJob;
            if (!snapshot || snapshot.jobId !== jobId || typeof snapshot.status !== "string") return;
            queryClient.setQueryData(generationQueryKeys.generationJob(jobId), snapshot);
            void queryClient.invalidateQueries({
              queryKey: generationQueryKeys.mediaJob(jobId),
              exact: true,
            });
          } catch {
            void queryClient.invalidateQueries({
              queryKey: generationQueryKeys.generationJob(jobId),
            });
          }
        },
        onError: () => {
          // Electron main reconnects the authenticated stream automatically. The
          // watchdog GET above remains a bounded fallback while reconnecting.
        },
      },
    );
  }, [jobId, query.data?.status, queryClient]);

  return query;
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
