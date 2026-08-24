import { apiRequest } from "@/shared/api/client";
import type { ApiGenerationJob, ProjectId } from "@/types/api";
import { isApiGenerationJob } from "@/types/api";

export interface ProductionTimelineChapter {
  chapterId: string;
  orderIndex: number;
  title: string;
  startMs: number;
  endMs: number;
  audioDurationMs: number | null;
  beatCount: number;
  readyBeatCount: number;
  audioReady: boolean;
  readyForRender: boolean;
}

export interface ProductionTimelineBeat {
  chapterId: string;
  chapterOrderIndex: number;
  sceneIndex: number;
  beatIndex: number;
  visualBeatId: string;
  title: string;
  visualIntent: string;
  cameraMovement: string;
  assetStrategy: string;
  mediaAssetId: string | null;
  startMs: number;
  endMs: number;
  durationMs: number;
  assetReady: boolean;
}

export interface ProductionTimeline {
  projectId: string;
  storyVersionId: string;
  totalDurationMs: number;
  aspectRatio: string;
  readyForRender: boolean;
  chapters: ProductionTimelineChapter[];
  beats: ProductionTimelineBeat[];
}

export interface ProjectRenderBeatOverrideInput {
  visualBeatId: string;
  durationMs?: number | null;
  cameraMovement?: string | null;
}

export interface CreateProjectRenderInput {
  resolution: "720p" | "1080p";
  format: "mp4";
  maxAuthorizedCost?: string;
  beatOverrides?: ProjectRenderBeatOverrideInput[];
}

export interface ProjectRenderArtifact {
  id: string;
  projectId: string;
  generationJobId: string;
  webViewLink: string | null;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isProductionChapter(value: unknown): value is ProductionTimelineChapter {
  if (!isRecord(value)) return false;
  return (
    typeof value.chapterId === "string" &&
    typeof value.orderIndex === "number" &&
    typeof value.title === "string" &&
    typeof value.startMs === "number" &&
    typeof value.endMs === "number" &&
    isNullableNumber(value.audioDurationMs) &&
    typeof value.beatCount === "number" &&
    typeof value.readyBeatCount === "number" &&
    typeof value.audioReady === "boolean" &&
    typeof value.readyForRender === "boolean"
  );
}

function isProductionBeat(value: unknown): value is ProductionTimelineBeat {
  if (!isRecord(value)) return false;
  return (
    typeof value.chapterId === "string" &&
    typeof value.chapterOrderIndex === "number" &&
    typeof value.sceneIndex === "number" &&
    typeof value.beatIndex === "number" &&
    typeof value.visualBeatId === "string" &&
    typeof value.title === "string" &&
    typeof value.visualIntent === "string" &&
    typeof value.cameraMovement === "string" &&
    typeof value.assetStrategy === "string" &&
    (value.mediaAssetId === null || typeof value.mediaAssetId === "string") &&
    typeof value.startMs === "number" &&
    typeof value.endMs === "number" &&
    typeof value.durationMs === "number" &&
    typeof value.assetReady === "boolean"
  );
}

function isProductionTimeline(value: unknown): value is ProductionTimeline {
  if (!isRecord(value)) return false;
  return (
    typeof value.projectId === "string" &&
    typeof value.storyVersionId === "string" &&
    typeof value.totalDurationMs === "number" &&
    typeof value.aspectRatio === "string" &&
    typeof value.readyForRender === "boolean" &&
    Array.isArray(value.chapters) &&
    value.chapters.every(isProductionChapter) &&
    Array.isArray(value.beats) &&
    value.beats.every(isProductionBeat)
  );
}

function isProjectRenderArtifact(value: unknown): value is ProjectRenderArtifact {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.projectId === "string" &&
    typeof value.generationJobId === "string" &&
    (value.webViewLink === null || typeof value.webViewLink === "string") &&
    typeof value.mimeType === "string" &&
    typeof value.sizeBytes === "number" &&
    typeof value.checksumSha256 === "string" &&
    typeof value.durationMs === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.fps === "number" &&
    typeof value.status === "string"
  );
}

export const productionApi = {
  getTimeline: (projectId: ProjectId) =>
    apiRequest<ProductionTimeline>(
      `/api/v1/projects/${projectId}/production/timeline`,
      {},
      isProductionTimeline,
    ),
  render: (
    projectId: ProjectId,
    input: CreateProjectRenderInput,
    idempotencyKey = crypto.randomUUID(),
  ) =>
    apiRequest<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/production/render`,
      { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, json: input },
      isApiGenerationJob,
    ),
  getArtifactByJob: (projectId: ProjectId, jobId: string) =>
    apiRequest<ProjectRenderArtifact>(
      `/api/v1/projects/${projectId}/production/renders/by-job/${encodeURIComponent(jobId)}`,
      {},
      isProjectRenderArtifact,
    ),
};
