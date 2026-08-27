import type { DesktopChapterWorkspace } from "@narrativex/client-contracts";

export type ChapterFilter = "all" | "completed" | "in_progress" | "draft";
export type ChapterSort = "recent" | "title" | "order" | "words";
export type WorkspaceStatus = "loading" | "ready" | "partial" | "empty" | "error";
export type ChapterDisplayStatus = "completed" | "in_progress" | "draft" | "loading" | "error";

const AUDIO_PROCESSING_STATUSES = new Set([
  "QUEUED",
  "RUNNING",
  "PROCESSING",
  "GENERATING",
  "STALLED",
  "UNKNOWN",
  "PAUSED_COST_LIMIT",
]);

const ANALYSIS_PROCESSING_STATUSES = new Set(["QUEUED", "RUNNING", "STALLED", "UNKNOWN"]);
const PIPELINE_PROCESSING_STATUSES = new Set([
  "QUEUED",
  "RUNNING",
  "GENERATING",
  "STALLED",
  "UNKNOWN",
]);

export function isAudioProcessingStatus(status: string | null | undefined) {
  return Boolean(status && AUDIO_PROCESSING_STATUSES.has(status));
}

export function isGenerationJobTerminal(status: string | null | undefined) {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELED";
}

export function wordCount(value: string) {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

export function formatDurationMs(durationMs: number | null | undefined) {
  if (!durationMs || durationMs <= 0) return "Thời lượng chưa xác định";
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function chapterStatus(workspace: DesktopChapterWorkspace | undefined): ChapterDisplayStatus {
  if (!workspace) return "loading";
  if (workspace.pipeline.sourceOutdated) return "in_progress";
  if (workspace.pipeline.analysis.status === "COMPLETED") return "completed";
  if (ANALYSIS_PROCESSING_STATUSES.has(workspace.pipeline.analysis.status)) return "in_progress";
  return "draft";
}

export function chapterStatusLabel(status: ChapterDisplayStatus) {
  if (status === "completed") return "Đã phân tích";
  if (status === "in_progress") return "Đang xử lý";
  if (status === "error") return "Không tải được";
  if (status === "loading") return "Đang tải…";
  return "Nháp";
}

export function chapterStatusClass(status: ChapterDisplayStatus) {
  if (status === "completed") return "border border-success/30 bg-success-bg text-success";
  if (status === "in_progress") return "border border-info/30 bg-info-bg text-info";
  if (status === "error") return "border border-danger/30 bg-danger-bg text-danger";
  return "border border-border bg-surface-3 text-text-muted";
}

export function chapterAudioListLabel(status: string, durationMs: number | null | undefined) {
  if (status === "READY" || status === "COMPLETED") {
    return durationMs ? `Audio ${formatDurationMs(durationMs)}` : "Audio sẵn sàng";
  }
  if (isAudioProcessingStatus(status)) return "Audio đang tạo";
  if (status === "FAILED") return "Audio lỗi";
  return null;
}

export function chapterAudioListClass(status: string | undefined) {
  if (status === "READY" || status === "COMPLETED") return "text-success";
  if (isAudioProcessingStatus(status)) return "text-info";
  if (status === "FAILED") return "text-danger";
  return "text-text-muted";
}

export function pipelineStatusLabel(status: string) {
  if (status === "COMPLETED" || status === "READY") return "Hoàn thành";
  if (status === "PAUSED_COST_LIMIT") return "Tạm dừng";
  if (PIPELINE_PROCESSING_STATUSES.has(status)) return "Đang chạy";
  if (status === "FAILED") return "Thất bại";
  return "Chưa bắt đầu";
}

export function audioStatusLabel(status: string) {
  if (status === "READY" || status === "COMPLETED") return "Sẵn sàng";
  if (status === "PAUSED_COST_LIMIT") return "Tạm dừng";
  if (isAudioProcessingStatus(status)) return "Đang xử lý";
  if (status === "FAILED") return "Thất bại";
  return "Chưa tạo";
}

export function audioStatusBadgeClass(status: string | null) {
  if (status === "READY" || status === "COMPLETED") {
    return "border border-success/30 bg-success-bg text-success";
  }
  if (status === "FAILED") return "border border-danger/30 bg-danger-bg text-danger";
  if (status === "PROCESSING" || isAudioProcessingStatus(status)) {
    return "border border-info/30 bg-info-bg text-info";
  }
  return "border border-border bg-surface-3 text-text-muted";
}

export function workspaceStatusDotClass(status: WorkspaceStatus) {
  if (status === "ready") return "bg-success";
  if (status === "error") return "bg-danger";
  if (status === "partial") return "bg-warning";
  if (status === "loading") return "bg-info";
  return "bg-text-muted";
}

export function workspaceStatusLabel(status: WorkspaceStatus) {
  if (status === "ready") return "API ready";
  if (status === "error") return "API error";
  if (status === "partial") return "API partial";
  if (status === "loading") return "API loading";
  return "API empty";
}
