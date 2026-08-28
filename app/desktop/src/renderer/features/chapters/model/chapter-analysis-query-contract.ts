import { isActiveGenerationJobStatus } from "../../generation/generation-status.ts";

export const chapterAnalysisQueryKeys = {
  workspace: (projectId: string, chapterId: string) =>
    ["projects", projectId, "chapters", chapterId, "workspace"] as const,
  timeline: (projectId: string) => ["projects", projectId, "timeline"] as const,
  job: (jobId: string) => ["generation", "generation-job", jobId] as const,
};

export const chapterAnalysisShouldPoll = isActiveGenerationJobStatus;
