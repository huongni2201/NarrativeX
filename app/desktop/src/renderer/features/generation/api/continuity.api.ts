import type {
  ChapterContinuityReport,
  ContinuityReviewInput,
  CreateRegenerationJobInput,
  CreateRegenerationPlanInput,
  GenerationJob,
  RegenerationPlan,
} from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client.ts";

function chapterPath(projectId: string, chapterId: string) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}`;
}

export const continuityApi = {
  get: (projectId: string, chapterId: string) =>
    apiRequest<ChapterContinuityReport>(`${chapterPath(projectId, chapterId)}/continuity`),

  createRegenerationPlan: (
    projectId: string,
    chapterId: string,
    input: CreateRegenerationPlanInput,
  ) =>
    apiRequest<RegenerationPlan>(`${chapterPath(projectId, chapterId)}/regeneration-plans`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  createRegenerationJob: (
    projectId: string,
    chapterId: string,
    input: CreateRegenerationJobInput,
    idempotencyKey: string,
  ) =>
    apiRequest<GenerationJob>(`${chapterPath(projectId, chapterId)}/regeneration-jobs`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    }),

  review: (projectId: string, chapterId: string, input: ContinuityReviewInput) =>
    apiRequest<ChapterContinuityReport>(`${chapterPath(projectId, chapterId)}/continuity-reviews`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
