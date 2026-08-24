"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError, apiErrorMessage } from "@/shared/api/client";
import {
  TERMINAL_JOB_STATUSES,
  type ApiChapterWorkspaceProgressStep,
  type ApiGenerationJob,
  type ChapterId,
  type ProjectId,
} from "@/types/api";
import { queryKeys } from "@/lib/query-keys";
import { mediaApi, type RenderChapterInput } from "@/features/generation/api/media.api";
import { useMediaGeneration } from "@/features/generation/hooks/useMediaGeneration";
import { artifactsApi } from "../api/artifacts.api";
import type { RenderArtifact } from "../api/artifacts.types";

export const CHAPTER_RENDER_STATUSES = [
  "IDLE",
  "SUBMITTING",
  "QUEUED",
  "RUNNING",
  "STALLED",
  "COMPLETED",
  "RESOLVING_ARTIFACT",
  "READY",
  "FAILED",
] as const;

export type ChapterRenderStatus = (typeof CHAPTER_RENDER_STATUSES)[number];

type RenderConfig = Pick<RenderChapterInput, "resolution" | "format" | "maxAuthorizedCost">;

interface UseChapterRenderOptions {
  projectId: ProjectId;
  chapterId: ChapterId;
  initialMedia: ApiChapterWorkspaceProgressStep;
  resolution?: RenderConfig["resolution"];
  format?: RenderConfig["format"];
  maxAuthorizedCost?: RenderConfig["maxAuthorizedCost"];
  initialJobId?: string | null;
  initialRenderStatus?: string | null;
  initialArtifactId?: number | null;
}

type RenderOverrides = Partial<RenderConfig>;

export interface UseChapterRenderResult {
  render: (overrides?: RenderOverrides) => void;
  job: ApiGenerationJob | null;
  artifact: RenderArtifact | null;
  status: ChapterRenderStatus;
  progress: number;
  error: string | null;
  canRender: boolean;
  retry: () => void;
  mediaMessage: string | null;
}

const DEFAULT_RENDER_CONFIG: RenderConfig = {
  resolution: "1080p",
  format: "mp4",
  maxAuthorizedCost: "0.500000",
};

