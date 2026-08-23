import { type ReactNode } from "react";
import { CheckCircle2, ChevronRight, Film, Image as ImageIcon, Layers, Loader2, Sparkles, Volume2 } from "lucide-react";
import type { ApiChapterWorkspace, ApiChapterWorkspacePipelineStep, ApiChapterWorkspaceProgressStep, JobStatus } from "@/types/api";

interface ChapterPipelineSummaryProps {
  workspace: ApiChapterWorkspace;
  analysisJobStatus: JobStatus | null;
  analysisJobProgress: number | null;
  analysisMessage: string | null;
  analyzeDisabled: boolean;
  analysisActive: boolean;
  onAnalyze: () => void;
  onOpenStoryboard: () => void;
  onOpenNarration: () => void;
}

export function ChapterPipelineSummary({
  workspace,
  analysisJobStatus,
  analysisJobProgress,
  analysisMessage,
  analyzeDisabled,
  analysisActive,
  onAnalyze,
  onOpenStoryboard,
  onOpenNarration,
}: Readonly<ChapterPipelineSummaryProps>) {
  const analyzeLabel = analysisActive
    ? workspace.pipeline.sourceOutdated ? "Đang phân tích lại…" : "Đang phân tích…"
    : workspace.pipeline.sourceOutdated ? "Phân tích lại" : "Phân tích";

  return (
    <aside className="rounded-2xl border border-border bg-surface-card/90 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-100">Tiến trình</h2>
      <div className="mt-4 space-y-2">
        <ProgressItem stepNumber={1} icon={<Sparkles className="h-4 w-4" />} iconColorClass="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" label="Phân tích Chapter" step={workspace.pipeline.analysis} active={analysisActive} onClick={workspace.capabilities.canAnalyze ? onAnalyze : undefined} />
        <ProgressItem stepNumber={2} icon={<Volume2 className="h-4 w-4" />} iconColorClass="bg-amber-500/15 text-amber-400 border border-amber-500/20" label="Audio (TTS & Subtitle)" step={workspace.pipeline.audio} onClick={workspace.capabilities.canGenerateAudio ? onOpenNarration : undefined} />
        <ProgressItem stepNumber={3} icon={<Layers className="h-4 w-4" />} iconColorClass="bg-cyan-500/15 text-cyan-400 border border-cyan-500/20" label="Lập kế hoạch Visual Beats" step={workspace.pipeline.visualPlanning} onClick={onOpenStoryboard} />
        <ProgressItem stepNumber={4} icon={<ImageIcon className="h-4 w-4" />} iconColorClass="bg-orange-500/15 text-orange-400 border border-orange-500/20" label="Generate Visuals" step={workspace.pipeline.visualGeneration} progressLabel={workspace.pipeline.visualGeneration.total > 0 ? `${workspace.pipeline.visualGeneration.completed}/${workspace.pipeline.visualGeneration.total}` : undefined} onClick={workspace.capabilities.canGenerateVisuals ? onOpenStoryboard : undefined} />
        <ProgressItem stepNumber={5} icon={<Film className="h-4 w-4" />} iconColorClass="bg-rose-500/15 text-rose-400 border border-rose-500/20" label="Render Chapter" step={workspace.pipeline.render} />
      </div>
      {(analysisMessage || analysisJobStatus) && (
        <div className="relative isolate mt-4 overflow-hidden rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 text-xs text-slate-300">
          {analysisActive && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-primary-light/10 to-transparent motion-safe:animate-shimmer" />}
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{analysisMessage ?? "Đang theo dõi analysis job…"}</span>
            {analysisJobStatus && <span className="shrink-0 font-mono font-medium text-orange-300">{analysisJobStatus}{analysisJobProgress !== null ? ` · ${analysisJobProgress}%` : ""}</span>}
          </div>
        </div>
      )}
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-xs font-semibold text-slate-300">Hành động nhanh</h3>
        <div className="mt-3 space-y-2.5">
          <button type="button" onClick={onAnalyze} disabled={analyzeDisabled} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 transition-[background-color,box-shadow,color] hover:from-orange-500 hover:to-orange-500 hover:shadow-orange-700/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none">
            {analysisActive ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Sparkles className="h-4 w-4 text-orange-200" />}
            <span>{analyzeLabel}</span>
          </button>
          {!analyzeDisabled || analysisActive ? null : <p className="px-1 text-[11px] leading-5 text-slate-500">{workspace.summary.sceneCount > 0 && workspace.summary.visualBeatCount > 0 && !workspace.pipeline.sourceOutdated ? "Chapter đã có Scene/Visual Beat được duyệt. Hãy chỉnh sửa và lưu nội dung Chapter trước khi phân tích lại." : "Phân tích hiện chưa khả dụng; hãy lưu nội dung Chapter và kiểm tra trạng thái quyền sử dụng."}</p>}
          <QuickAction label="Review Visuals" enabled={workspace.capabilities.canGenerateVisuals} disabledReason={workspace.capabilities.visualGenerationBlockReason} onClick={onOpenStoryboard} />
          <QuickAction label="Tạo Audio" enabled={workspace.capabilities.canGenerateAudio} onClick={onOpenNarration} />
        </div>
      </div>
    </aside>
  );
}

function ProgressItem({ stepNumber, icon, iconColorClass, label, step, active = false, progressLabel, onClick }: { stepNumber: number; icon: ReactNode; iconColorClass: string; label: string; step: ApiChapterWorkspacePipelineStep | ApiChapterWorkspaceProgressStep; active?: boolean; progressLabel?: string; onClick?: () => void }) {
  const isRunning = active || ("status" in step && step.status === "RUNNING");
  const isCompleted = !active && (("status" in step && step.status === "COMPLETED") || ("completed" in step && step.completed > 0 && step.completed === step.total));
  const content = <div className={`group flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs transition-[background-color,border-color,color] ${isRunning ? "border-orange-500/50 bg-orange-500/10 text-orange-200 shadow-sm shadow-orange-900/20" : isCompleted ? "border-border bg-surface-panel/90 text-slate-200 hover:border-slate-700" : "border-border/60 bg-surface-dark/90 text-slate-400 hover:border-slate-700/80"} ${onClick ? "cursor-pointer hover:bg-slate-900/80 hover:text-slate-100" : ""}`}>
    <div className="flex min-w-0 items-center gap-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconColorClass} ${isRunning ? "motion-safe:animate-pulse-glow" : ""}`}>{icon}</span><span className="truncate font-medium text-slate-200">{stepNumber}. {label}</span></div>
    <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">{progressLabel && <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-orange-300">{progressLabel}</span>}{isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" /> : isCompleted ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />}</div>
  </div>;
  return onClick ? <button type="button" onClick={onClick} className="w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{content}</button> : content;
}

function QuickAction({ label, enabled, disabledReason, onClick }: { label: string; enabled: boolean; disabledReason?: string | null; onClick?: () => void }) {
  return <button type="button" disabled={!enabled} onClick={onClick} className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${enabled ? "border-border-dark bg-slate-900/60 text-slate-200 hover:bg-slate-800" : "cursor-not-allowed border-border/50 bg-surface-dark text-slate-600"}`}>{label}{!enabled && <span className="ml-1.5 text-[10px] text-slate-600">({disabledReason ?? "chưa mở"})</span>}</button>;
}
