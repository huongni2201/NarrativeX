import { useEffect, useRef } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ChapterProductionStatus,
  GenerationStrategy,
} from "../../../../shared/api-types";
import {
  type GenerateShotTakeInput,
  type SelectTakeInput,
  type ReplaceShotAudioCueAllocationsInput,
  videoProductionApi,
} from "../api/video-production.api";
import { DesktopApiError } from "../../../api/client.ts";

import {
  videoProductionQueryKeys,
  refreshProduction,
  productionPollInterval,
  shouldRefetchProduction,
} from "./production-cache.ts";
import { isProjectSseActive } from "../../generation/realtime/project-event-subscription.ts";
export { videoProductionQueryKeys } from "./production-cache.ts";

interface PendingShotAttempt {
  idempotencyKey: string;
  input: Omit<GenerateShotTakeInput, "idempotencyKey">;
}

const pendingShotAttemptKey = (projectId: string, shotId: string) =>
  `narrativex:pending-shot-attempt:v1:${projectId}:${shotId}`;

export function hasPendingShotAttempt(projectId: string, shotId: string): boolean {
  try {
    return typeof window === "undefined"
      ? true
      : window.localStorage.getItem(pendingShotAttemptKey(projectId, shotId)) !== null;
  } catch {
    return true;
  }
}

function readPendingShotAttempt(projectId: string, shotId: string): PendingShotAttempt | null {
  if (typeof window === "undefined") {
    throw new Error("Shot attempt recovery is only available in Electron Desktop.");
  }
  const storageKey = pendingShotAttemptKey(projectId, shotId);
  const raw = window.localStorage.getItem(storageKey);
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof value.idempotencyKey !== "string" ||
      !value.input ||
      typeof value.input !== "object" ||
      Array.isArray(value.input)
    ) {
      throw new Error("Saved shot attempt recovery data is invalid.");
    }
    return {
      idempotencyKey: value.idempotencyKey,
      input: value.input as PendingShotAttempt["input"],
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Saved shot attempt recovery data is invalid.") {
      throw error;
    }
    throw new Error("Saved shot attempt recovery data cannot be read.");
  }
}

function savePendingShotAttempt(
  projectId: string,
  shotId: string,
  intent: PendingShotAttempt,
): void {
  if (typeof window === "undefined") {
    throw new Error("Shot attempt recovery is only available in Electron Desktop.");
  }
  window.localStorage.setItem(pendingShotAttemptKey(projectId, shotId), JSON.stringify(intent));
}

function clearPendingShotAttempt(projectId: string, shotId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(pendingShotAttemptKey(projectId, shotId));
}

export function useChapterProductionStatus(projectId: string, chapterId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery(queryOptions({
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

  // The full production view is not polled; it is refreshed only when the status signature moves.
  const lastStatus = useRef<ChapterProductionStatus | undefined>(undefined);
  useEffect(() => {
    const next = query.data;
    if (!next) return;
    if (shouldRefetchProduction(lastStatus.current, next)) {
      void queryClient.invalidateQueries({
        queryKey: videoProductionQueryKeys.chapterProduction(projectId, next.chapterId),
      });
    }
    lastStatus.current = next;
  }, [query.data, projectId, queryClient]);

  return query;
}

export function useChapterProduction(projectId: string, chapterId: string | null) {
  // Not polled: useChapterProductionStatus invalidates this query when
  // `productionSignature` changes, and refreshProduction covers mutations and terminal SSE events.
  return useQuery(queryOptions({
    queryKey: videoProductionQueryKeys.chapterProduction(projectId, chapterId ?? ""),
    queryFn: () => {
      if (!chapterId) throw new Error("Chưa chọn chapter.");
      return videoProductionApi.getProduction(projectId, chapterId);
    },
    enabled: Boolean(projectId && chapterId),
  }));
}

export function useGenerateShot(projectId: string, chapterId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      shotId: string;
      input?: GenerateShotTakeInput;
      reconcile?: boolean;
    }) => {
      let intent = readPendingShotAttempt(projectId, variables.shotId);
      if (variables.reconcile) {
        if (!intent) throw new Error("No pending Shot request needs reconciliation.");
      } else {
        if (intent) {
          throw new Error("A previous Shot request is unresolved. Reconcile it before starting another.");
        }
        const { idempotencyKey, ...input } = variables.input ?? {};
        intent = { idempotencyKey: idempotencyKey ?? crypto.randomUUID(), input };
        savePendingShotAttempt(projectId, variables.shotId, intent);
      }

      try {
        const result = await videoProductionApi.generateTake(projectId, variables.shotId, {
          ...intent.input,
          idempotencyKey: intent.idempotencyKey,
        });
        clearPendingShotAttempt(projectId, variables.shotId);
        return result;
      } catch (error) {
        if (error instanceof DesktopApiError && error.status < 500) {
          clearPendingShotAttempt(projectId, variables.shotId);
        }
        throw error;
      }
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

export function useShotAudioCueAllocations(projectId: string, sequenceId: string | null) {
  return useQuery({
    queryKey: videoProductionQueryKeys.shotAudioCueAllocations(projectId, sequenceId ?? ""),
    queryFn: () => {
      if (!sequenceId) throw new Error("Chưa chọn ShotSequence.");
      return videoProductionApi.getShotAudioCueAllocations(projectId, sequenceId);
    },
    enabled: Boolean(projectId && sequenceId),
  });
}

export function useReplaceShotAudioCueAllocations(
  projectId: string,
  sequenceId: string,
  chapterId?: string | null,
) {
  const queryClient = useQueryClient();
  const queryKey = videoProductionQueryKeys.shotAudioCueAllocations(projectId, sequenceId);
  return useMutation({
    mutationFn: (input: ReplaceShotAudioCueAllocationsInput) =>
      videoProductionApi.replaceShotAudioCueAllocations(projectId, sequenceId, input),
    onSuccess: (allocationSet) => {
      queryClient.setQueryData(queryKey, allocationSet);
      void refreshProduction(queryClient, projectId, chapterId);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
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
