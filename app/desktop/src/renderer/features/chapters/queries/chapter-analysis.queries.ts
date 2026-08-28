import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AnalyzeChapterInput } from "@narrativex/client-contracts";
import {
  isActiveGenerationJobStatus,
  isTerminalGenerationJobStatus,
} from "../../generation/generation-status.ts";
import {
  generationQueryKeys,
  useAnalyzeChapter,
  useGenerationJob,
} from "../../generation/queries/generation.queries.ts";
import { deriveChapterAnalysisUiState } from "../model/chapter-analysis.ts";
import { chapterQueryKeys } from "./chapters.queries.ts";

export const chapterAnalysisQueryKeys = {
  workspace: (projectId: string, chapterId: string) =>
    chapterQueryKeys.workspace(projectId, chapterId),
  timeline: (projectId: string) => ["projects", projectId, "timeline"] as const,
  job: (jobId: string) => generationQueryKeys.generationJob(jobId),
};

export const chapterAnalysisShouldPoll = isActiveGenerationJobStatus;

type TrackedAnalysisJob = {
  jobId: string;
  chapterId: string;
};

type ChapterAnalysisJob = {
  jobId: string;
  status: string;
  errorCode: string | null;
};

export function useChapterAnalysis(
  projectId: string,
  chapterId: string | null,
  resumeJobId: string | null = null,
) {
  const queryClient = useQueryClient();
  const analyzeMutation = useAnalyzeChapter();
  const [trackedJob, setTrackedJob] = useState<TrackedAnalysisJob | null>(null);
  const [lastJob, setLastJob] = useState<ChapterAnalysisJob | null>(null);

  useEffect(() => {
    setTrackedJob((current) => (current?.chapterId === chapterId ? current : null));
    setLastJob(null);
  }, [chapterId, projectId]);

  useEffect(() => {
    if (!chapterId || !resumeJobId) return;
    setTrackedJob((current) =>
      current?.chapterId === chapterId && current.jobId === resumeJobId
        ? current
        : { jobId: resumeJobId, chapterId },
    );
  }, [chapterId, resumeJobId]);

  const jobQuery = useGenerationJob(trackedJob?.jobId ?? null);
  const polledJob = useMemo<ChapterAnalysisJob | null>(() => {
    if (!trackedJob || !jobQuery.data) return null;
    return {
      jobId: trackedJob.jobId,
      status: jobQuery.data.status,
      errorCode: jobQuery.data.errorCode ?? null,
    };
  }, [jobQuery.data, trackedJob]);

  useEffect(() => {
    if (!trackedJob || !polledJob || !isTerminalGenerationJobStatus(polledJob.status)) return;

    const completedJob = trackedJob;
    setLastJob(polledJob);
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: chapterAnalysisQueryKeys.workspace(projectId, completedJob.chapterId),
      }),
      queryClient.invalidateQueries({
        queryKey: chapterAnalysisQueryKeys.timeline(projectId),
      }),
    ]).finally(() => {
      setTrackedJob((current) => (current?.jobId === completedJob.jobId ? null : current));
    });
  }, [polledJob, projectId, queryClient, trackedJob]);

  const job = polledJob ?? lastJob;
  const uiState = deriveChapterAnalysisUiState(job, analyzeMutation.isPending);
  const connectionInterrupted = Boolean(trackedJob && jobQuery.isError && !jobQuery.data);

  async function analyze(preferences: AnalyzeChapterInput) {
    if (!chapterId) throw new Error("Chưa chọn chapter để phân tích.");
    setLastJob(null);
    const generationJob = await analyzeMutation.mutateAsync({
      projectId,
      chapterId,
      request: preferences,
    });
    setTrackedJob({ jobId: generationJob.jobId, chapterId });
    await queryClient.invalidateQueries({
      queryKey: chapterAnalysisQueryKeys.workspace(projectId, chapterId),
    });
    return generationJob;
  }

  return {
    analyze,
    job,
    trackedChapterId: trackedJob?.chapterId ?? null,
    isAnalyzing: Boolean(trackedJob) || uiState.isAnalyzing,
    isTerminal: uiState.isTerminal,
    canAnalyze: !trackedJob && uiState.canAnalyze,
    message: uiState.message,
    connectionInterrupted,
    error: analyzeMutation.error ?? jobQuery.error,
  };
}
