"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/shared/api/client";
import { ACTIVE_JOB_STATUSES, TERMINAL_JOB_STATUSES, type ApiGenerationJob } from "@/types/api";
import { queryKeys } from "@/lib/query-keys";
import { mediaApi, type CreateMediaJobInput } from "../api/media.api";

interface TrackedMediaJob extends ApiGenerationJob {
  message: string | null;
}

export function useMediaGeneration(projectId: number, chapterId: number) {
  const queryClient = useQueryClient();
  const currentJobQuery = useQuery<TrackedMediaJob | null>({
    queryKey: queryKeys.mediaJobForChapter(projectId, chapterId),
    queryFn: async () => null,
    enabled: false,
  });
  const jobId = currentJobQuery.data?.jobId ?? null;
  const message = currentJobQuery.data?.message ?? null;
  const jobQuery = useQuery({
    queryKey: jobId ? queryKeys.job(jobId) : ["jobs", "media-none"],
    queryFn: () => mediaApi.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_JOB_STATUSES.has(status) ? false : 1500;
    },
  });
  const detailsQuery = useQuery({
    queryKey: jobId ? queryKeys.mediaJob(jobId) : ["media-jobs", "none"],
    queryFn: () => mediaApi.getDetails(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: jobQuery.data?.status && ACTIVE_JOB_STATUSES.has(jobQuery.data.status) ? 1500 : false,
  });
  const createJob = useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateMediaJobInput; idempotencyKey: string }) => mediaApi.createJob(projectId, chapterId, input, idempotencyKey),
    onSuccess: (job) => {
      queryClient.setQueryData(queryKeys.mediaJobForChapter(projectId, chapterId), {
        ...job,
        message: "Đã xếp hàng tạo keyframe. Bạn có thể theo dõi tiến độ bên dưới.",
      });
      queryClient.setQueryData(queryKeys.job(job.jobId), job);
    },
    onError: (error) => {
      queryClient.setQueryData(queryKeys.mediaJobForChapter(projectId, chapterId), (current: TrackedMediaJob | null | undefined) =>
        current ? { ...current, message: apiErrorMessage(error, "Không thể tạo media job.") } : null,
      );
    },
  });
  const review = useMutation({
    mutationFn: ({ itemId, decision, rowVersion }: { itemId: string; decision: "APPROVED" | "REJECTED"; rowVersion: number }) => mediaApi.review(itemId, decision, rowVersion),
    onSuccess: () => {
      if (jobId) void queryClient.invalidateQueries({ queryKey: queryKeys.mediaJob(jobId) });
    },
    onError: (error) => {
      queryClient.setQueryData(queryKeys.mediaJobForChapter(projectId, chapterId), (current: TrackedMediaJob | null | undefined) =>
        current ? { ...current, message: apiErrorMessage(error, "Không thể cập nhật review.") } : null,
      );
    },
  });
  useEffect(() => {
    const currentJob = jobQuery.data;
    if (currentJob?.status === "FAILED" || currentJob?.status === "UNKNOWN") {
      queryClient.setQueryData(queryKeys.mediaJobForChapter(projectId, chapterId), (current: TrackedMediaJob | null | undefined) =>
        current
          ? {
              ...current,
              message: currentJob.errorCode
                ? `Media job ${currentJob.errorCode}.`
                : `Media job ${currentJob.status.toLowerCase()}.`,
            }
          : null,
      );
    }
  }, [chapterId, jobQuery.data, projectId, queryClient]);
  return { jobId, job: jobQuery.data ?? null, details: detailsQuery.data ?? null, isLoading: jobQuery.isPending || detailsQuery.isPending, message, createJob, review };
}
