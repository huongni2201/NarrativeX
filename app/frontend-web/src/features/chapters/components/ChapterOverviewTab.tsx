import React, { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Layers,
  Loader2,
  Pencil,
  ShieldAlert,
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
import { GenerateNarrationModal } from "@/features/generation/components/GenerateNarrationModal";

interface ChapterOverviewTabProps {
  projectId: number;
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
  projectId,
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
  const [isNarrationOpen, setIsNarrationOpen] = useState(false);
  const safetyDecision = workspace.safety.decision.toUpperCase();
  const safetyPending = safetyDecision !== "SAFE";
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
        <div className="mt-4 space-y-2">
          <ProgressItem
            stepNumber={1}
            icon={<Sparkles className="h-4 w-4" />}
            iconColorClass="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
            label="Phân tích Chapter"
            step={workspace.pipeline.analysis}
            active={analysisActive}
            onClick={workspace.capabilities.canAnalyze ? onAnalyze : undefined}
          />
          <ProgressItem
            stepNumber={2}
            icon={<Volume2 className="h-4 w-4" />}
            iconColorClass="bg-amber-500/15 text-amber-400 border border-amber-500/20"
            label="Audio (TTS & Subtitle)"
            step={workspace.pipeline.audio}
            onClick={workspace.capabilities.canGenerateAudio ? () => setIsNarrationOpen(true) : undefined}
          />
          <ProgressItem
            stepNumber={3}
            icon={<Layers className="h-4 w-4" />}
            iconColorClass="bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
            label="Lập kế hoạch Visual Beats"
            step={workspace.pipeline.visualPlanning}
            onClick={onOpenStoryboard}
          />
          <ProgressItem
            stepNumber={4}
            icon={<ImageIcon className="h-4 w-4" />}
            iconColorClass="bg-purple-500/15 text-purple-400 border border-purple-500/20"
            label="Generate Visuals"
            step={workspace.pipeline.visualGeneration}
            progressLabel={
              workspace.pipeline.visualGeneration.total > 0
                ? `${workspace.pipeline.visualGeneration.completed}/${workspace.pipeline.visualGeneration.total}`
                : undefined
            }
            onClick={workspace.capabilities.canGenerateVisuals ? onOpenStoryboard : undefined}
          />
          <ProgressItem
            stepNumber={5}
            icon={<Film className="h-4 w-4" />}
            iconColorClass="bg-rose-500/15 text-rose-400 border border-rose-500/20"
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

        {safetyPending && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-200"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="font-medium">Phân tích đang chờ kiểm duyệt an toàn</p>
              <p className="mt-1 leading-5 text-amber-200/75">
                Nội dung mới tạo đang ở trạng thái {safetyDecision}. Hiện phiên bản này chưa có luồng duyệt an toàn, nên hệ thống tạm khóa Phân tích.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-xs font-semibold text-slate-300">Hành động nhanh</h3>
          <div className="mt-3 space-y-2.5">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={analyzeDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-950/50 transition-[background-color,box-shadow,color] hover:from-purple-500 hover:to-indigo-500 hover:shadow-purple-700/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
            >
              {analysisActive ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Sparkles className="h-4 w-4 text-purple-200" />
              )}
              <span>{analyzeLabel}</span>
            </button>
            {!analyzeDisabled || analysisActive ? null : (
              <p className="px-1 text-[11px] leading-5 text-slate-500">
                {workspace.summary.sceneCount > 0 &&
                workspace.summary.visualBeatCount > 0 &&
                !workspace.pipeline.sourceOutdated
                  ? "Chapter đã có Scene/Visual Beat được duyệt. Hãy chỉnh sửa và lưu nội dung Chapter trước khi phân tích lại."
                  : safetyPending
                    ? "Phân tích sẽ khả dụng sau khi nội dung được kiểm duyệt an toàn."
                    : "Phân tích hiện chưa khả dụng; hãy lưu nội dung Chapter và kiểm tra trạng thái quyền sử dụng."}
              </p>
            )}
            <QuickAction label="Review Visuals" enabled={workspace.capabilities.canGenerateVisuals} onClick={onOpenStoryboard} />
            <QuickAction
              label="Tạo Audio"
              enabled={workspace.capabilities.canGenerateAudio}
              onClick={() => setIsNarrationOpen(true)}
            />
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

      <GenerateNarrationModal
        isOpen={isNarrationOpen}
        onClose={() => setIsNarrationOpen(false)}
        projectId={projectId}
        chapterId={workspace.chapter.id}
        chapterTitle={workspace.chapter.title}
      />
    </div>
  );
}

function ProgressItem({
  stepNumber,
  icon,
  iconColorClass,
  label,
  step,
  active = false,
  progressLabel,
  onClick,
}: {
  stepNumber: number;
  icon: React.ReactNode;
  iconColorClass: string;
  label: string;
  step: ApiChapterWorkspacePipelineStep | ApiChapterWorkspaceProgressStep;
  active?: boolean;
  progressLabel?: string;
  onClick?: () => void;
}) {
  const isRunning = active || ("status" in step && step.status === "RUNNING");
  const isCompleted =
    !active &&
    (("status" in step && step.status === "COMPLETED") ||
      ("completed" in step && step.completed > 0 && step.completed === step.total));

  const content = (
    <div
      className={`group flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs transition-[background-color,border-color,color] ${
        isRunning
          ? "border-purple-500/50 bg-purple-500/10 text-purple-200 shadow-sm shadow-purple-900/20"
          : isCompleted
            ? "border-border bg-surface-panel/90 text-slate-200 hover:border-slate-700"
            : "border-border/60 bg-surface-dark/90 text-slate-400 hover:border-slate-700/80"
      } ${onClick ? "cursor-pointer hover:bg-slate-900/80 hover:text-slate-100" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconColorClass}`}>
          {icon}
        </span>
        <span className="truncate font-medium text-slate-200">
          {stepNumber}. {label}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
        {progressLabel && (
          <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-300">{progressLabel}</span>
        )}
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
        ) : isCompleted ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
      >
        {content}
      </button>
    );
  }

  return content;
}

function QuickAction({
  label,
  enabled,
  onClick,
}: {
  label: string;
  enabled: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
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
