import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productionShell = await readFile(
  new URL("../src/features/production/ProductionShell.tsx", import.meta.url),
  "utf8",
);
const productionTimeline = await readFile(
  new URL("../src/features/production/ProductionTimelineScreen.tsx", import.meta.url),
  "utf8",
);
const productionApi = await readFile(
  new URL("../src/features/production/api/production.api.ts", import.meta.url),
  "utf8",
);
const projectTabs = await readFile(
  new URL("../src/features/production/components/ProjectTabs.tsx", import.meta.url),
  "utf8",
);
const chapterTable = await readFile(
  new URL("../src/features/production/components/ChapterTable.tsx", import.meta.url),
  "utf8",
);
const deleteChapterModal = await readFile(
  new URL("../src/features/production/components/DeleteChapterModal.tsx", import.meta.url),
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
const renderContainer = await readFile(
  new URL("../src/features/chapters/components/ChapterRenderContainer.tsx", import.meta.url),
  "utf8",
);
const productionRoute = await readFile(
  new URL("../src/app/projects/[projectId]/production/page.tsx", import.meta.url),
  "utf8",
);
const studioShell = await readFile(
  new URL("../src/components/layout/StudioAppShell.tsx", import.meta.url),
  "utf8",
);
const notificationScreen = await readFile(
  new URL("../src/features/notifications/NotificationScreen.tsx", import.meta.url),
  "utf8",
);
const notificationDrawer = await readFile(
  new URL("../src/features/notifications/components/NotificationDrawer.tsx", import.meta.url),
  "utf8",
);
const appProviders = await readFile(new URL("../src/app/providers.tsx", import.meta.url), "utf8");
const generationEventsProvider = await readFile(
  new URL("../src/features/generation/components/GenerationEventsProvider.tsx", import.meta.url),
  "utf8",
);
const studioHeader = await readFile(
  new URL("../src/components/layout/StudioHeader.tsx", import.meta.url),
  "utf8",
);

test("chapter creation leaves StoryVersion orchestration to the backend", () => {
  assert.match(productionShell, /useCreateChapter/);
  assert.doesNotMatch(productionShell, /projectsApi\.createStoryVersion/);
  assert.doesNotMatch(productionShell, /storyQuery/);
  assert.match(chaptersApi, /"Idempotency-Key": idempotencyKey/);
  assert.match(chaptersApi, /batchImport: \(projectId: ProjectId, file: File/);
});

test("chapter actions require confirmation before deleting and refresh the overview", () => {
  assert.match(chapterTable, /Xoá chapter/);
  assert.match(chapterTable, /onDelete\(\)/);
  assert.match(deleteChapterModal, /title="Xoá chapter\?"/);
  assert.match(deleteChapterModal, /onConfirm\(chapter\.id\)/);
  assert.match(chaptersApi, /method: "DELETE"/);
  assert.match(productionShell, /useDeleteChapter/);
  assert.match(productionShell, /onDeleteChapter=\{setChapterToDelete\}/);
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
  assert.match(mediaHook, /toast\.success\("Đã bắt đầu tạo hình ảnh"/);
});

test("generation progress uses SSE with a polling fallback", () => {
  assert.match(generationEventsProvider, /new EventSource\(apiUrl\("\/api\/v1\/generation-events"\)/);
  assert.match(generationEventsProvider, /generation\.updated/);
  assert.match(mediaHook, /generationEventsConnected/);
  assert.match(mediaHook, /: 10000/);
});

test("toast notifications use a readable light surface", () => {
  assert.match(appProviders, /<Toaster\s+position="top-right"\s+theme="light"/);
  assert.match(appProviders, /toastOptions=\{\{/);
  assert.match(appProviders, /!bg-surface-toast/);
  assert.match(appProviders, /!text-text-toast/);
});

test("notification bell announces the unread notification count", () => {
  assert.match(studioHeader, /Bạn có \{unreadCount\} thông báo mới/);
  assert.match(studioHeader, /unreadCount > 0/);
  assert.match(studioHeader, /aria-live="polite"/);
});

test("media generation keeps the queued job visible while details load", () => {
  assert.match(mediaHook, /const jobId = createdJob\?\.jobId \?\? initialMedia\.latestJobId \?\? null/);
  assert.match(mediaHook, /const job = jobQuery\.data \?\? createdJob;/);
  assert.doesNotMatch(mediaHook, /workspaceHasCreatedJob|resetCreateJob/);
});

test("render transitions STALLED/RUNNING and resolves completed artifacts", () => {
  assert.match(renderHook, /case "RUNNING":\s*return "RUNNING"/);
  assert.match(renderHook, /case "STALLED":\s*case "UNKNOWN":/);
  assert.match(renderHook, /case "COMPLETED":\s*if \(artifact\) return "READY"/s);
  assert.match(renderHook, /artifactsApi\.getByJobId/);
  assert.match(renderTab, /render\.status === "READY" && render\.artifact/);
});

test("project production is a dedicated route with one global audio-clock timeline", () => {
  assert.match(productionRoute, /screen="production-timeline"/);
  assert.match(studioShell, /ProductionTimelineScreen/);
  assert.match(studioShell, /screen === "production-timeline"/);
  assert.match(projectTabs, /onOpenProduction/);
  assert.match(productionShell, /\/projects\/\$\{projectIdentifier\}\/production/);
  assert.match(productionTimeline, /Global Production Timeline/);
  assert.match(productionTimeline, /CHAPTER/);
  assert.match(productionTimeline, /VISUAL/);
  assert.match(productionTimeline, /MOTION/);
  assert.match(productionTimeline, /AUDIO/);
  assert.match(productionApi, /\/production\/timeline/);
  assert.match(productionApi, /\/production\/render/);
});

test("project final render retries preserve one idempotency intent", () => {
  assert.match(productionTimeline, /interface RenderIntent/);
  assert.match(productionTimeline, /const renderIntentRef = useRef<RenderIntent \| null>\(null\)/);
  assert.match(productionTimeline, /if \(!intent \|\| intent\.resolution !== resolution\)/);
  assert.match(productionTimeline, /renderMutation\.mutate\(intent\)/);
  assert.match(productionTimeline, /onSuccess: \(job\) => \{[\s\S]*renderIntentRef\.current = null;/);
  assert.doesNotMatch(productionTimeline, /onError:[\s\S]*renderIntentRef\.current = null/);
});

test("chapter render stays a preview and opens the focused project production timeline", () => {
  assert.match(renderTab, /Chapter preview &amp; render/);
  assert.match(renderTab, /Open in Production/);
  assert.match(renderContainer, /\/production\?focusChapter=\$\{encodeURIComponent\(chapterId\)\}/);
});

test("notification surfaces describe completed image generation", () => {
  for (const source of [notificationScreen, notificationDrawer]) {
    assert.match(source, /notification\.image_generation\.completed/);
    assert.match(source, /notification\.image_generation\.completed\.desc/);
  }
});
