"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/shared/api/client";
import { ACTIVE_JOB_STATUSES, TERMINAL_JOB_STATUSES } from "@/types/api";
import { queryKeys } from "@/lib/query-keys";
import { mediaApi, type CreateMediaJobInput } from "../api/media.api";

export function useMediaGeneration(projectId: number, chapterId: number) {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
      setJobId(job.jobId);
      setMessage("Đã xếp hàng tạo keyframe. Bạn có thể theo dõi tiến độ bên dưới.");
      queryClient.setQueryData(queryKeys.job(job.jobId), job);
    },
    onError: (error) => setMessage(apiErrorMessage(error, "Không thể tạo media job.")),
  });
  const review = useMutation({
    mutationFn: ({ itemId, decision, rowVersion }: { itemId: string; decision: "APPROVED" | "REJECTED"; rowVersion: number }) => mediaApi.review(itemId, decision, rowVersion),
    onSuccess: () => {
      if (jobId) void queryClient.invalidateQueries({ queryKey: queryKeys.mediaJob(jobId) });
    },
    onError: (error) => setMessage(apiErrorMessage(error, "Không thể cập nhật review.")),
  });
  useEffect(() => {
    if (jobQuery.data?.status === "FAILED" || jobQuery.data?.status === "UNKNOWN") setMessage(jobQuery.data.errorCode ? `Media job ${jobQuery.data.errorCode}.` : `Media job ${jobQuery.data.status.toLowerCase()}.`);
  }, [jobQuery.data]);
  return { jobId, job: jobQuery.data ?? null, details: detailsQuery.data ?? null, isLoading: jobQuery.isPending || detailsQuery.isPending, message, createJob, review };
}