export function useChapterRender({
  projectId,
  chapterId,
  initialMedia,
  initialJobId = null,
  initialRenderStatus = null,
  initialArtifactId = null,
  resolution = DEFAULT_RENDER_CONFIG.resolution,
  format = DEFAULT_RENDER_CONFIG.format,
  maxAuthorizedCost = DEFAULT_RENDER_CONFIG.maxAuthorizedCost,
}: UseChapterRenderOptions): UseChapterRenderResult {
  const queryClient = useQueryClient();
  const media = useMediaGeneration(projectId, chapterId, initialMedia);
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [artifactId, setArtifactId] = useState<number | null>(initialArtifactId);
  const [submittedJob, setSubmittedJob] = useState<ApiGenerationJob | null>(null);
  const [lastInput, setLastInput] = useState<RenderChapterInput | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setJobId(initialJobId);
    setArtifactId(initialArtifactId);
    setSubmittedJob(null);
    idempotencyKeyRef.current = null;
  }, [chapterId, initialArtifactId, initialJobId, projectId]);

  const jobQuery = useQuery<ApiGenerationJob>({
    queryKey: jobId ? queryKeys.renderJob(jobId) : ["render-jobs", "none"],
    queryFn: () => mediaApi.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status;
      return currentStatus && TERMINAL_JOB_STATUSES.has(currentStatus) ? false : 1500;
    },
  });

  const artifactQuery = useQuery<RenderArtifact>({
    queryKey: artifactId
      ? queryKeys.artifact(artifactId)
      : jobId
        ? queryKeys.artifactByJobId(jobId)
        : ["render-artifacts", "none"],
    queryFn: () =>
      artifactId ? artifactsApi.getById(artifactId) : artifactsApi.getByJobId(jobId!),
    enabled: Boolean(artifactId || (jobId && jobQuery.data?.status === "COMPLETED")),
    retry: 2,
    refetchInterval: (query) => (query.state.data || query.state.error ? false : 1500),
  });

  const renderMutation = useMutation({
    mutationFn: ({ input, idempotencyKey }: RenderMutationVariables) =>
      mediaApi.render(projectId, chapterId, input, idempotencyKey),
    onMutate: ({ input }) => {
      setLastInput(input);
      setJobId(null);
      setArtifactId(null);
      setSubmittedJob(null);
    },
    onError: (error) => {
      if (isDefinitiveRenderRequestFailure(error)) idempotencyKeyRef.current = null;
    },
    onSuccess: (nextJob) => {
      setJobId(nextJob.jobId);
      setSubmittedJob(nextJob);
      queryClient.setQueryData(queryKeys.renderJob(nextJob.jobId), nextJob);
      void queryClient.removeQueries({ queryKey: queryKeys.artifactByJobId(nextJob.jobId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chapterWorkspace(projectId, chapterId),
      });
    },
  });

  const job = jobQuery.data ?? submittedJob;
  const artifact = artifactQuery.data ?? null;

  useEffect(() => {
    if (job?.status === "FAILED" || job?.status === "CANCELED") {
      idempotencyKeyRef.current = null;
    }
  }, [job?.status]);

  const artifactResolutionFailed = Boolean(job?.status === "COMPLETED" && artifactQuery.error);
  const artifactResolving = Boolean(
    job?.status === "COMPLETED" &&
      !artifact &&
      (artifactQuery.isPending || artifactQuery.isFetching),
  );
  const status = getChapterRenderStatus({
    mutationPending: renderMutation.isPending,
    mutationFailed: renderMutation.isError,
    job,
    artifact,
    artifactResolving,
    artifactResolutionFailed,
    initialRenderStatus,
    hasArtifactIdentity: Boolean(artifactId),
  });

  const mediaPlanId = media.mediaPlanId;
  const mediaPlanRevision = media.mediaPlanRevision;
  const hasApprovedMedia = Boolean(
    media.details &&
      media.details.totalItems > 0 &&
      media.details.readyItems === media.details.totalItems &&
      media.details.reviewItems === 0,
  );
  const renderInFlight =
    status === "SUBMITTING" ||
    status === "QUEUED" ||
    status === "RUNNING" ||
    status === "STALLED" ||
    status === "COMPLETED" ||
    status === "RESOLVING_ARTIFACT";
  const canRender =
    hasApprovedMedia &&
    typeof mediaPlanId === "string" &&
    typeof mediaPlanRevision === "number" &&
    !renderInFlight;

  const render = useCallback(
    (overrides: RenderOverrides = {}) => {
      if (!canRender || !mediaPlanId || mediaPlanRevision === null) return;
      const input = {
        mediaPlanId,
        mediaPlanRevision,
        resolution: overrides.resolution ?? resolution,
        format: overrides.format ?? format,
        maxAuthorizedCost: overrides.maxAuthorizedCost ?? maxAuthorizedCost,
      } satisfies RenderChapterInput;
      renderMutation.mutate({
        input,
        idempotencyKey: startNewRenderIntent(idempotencyKeyRef),
      });
    },
    [
      canRender,
      format,
      maxAuthorizedCost,
      mediaPlanId,
      mediaPlanRevision,
      renderMutation,
      resolution,
    ],
  );

  const retry = useCallback(() => {
    if (!lastInput || renderMutation.isPending) return;
    if (
      job?.status === "FAILED" ||
      job?.status === "CANCELED" ||
      isDefinitiveRenderRequestFailure(renderMutation.error)
    ) {
      idempotencyKeyRef.current = null;
    }
    renderMutation.mutate({
      input: lastInput,
      idempotencyKey: ensureRenderIntentKey(idempotencyKeyRef),
    });
  }, [job?.status, lastInput, renderMutation]);

  const error = getChapterRenderError({
    mutationError: renderMutation.error,
    jobQueryError: jobQuery.error,
    artifactQueryError: artifactResolutionFailed ? artifactQuery.error : null,
    job,
  });
  const progress =
    status === "READY" || status === "COMPLETED" ? 100 : clampProgress(job?.progress ?? 0);

  return {
    render,
    job,
    artifact,
    status,
    progress,
    error,
    canRender,
    retry,
    mediaMessage: media.message,
  };
}

