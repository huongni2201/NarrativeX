import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productionShell = await readFile(
  new URL("../src/features/production/ProductionShell.tsx", import.meta.url),
  "utf8",
);
const chaptersApi = await readFile(
  new URL("../src/features/chapters/api/chapters.api.ts", import.meta.url),
  "utf8",
);
const workspaceHook = await readFile(
  new URL("../src/features/chapters/hooks/useChapterWorkspaceState.ts", import.meta.url),
  "utf8",
);
const mediaHook = await readFile(
  new URL("../src/features/generation/hooks/useMediaGeneration.ts", import.meta.url),
  "utf8",
);
const renderHook = await readFile(
  new URL("../src/features/render/hooks/useChapterRender.ts", import.meta.url),
  "utf8",
);
const renderTab = await readFile(
  new URL("../src/features/chapters/components/ChapterRenderTab.tsx", import.meta.url),
  "utf8",
);

test("chapter creation leaves StoryVersion orchestration to the backend", () => {
  assert.match(productionShell, /useCreateChapter/);
  assert.doesNotMatch(productionShell, /projectsApi\.createStoryVersion/);
  assert.doesNotMatch(productionShell, /storyQuery/);
  assert.match(chaptersApi, /"Idempotency-Key": idempotencyKey/);
  assert.match(chaptersApi, /batchImport: \(projectId: ProjectId, file: File/);
});

test("workspace behavior preserves translation confirmation and optimistic concurrency", () => {
  assert.match(workspaceHook, /translationStatus === "PENDING_CONFIRMATION"/);
  assert.match(workspaceHook, /setTranslationPromptOpen\(true\)/);
  assert.match(workspaceHook, /error\.status === 409/);
  assert.match(workspaceHook, /Bản local vẫn được giữ/);
});

test("media generation owns optimistic job state and terminal recovery", () => {
  assert.match(mediaHook, /setQueryData\(queryKeys\.job\(job\.jobId\)/);
  assert.match(mediaHook, /job\?\.status === "FAILED" \|\| job\?\.status === "UNKNOWN"/);
  assert.match(mediaHook, /apiErrorMessage\(error, "Không thể tạo media job\."\)/);
});

test("render transitions STALLED/RUNNING and resolves completed artifacts", () => {
  assert.match(renderHook, /case "RUNNING":\s*return "RUNNING"/);
  assert.match(renderHook, /case "STALLED":\s*case "UNKNOWN":/);
  assert.match(renderHook, /case "COMPLETED":\s*if \(artifact\) return "READY"/s);
  assert.match(renderHook, /artifactsApi\.getByJobId/);
  assert.match(renderTab, /render\.status === "READY" && render\.artifact/);
});
