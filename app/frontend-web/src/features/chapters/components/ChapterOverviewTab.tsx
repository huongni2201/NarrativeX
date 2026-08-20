import {
  CheckCircle2,
  Clock,
  Film,
  Image as ImageIcon,
  Layers,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Volume2,
} from "lucide-react";
import type {
  ApiChapterWorkspace,
  ApiChapterWorkspacePipelineStep,
  ApiChapterWorkspaceProgressStep,
  JobStatus,
} from "@/types/api";
import { ChapterSceneGrid } from "./ChapterSceneGrid";

interface ChapterOverviewTabProps {
  workspace: ApiChapterWorkspace;
  analysisJobStatus: JobStatus | null;
  analysisJobProgress: number | null;
  analysisMessage: string | null;
  analyzeDisabled: boolean;
  analysisActive: boolean;
  onAnalyze: () => void;
  onEdit: () => void;
  onOpenStoryboard: () => void;
}

export function ChapterOverviewTab({
  workspace,
  analysisJobStatus,
  analysisJobProgress,
  analysisMessage,
  analyzeDisabled,
  analysisActive,
  onAnalyze,
  onEdit,
  onOpenStoryboard,
}: Readonly<ChapterOverviewTabProps>) {
  const analyzeLabel = analysisActive
    ? workspace.pipeline.sourceOutdated
      ? "Đang phân tích lại…"
      : "Đang phân tích…"
    : workspace.pipeline.sourceOutdated
      ? "Phân tích lại"
      : "Phân tích";

  return (
    <div className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-border bg-surface-card/90 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-100">Tiến trình</h2>
        <div className="mt-4 space-y-1.5">
          <ProgressItem
            icon={<Sparkles className="h-4 w-4" />}
            label="Phân tích Chapter"
            step={workspace.pipeline.analysis}
            active={analysisActive}
          />
          <ProgressItem
            icon={<Layers className="h-4 w-4" />}
            label="Lập kế hoạch Visual Beats"
            step={workspace.pipeline.visualPlanning}
          />
          <ProgressItem
            icon={<ImageIcon className="h-4 w-4" />}
            label="Generate Visuals"
            step={workspace.pipeline.visualGeneration}
            progressLabel={
              workspace.pipeline.visualGeneration.total > 0
                ? `${workspace.pipeline.visualGeneration.completed}/${workspace.pipeline.visualGeneration.total}`
                : undefined
            }
          />
          <ProgressItem
            icon={<Volume2 className="h-4 w-4" />}
            label="Audio (TTS & Subtitle)"
            step={workspace.pipeline.audio}
          />
          <ProgressItem
            icon={<Film className="h-4 w-4" />}
            label="Render Chapter"
            step={workspace.pipeline.render}
          />
        </div>

        {(analysisMessage || analysisJobStatus) && (
          <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-slate-300">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{analysisMessage ?? "Đang theo dõi analysis job…"}</span>
              {analysisJobStatus && (
                <span className="shrink-0 font-mono font-medium text-purple-300">
                  {analysisJobStatus}
                  {analysisJobProgress !== null ? ` · ${analysisJobProgress}%` : ""}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-xs font-semibold text-slate-300">Hành động nhanh</h3>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={analyzeDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {analysisActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {analyzeLabel}
            </button>
            <QuickAction label="Review Visuals" enabled={workspace.capabilities.canGenerateVisuals} />
            <QuickAction label="Tạo Audio" enabled={workspace.capabilities.canGenerateAudio} />
          </div>
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-border bg-surface-card/90 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-100">Nội dung Chapter</h2>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-dark px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <Pencil className="h-3.5 w-3.5" />
              Chỉnh sửa
            </button>
          </div>
          <p className="mt-3 max-h-36 overflow-hidden whitespace-pre-wrap rounded-xl border border-border bg-surface-panel px-4 py-3.5 text-base leading-7 text-slate-300">
            {workspace.chapter.sourceText || "Chapter chưa có nội dung."}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-surface-card/90 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Scenes ({workspace.summary.sceneCount})
            </h2>
            {workspace.summary.sceneCount > 0 && (
              <button
                type="button"
                onClick={onOpenStoryboard}
                className="text-xs font-medium text-purple-300 transition-colors hover:text-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                Xem tất cả
              </button>
            )}
          </div>
          <ChapterSceneGrid scenes={workspace.previewScenes} />
        </section>
      </div>
    </div>
  );
}

function ProgressItem({
  icon,
  label,
  step,
  active = false,
  progressLabel,
}: {
  icon: React.ReactNode;
  label: string;
  step: ApiChapterWorkspacePipelineStep | ApiChapterWorkspaceProgressStep;
  active?: boolean;
  progressLabel?: string;
}) {
  const isRunning = active || ("status" in step && step.status === "RUNNING");
  const isCompleted =
    !active &&
    (("status" in step && step.status === "COMPLETED") ||
      ("completed" in step && step.completed > 0 && step.completed === step.total));

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs transition-colors ${
        isRunning
          ? "border-purple-500/40 bg-purple-500/10 text-purple-200"
          : isCompleted
            ? "border-border bg-surface-panel text-slate-300"
            : "border-border/50 bg-surface-dark text-slate-500"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={
            isRunning ? "text-purple-400" : isCompleted ? "text-emerald-400" : "text-slate-600"
          }
        >
          {icon}
        </span>
        <span className="truncate font-medium">{label}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
        {progressLabel && <span className="text-slate-400">{progressLabel}</span>}
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
        ) : isCompleted ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-slate-600" />
        )}
      </div>
    </div>
  );
}

function QuickAction({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <button
      type="button"
      disabled={!enabled}
      className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
        enabled
          ? "border-border-dark bg-slate-900/60 text-slate-200 hover:bg-slate-800"
          : "cursor-not-allowed border-border/50 bg-surface-dark text-slate-600"
      }`}
    >
      {label}
      {!enabled && <span className="ml-1.5 text-[10px] text-slate-600">(chưa mở)</span>}
    </button>
  );
}
