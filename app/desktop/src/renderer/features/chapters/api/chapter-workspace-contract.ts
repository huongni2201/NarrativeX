import type {
  ChapterWorkspaceAudio,
  ChapterWorkspacePreviewScene,
  ChapterWorkspaceProgress,
  ChapterWorkspaceRender,
  ChapterWorkspaceStep,
  DesktopChapterDetails,
  DesktopChapterWorkspace,
} from "@narrativex/client-contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isChapter(value: unknown): value is DesktopChapterDetails {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.storyVersionId) &&
    isNumber(value.orderIndex) &&
    isString(value.title) &&
    isString(value.sourceText) &&
    isString(value.sourceHash) &&
    isNumber(value.rowVersion)
  );
}

function isWorkspaceStep(value: unknown): value is ChapterWorkspaceStep {
  return isRecord(value) && isString(value.status) && isNullableString(value.completedAt);
}

function isWorkspaceProgress(value: unknown): value is ChapterWorkspaceProgress {
  return (
    isRecord(value) &&
    isString(value.status) &&
    isNumber(value.total) &&
    isNumber(value.completed) &&
    isNumber(value.failed)
  );
}

function isWorkspaceAudio(value: unknown): value is ChapterWorkspaceAudio {
  return (
    isRecord(value) &&
    isWorkspaceStep(value) &&
    isNullableString(value.latestJobId) &&
    isNullableString(value.audioUrl) &&
    isNullableNumber(value.durationMs)
  );
}

function isWorkspaceRender(value: unknown): value is ChapterWorkspaceRender {
  return (
    isRecord(value) &&
    isWorkspaceStep(value) &&
    isNullableString(value.latestJobId) &&
    isNullableNumber(value.artifactId)
  );
}

function isWorkspacePreviewScene(value: unknown): value is ChapterWorkspacePreviewScene {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isNumber(value.orderIndex) &&
    isString(value.title) &&
    isNullableNumber(value.durationSeconds) &&
    isString(value.status) &&
    isNumber(value.visualBeatCount) &&
    isNullableString(value.previewImageUrl)
  );
}

function isChapterWorkspace(value: unknown): value is DesktopChapterWorkspace {
  if (!isRecord(value) || !isChapter(value.chapter) || !isString(value.projectName)) return false;
  if (!isRecord(value.summary) || !isNumber(value.summary.sceneCount) || !isNumber(value.summary.visualBeatCount) || !isNumber(value.summary.estimatedDurationSeconds)) return false;
  if (!isRecord(value.pipeline) || !isWorkspaceStep(value.pipeline.analysis) || !isWorkspaceStep(value.pipeline.visualPlanning) || !isWorkspaceProgress(value.pipeline.visualGeneration) || !isWorkspaceAudio(value.pipeline.audio) || !isWorkspaceRender(value.pipeline.render) || typeof value.pipeline.sourceOutdated !== "boolean") return false;
  if (!Array.isArray(value.previewScenes) || !value.previewScenes.every(isWorkspacePreviewScene)) return false;
  if (!isRecord(value.capabilities)) return false;
  return (
    typeof value.capabilities.canAnalyze === "boolean" &&
    typeof value.capabilities.canGenerateVisuals === "boolean" &&
    typeof value.capabilities.canGenerateAudio === "boolean" &&
    typeof value.capabilities.canRender === "boolean" &&
    isNullableString(value.capabilities.visualGenerationBlockReason) &&
    isNullableString(value.capabilities.audioGenerationBlockReason)
  );
}

export function parseChapterWorkspace(value: unknown): DesktopChapterWorkspace {
  if (!isChapterWorkspace(value)) throw new Error("Chapter workspace response không đúng contract.");
  return value;
}
