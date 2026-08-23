"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/shared/api/client";
import { ACTIVE_JOB_STATUSES, TERMINAL_JOB_STATUSES, type ApiGenerationJob } from "@/types/api";
import { queryKeys } from "@/lib/query-keys";
import { mediaApi, type RenderChapterInput } from "@/features/generation/api/media.api";
import { useMediaGeneration } from "@/features/generation/hooks/useMediaGeneration";
import { artifactsApi } from "../api/artifacts.api";
import type { RenderArtifact } from "../api/artifacts.types";

interface UseChapterRenderOptions {
  projectId: number;
  chapterId: number;
  initialJobId?: string | null;
}

export function useChapterRender({
  projectId,
  chapterId,
  initialJobId = null,
}: UseChapterRenderOptions) {
  const queryClient = useQueryClient();
  const media = useMediaGeneration(projectId, chapterId);
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [lastInput, setLastInput] = useState<RenderChapterInput | null>(null);

  useEffect(() => {
    setJobId(initialJobId);
  }, [initialJobId]);

  const jobQuery = useQuery<ApiGenerationJob>({
    queryKey: jobId ? queryKeys.renderJob(jobId) : ["render-jobs", "none"],
    queryFn: () => mediaApi.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_JOB_STATUSES.has(status) ? false : 1500;
    },
  });

  const artifactQuery = useQuery<RenderArtifact>({
    queryKey: jobId ? queryKeys.artifactByJobId(jobId) : ["render-artifacts", "none"],
    queryFn: () => artifactsApi.getByJobId(jobId!),
    enabled: Boolean(jobId && jobQuery.data?.status === "COMPLETED"),
    retry: 2,
    refetchInterval: (query) => (query.state.data ? false : 1500),
  });

  const renderMutation = useMutation({
    mutationFn: (input: RenderChapterInput) =>
      mediaApi.render(projectId, chapterId, input, crypto.randomUUID()),
    onMutate: (input) => setLastInput(input),
    onSuccess: (job) => {
      setJobId(job.jobId);
      queryClient.setQueryData(queryKeys.renderJob(job.jobId), job);
      void queryClient.removeQueries({ queryKey: queryKeys.artifactByJobId(job.jobId) });
    },
  });

  const job = jobQuery.data ?? renderMutation.data ?? null;
  const error = renderMutation.error ?? jobQuery.error;
  const jobFailureMessage =
    job?.status === "FAILED"
      ? `Render thất bại${job.errorCode ? ` (${job.errorCode})` : "."}`
      : null;

  const renderChapter = (input: RenderChapterInput) => renderMutation.mutate(input);
  const retry = () => {
    if (lastInput) renderMutation.mutate(lastInput);
  };

  return {
    media,
    jobId,
    job,
    artifact: artifactQuery.data ?? null,
    isLoading: jobQuery.isPending || artifactQuery.isPending,
    isPending: renderMutation.isPending,
    isActive: Boolean(job?.status && ACTIVE_JOB_STATUSES.has(job.status)),
    errorMessage: error
      ? apiErrorMessage(error, "Không thể tải trạng thái render.")
      : jobFailureMessage,
    renderChapter,
    retry,
  };
}
