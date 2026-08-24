import assert from "node:assert/strict";
import test from "node:test";
import {
  isApiChapterWorkspace,
  isApiGenerationJob,
} from "../src/types/api.ts";
import { isJobHistoryItem } from "../src/features/history/types/job-history.types.ts";
import { isNotificationItem } from "../src/features/notifications/types/notifications.types.ts";
import { isRenderArtifact } from "../src/features/render/api/artifacts.types.ts";

const chapterId = "01a0310f-39df-7d2b-abaf-2fe616e1cfd8";
const projectId = "01a030f6-d881-7091-a532-27c29a10b65c";

test("accepts UUID generation job entity and target IDs", () => {
  assert.equal(
    isApiGenerationJob({
      jobId: "01a0310f-4d0e-7d2b-abaf-2fe616e1cfd8",
      type: "CHAPTER_ANALYSIS",
      status: "QUEUED",
      progress: 0,
      currentStep: "queued",
      entityType: "CHAPTER",
      entityId: chapterId,
      target: { type: "CHAPTER", id: chapterId },
      errorCode: null,
    }),
    true,
  );
});

test("accepts UUID chapter workspace scene IDs", () => {
  assert.equal(
    isApiChapterWorkspace({
      chapter: {
        id: chapterId,
        storyVersionId: "01a0310f-7e6d-7d2b-abaf-2fe616e1cfd8",
        orderIndex: 0,
        title: "Chapter",
        sourceText: "Nội dung",
        sourceHash: "hash",
        rowVersion: 0,
      },
      projectName: "Project",
      summary: { sceneCount: 1, visualBeatCount: 0, estimatedDurationSeconds: 4 },
      pipeline: {
        analysis: { status: "COMPLETED", completedAt: null },
        visualPlanning: { status: "COMPLETED", completedAt: null },
        visualGeneration: {
          status: "IDLE",
          total: 0,
          completed: 0,
          failed: 0,
          latestJobId: null,
          mediaPlanId: null,
          mediaPlanRevision: null,
        },
        audio: { status: "IDLE", completedAt: null },
        render: { status: "IDLE", completedAt: null, latestJobId: null, artifactId: null },
        sourceOutdated: false,
      },
      previewScenes: [
        {
          id: "01a0310f-9b17-7d2b-abaf-2fe616e1cfd8",
          orderIndex: 0,
          title: "Opening",
          durationSeconds: 4,
          status: "DRAFT",
          visualBeatCount: 0,
          previewImageUrl: null,
        },
      ],
      capabilities: {
        canAnalyze: false,
        canGenerateVisuals: false,
        canGenerateAudio: false,
        canRender: false,
        visualGenerationBlockReason: null,
      },
    }),
    true,
  );
});

test("accepts UUID project IDs in history and notifications", () => {
  assert.equal(
    isJobHistoryItem({
      jobId: "01a0310f-4d0e-7d2b-abaf-2fe616e1cfd8",
      projectId,
      projectName: "Project",
      jobType: "CHAPTER_ANALYSIS",
      status: "COMPLETED",
      progress: 100,
      currentStep: null,
      errorCode: null,
      createdAt: "2026-08-24T00:00:00Z",
      completedAt: "2026-08-24T00:01:00Z",
    }),
    true,
  );
  assert.equal(
    isNotificationItem({
      id: 1,
      projectId,
      type: "JOB_COMPLETED",
      titleKey: "notification.title",
      messageKey: "notification.message",
      readAt: null,
      createdAt: "2026-08-24T00:00:00Z",
    }),
    true,
  );
});

test("accepts UUID project and chapter IDs on render artifacts", () => {
  assert.equal(
    isRenderArtifact({
      id: 1,
      projectId,
      chapterId,
      artifactType: "FINAL_VIDEO",
      renderFingerprint: "fingerprint",
      storageKey: "renders/file.mp4",
      mimeType: "video/mp4",
      sizeBytes: 100,
      checksumSha256: null,
      durationMs: 4000,
      width: 1920,
      height: 1080,
      status: "READY",
      createdAt: "2026-08-24T00:00:00Z",
      updatedAt: "2026-08-24T00:00:00Z",
      previewAvailable: true,
      previewUrl: "/api/v1/artifacts/1/content",
      downloadAvailable: true,
      downloadUrl: "/api/v1/artifacts/1/content",
    }),
    true,
  );
});
