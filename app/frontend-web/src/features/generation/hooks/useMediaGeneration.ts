"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { useGenerationEventsStatus } from "../components/GenerationEventsProvider";

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
  const { connected: generationEventsConnected } = useGenerationEventsStatus();
  const scope = `${projectId}:${chapterId}`;
  const previousScope = useRef(scope);

  const createJob = useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateMediaJobInput; idempotencyKey: string }) =>
      mediaApi.createJob(projectId, chapterId, input, idempotencyKey),
    onSuccess: (job) => {
      setMessage("Đã xếp hàng tạo keyframe. Bạn có thể theo dõi tiến độ bên dưới.");
      toast.success("Đã bắt đầu tạo hình ảnh", {
        description: "Keyframe đang được xử lý. Bạn có thể theo dõi tiến độ trong tab Visuals.",
      });
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
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    createJob.reset();
    setMessage(null);
  }, [createJob, scope]);

  // Keep the mutation result authoritative until the job query has observed it.
  // The workspace refetch can race this query and otherwise make the progress card disappear.
  const jobId = createdJob?.jobId ?? initialMedia.latestJobId ?? null;

  const jobQuery = useQuery({
    queryKey: jobId ? queryKeys.job(jobId) : ["jobs", "media-none"],
    queryFn: () => mediaApi.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_JOB_STATUSES.has(status)
        ? false
        : generationEventsConnected
          ? false
          : 10000;
    },
  });

  const detailsQuery = useQuery({
    queryKey: jobId ? queryKeys.mediaJob(jobId) : ["media-jobs", "none"],
    queryFn: () => mediaApi.getDetails(jobId!),
    enabled: Boolean(jobId),
    refetchInterval:
      jobQuery.data?.status && ACTIVE_JOB_STATUSES.has(jobQuery.data.status)
        ? generationEventsConnected
          ? false
          : 10000
        : false,
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

  const job = jobQuery.data ?? createdJob;
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
