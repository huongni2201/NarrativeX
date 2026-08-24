"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/shared/api/client";
import {
  ACTIVE_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  type ApiChapterWorkspace,
  type ApiChapterWorkspaceProgressStep,
  type ChapterId,
  type ProjectId,
} from "@/types/api";
import { queryKeys } from "@/lib/query-keys";
import { mediaApi, type CreateMediaJobInput } from "../api/media.api";

type InitialMediaIdentity = Pick<
  ApiChapterWorkspaceProgressStep,
  "latestJobId" | "mediaPlanId" | "mediaPlanRevision"
>;

export function useMediaGeneration(
  projectId: ProjectId,
  chapterId: ChapterId,
  initialMedia: InitialMediaIdentity,
) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const createJob = useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateMediaJobInput; idempotencyKey: string }) =>
      mediaApi.createJob(projectId, chapterId, input, idempotencyKey),
    onSuccess: (job) => {
      setMessage("Đã xếp hàng tạo keyframe. Bạn có thể theo dõi tiến độ bên dưới.");
      queryClient.setQueryData(queryKeys.job(job.jobId), job);
      queryClient.setQueryData<ApiChapterWorkspace>(
        queryKeys.chapterWorkspace(projectId, chapterId),
        (current) =>
          current
            ? {
                ...current,
                pipeline: {
                  ...current.pipeline,
                  visualGeneration: {
                    ...current.pipeline.visualGeneration,
                    status: job.status,
                    latestJobId: job.jobId,
                    mediaPlanId: job.mediaPlanId ?? null,
                    mediaPlanRevision: job.mediaPlanRevision ?? null,
                  },
                },
              }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chapterWorkspace(projectId, chapterId),
      });
    },
    onError: (error) => {
      setMessage(apiErrorMessage(error, "Không thể tạo media job."));
    },
  });

  const createdJob = createJob.data ?? null;
  const resetCreateJob = createJob.reset;
  const workspaceHasCreatedJob = Boolean(
    createdJob && initialMedia.latestJobId === createdJob.jobId,
  );
  const jobId = initialMedia.latestJobId ?? createdJob?.jobId ?? null;

  useEffect(() => {
    if (workspaceHasCreatedJob) resetCreateJob();
  }, [workspaceHasCreatedJob, resetCreateJob]);

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
    refetchInterval:
      jobQuery.data?.status && ACTIVE_JOB_STATUSES.has(jobQuery.data.status) ? 1500 : false,
  });

  const review = useMutation({
    mutationFn: ({
      itemId,
      decision,
      rowVersion,
    }: {
      itemId: string;
      decision: "APPROVED" | "REJECTED";
      rowVersion: number;
    }) => mediaApi.review(itemId, decision, rowVersion),
    onSuccess: () => {
      if (jobId) void queryClient.invalidateQueries({ queryKey: queryKeys.mediaJob(jobId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chapterWorkspace(projectId, chapterId),
      });
    },
    onError: (error) => {
      setMessage(apiErrorMessage(error, "Không thể cập nhật review."));
    },
  });

  const job = jobQuery.data ?? (workspaceHasCreatedJob ? null : createdJob);
  useEffect(() => {
    if (job?.status === "FAILED" || job?.status === "UNKNOWN") {
      setMessage(
        job.errorCode
          ? `Media job ${job.errorCode}.`
          : `Media job ${job.status.toLowerCase()}.`,
      );
    }
  }, [job?.errorCode, job?.status]);

  const mediaPlanId =
    detailsQuery.data?.mediaPlanId ?? job?.mediaPlanId ?? initialMedia.mediaPlanId;
  const mediaPlanRevision =
    detailsQuery.data?.mediaPlanRevision ??
    job?.mediaPlanRevision ??
    initialMedia.mediaPlanRevision;

  return {
    jobId,
    job: job ?? null,
    details: detailsQuery.data ?? null,
    mediaPlanId,
    mediaPlanRevision,
    isLoading: Boolean(jobId) && (jobQuery.isPending || detailsQuery.isPending),
    message,
    createJob,
    review,
  };
}
