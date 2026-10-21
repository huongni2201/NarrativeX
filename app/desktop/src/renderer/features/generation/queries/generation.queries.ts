import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalyzeChapterInput,
  CreateMediaJobInput,
  CreateVisualBeatImageAttemptInput,
  GenerationJob,
  MediaReviewInput,
} from "../../../../shared/api-types";
import { subscribeSse } from "../../../api/sse.ts";
import { generationApi } from "../api/generation.api.ts";
import { DesktopApiError } from "../../../api/client.ts";
import {
  generationJobPollInterval,
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
  visualBeatImageAttempts: (projectId: string, chapterId: string, visualBeatId: string) =>
    [...generationQueryKeys.all, "visual-beat-image-attempts", projectId, chapterId, visualBeatId] as const,
};

interface PendingImageAttempt {
  idempotencyKey: string;
  input: CreateVisualBeatImageAttemptInput;
}

const pendingImageAttemptKey = (projectId: string, visualBeatId: string) =>
  `narrativex:pending-image-attempt:v1:${projectId}:${visualBeatId}`;

export function hasPendingVisualBeatImageAttempt(projectId: string, visualBeatId: string): boolean {
  try {
    return typeof window === "undefined"
      ? true
      : window.localStorage.getItem(pendingImageAttemptKey(projectId, visualBeatId)) !== null;
  } catch {
    return true;
  }
}

function readPendingImageAttempt(projectId: string, visualBeatId: string): PendingImageAttempt | null {
  if (typeof window === "undefined") {
    throw new Error("Image attempt recovery is only available in Electron Desktop.");
  }
  const raw = window.localStorage.getItem(pendingImageAttemptKey(projectId, visualBeatId));
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof value.idempotencyKey !== "string" ||
      !value.input ||
      typeof value.input !== "object" ||
      Array.isArray(value.input)
    ) {
      throw new Error("Saved image attempt recovery data is invalid.");
    }
    return {
      idempotencyKey: value.idempotencyKey,
      input: value.input as CreateVisualBeatImageAttemptInput,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Saved image attempt recovery data is invalid.") {
      throw error;
    }
    throw new Error("Saved image attempt recovery data cannot be read.");
  }
}

function savePendingImageAttempt(
  projectId: string,
  visualBeatId: string,
  pending: PendingImageAttempt,
) {
  if (typeof window === "undefined") {
    throw new Error("Image attempt recovery is only available in Electron Desktop.");
  }
  window.localStorage.setItem(
    pendingImageAttemptKey(projectId, visualBeatId),
    JSON.stringify(pending),
  );
}

function clearPendingImageAttempt(projectId: string, visualBeatId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(pendingImageAttemptKey(projectId, visualBeatId));
}

export function useAnalyzeChapter() {
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      chapterId: string;
      request: AnalyzeChapterInput;
      idempotencyKey: string;
    }) =>
      generationApi.analyze(
        input.projectId,
        input.chapterId,
        input.request,
        input.idempotencyKey,
      ),
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

export function useCreateVisualBeatImageAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: {
      projectId: string;
      chapterId: string;
      visualBeatId: string;
      input?: CreateVisualBeatImageAttemptInput;
      reconcile?: boolean;
    }) => {
      let intent = readPendingImageAttempt(variables.projectId, variables.visualBeatId);
      if (variables.reconcile) {
        if (!intent) throw new Error("No pending image request needs reconciliation.");
      } else {
        if (intent) {
          throw new Error("A previous image request is unresolved. Reconcile it before starting another.");
        }
        intent = {
          idempotencyKey: crypto.randomUUID(),
          input: variables.input ?? {},
        };
        savePendingImageAttempt(variables.projectId, variables.visualBeatId, intent);
      }
      try {
        const result = await generationApi.createVisualBeatImageAttempt(
          variables.projectId,
          variables.chapterId,
          variables.visualBeatId,
          intent.input,
          intent.idempotencyKey,
        );
        clearPendingImageAttempt(variables.projectId, variables.visualBeatId);
        return result;
      } catch (error) {
        if (error instanceof DesktopApiError && error.status < 500) {
          clearPendingImageAttempt(variables.projectId, variables.visualBeatId);
        }
        throw error;
      }
    },
    onSettled: (_result, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: generationQueryKeys.visualBeatImageAttempts(
          variables.projectId,
          variables.chapterId,
          variables.visualBeatId,
        ),
      });
      void queryClient.invalidateQueries({
        queryKey: generationQueryKeys.currentMediaJob(variables.projectId, variables.chapterId),
      });
    },
  });
}

export function useVisualBeatImageAttempts(
  projectId: string,
  chapterId: string | null,
  visualBeatId: string,
) {
  return useQuery({
    queryKey: generationQueryKeys.visualBeatImageAttempts(projectId, chapterId ?? "", visualBeatId),
    queryFn: () => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      return generationApi.getVisualBeatImageAttempts(projectId, chapterId, visualBeatId);
    },
    enabled: Boolean(projectId && chapterId && visualBeatId),
    refetchInterval: (query) =>
      query.state.data?.some((attempt) =>
        ["QUEUED", "RUNNING", "VALIDATING"].includes(attempt.executionStatus),
      )
        ? 3_000
        : false,
  });
}

export function useReviewVisualBeatImageAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      chapterId: string;
      visualBeatId: string;
      itemId: string;
      decision: "APPROVED" | "REJECTED";
      rowVersion: number;
    }) =>
      generationApi.reviewVisualBeatImageAttempt(
        input.projectId,
        input.chapterId,
        input.visualBeatId,
        input.itemId,
        { decision: input.decision, rowVersion: input.rowVersion },
      ),
    onSettled: (_result, _error, input) =>
      queryClient.invalidateQueries({
        queryKey: generationQueryKeys.visualBeatImageAttempts(
          input.projectId,
          input.chapterId,
          input.visualBeatId,
        ),
      }),
  });
}

export function useSelectVisualBeatImageAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      chapterId: string;
      visualBeatId: string;
      itemId: string;
      expectedVisualBeatRowVersion: number;
    }) =>
      generationApi.selectVisualBeatImageAttempt(
        input.projectId,
        input.chapterId,
        input.visualBeatId,
        input.itemId,
        input.expectedVisualBeatRowVersion,
      ),
    onSettled: (_result, _error, input) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: generationQueryKeys.visualBeatImageAttempts(
            input.projectId,
            input.chapterId,
            input.visualBeatId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: ["projects", input.projectId, "chapters", input.chapterId, "storyboard"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["video-production", "chapter", input.projectId, input.chapterId, "production"],
        }),
      ]),
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
    retry: false,
    refetchInterval: (current) =>
      jobId
        ? generationJobPollInterval(current.state.status, current.state.data?.status)
        : false,
  });

  useEffect(() => {
    if (query.data && !isActiveGenerationJobStatus(query.data.status)) return;
    if (!jobId) return;

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
          // Electron main reconnects the authenticated stream automatically.
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