interface RenderMutationVariables {
  input: RenderChapterInput;
  idempotencyKey: string;
}

export function isDefinitiveRenderRequestFailure(error: unknown) {
  return error instanceof ApiClientError && error.status >= 400 && error.status < 500;
}

function ensureRenderIntentKey(ref: { current: string | null }) {
  return (ref.current ??= crypto.randomUUID());
}

function startNewRenderIntent(ref: { current: string | null }) {
  ref.current = crypto.randomUUID();
  return ref.current;
}

interface ChapterRenderStatusInput {
  mutationPending: boolean;
  mutationFailed: boolean;
  job: ApiGenerationJob | null;
  artifact: RenderArtifact | null;
  artifactResolving: boolean;
  artifactResolutionFailed: boolean;
  initialRenderStatus: string | null;
  hasArtifactIdentity: boolean;
}

export function getChapterRenderStatus({
  mutationPending,
  mutationFailed,
  job,
  artifact,
  artifactResolving,
  artifactResolutionFailed,
  initialRenderStatus,
  hasArtifactIdentity,
}: ChapterRenderStatusInput): ChapterRenderStatus {
  if (mutationPending) return "SUBMITTING";
  if (mutationFailed || artifactResolutionFailed) return "FAILED";
  if (!job) {
    if (hasArtifactIdentity && initialRenderStatus === "READY" && artifactResolving) {
      return "RESOLVING_ARTIFACT";
    }
    if (hasArtifactIdentity && initialRenderStatus === "READY" && artifact) return "READY";
    return mapWorkspaceRenderStatus(initialRenderStatus);
  }

  switch (job.status) {
    case "QUEUED":
      return "QUEUED";
    case "RUNNING":
      return "RUNNING";
    case "STALLED":
    case "UNKNOWN":
    case "PAUSED_COST_LIMIT":
      return "STALLED";
    case "COMPLETED":
      if (artifact) return "READY";
      return artifactResolving ? "RESOLVING_ARTIFACT" : "COMPLETED";
    case "FAILED":
    case "CANCELED":
      return "FAILED";
    default:
      return "FAILED";
  }
}

function mapWorkspaceRenderStatus(status: string | null): ChapterRenderStatus {
  if (status === "COMPLETED" || status === "READY") return "RESOLVING_ARTIFACT";
  if (status === "PROCESSING" || status === "RUNNING" || status === "QUEUED") {
    return "RUNNING";
  }
  if (status === "FAILED") return "FAILED";
  return "IDLE";
}

interface ChapterRenderErrorInput {
  mutationError: unknown;
  jobQueryError: unknown;
  artifactQueryError: unknown;
  job: ApiGenerationJob | null;
}

function getChapterRenderError({
  mutationError,
  jobQueryError,
  artifactQueryError,
  job,
}: ChapterRenderErrorInput): string | null {
  if (mutationError) return apiErrorMessage(mutationError, "Không thể gửi render job.");
  if (artifactQueryError) {
    return apiErrorMessage(artifactQueryError, "Không thể tải render artifact.");
  }
  if (jobQueryError && !job) {
    return apiErrorMessage(jobQueryError, "Không thể tải trạng thái render.");
  }
  if (job?.status === "FAILED" || job?.status === "CANCELED") {
    return `Render thất bại${job.errorCode ? ` (${job.errorCode})` : "."}`;
  }
  return null;
}

function clampProgress(progress: number) {
  return Math.min(100, Math.max(0, progress));
}
