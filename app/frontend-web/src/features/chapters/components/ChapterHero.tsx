import { ChevronRight, Film, Image as ImageIcon, Pencil } from "lucide-react";
import type { ApiChapterWorkspace } from "@/types/api";

interface ChapterHeroProps {
  workspace: ApiChapterWorkspace;
  chapterNumber: string;
  analysisActive: boolean;
  onEdit: () => void;
}

export function ChapterHero({
  workspace,
  chapterNumber,
  analysisActive,
  onEdit,
}: Readonly<ChapterHeroProps>) {
  const pipelineBadge = derivePipelineBadge(workspace, analysisActive);
  const coverScene = workspace.previewScenes.find((scene) => scene.previewImageUrl);

  return (
    <section className="rounded-2xl border border-border bg-surface-card/95 p-4 shadow-lg sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="relative flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-dark bg-gradient-to-br from-slate-800 to-slate-950 sm:h-28 sm:w-36">
            {coverScene?.previewImageUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${JSON.stringify(coverScene.previewImageUrl).slice(1, -1)})` }}
                aria-label="Chapter preview"
                role="img"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <ImageIcon className="h-7 w-7 text-slate-500" />
                <span className="text-xs">Chưa có visual</span>
              </div>
            )}
          </div>

          <div className="min-w-0 py-1">
            <p className="text-xs font-medium text-slate-400">Chapter {chapterNumber}</p>
            <div className="mt-1 flex items-start gap-2">
              <h1 className="min-w-0 text-xl font-bold text-slate-100 sm:text-2xl">
                {workspace.chapter.title}
              </h1>
              <button
                type="button"
                onClick={onEdit}
                className="mt-0.5 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label="Chỉnh sửa Chapter"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <PipelineBadge label="Draft" status="completed" />
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              <PipelineBadge label="Analyzed" status={pipelineBadge.analysis} />
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              <PipelineBadge label="Visual Ready" status={pipelineBadge.visual} />
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              <PipelineBadge label="Rendered" status={pipelineBadge.render} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:min-w-[370px]">
          <StatCard label="Scenes" value={String(workspace.summary.sceneCount)} />
          <StatCard label="Visual Beats" value={String(workspace.summary.visualBeatCount)} />
          <StatCard
            label="Thời lượng dự kiến"
            value={formatDuration(workspace.summary.estimatedDurationSeconds)}
          />
        </div>

        <button
          type="button"
          disabled={!workspace.capabilities.canRender}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:bg-orange-900/40 disabled:text-orange-300/50"
          title={workspace.capabilities.canRender ? "Render Chapter" : "Render chưa khả dụng"}
          aria-label="Render Chapter"
        >
          <Film className="h-4 w-4" />
          Render Chapter
        </button>
      </div>
    </section>
  );
}

function PipelineBadge({
  label,
  status,
}: {
  label: string;
  status: "completed" | "active" | "pending";
}) {
  const styles = {
    completed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    active: "bg-orange-500/15 text-orange-200 border-orange-500/40 animate-pulse",
    pending: "bg-slate-900 text-slate-500 border-slate-800",
  }[status];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium ${styles}`}>
      {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-panel p-3 text-center">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-base font-bold text-slate-100">{value}</p>
    </div>
  );
}

function derivePipelineBadge(
  workspace: ApiChapterWorkspace,
  analysisActive: boolean,
): {
  analysis: "completed" | "active" | "pending";
  visual: "completed" | "active" | "pending";
  render: "completed" | "active" | "pending";
} {
  const analysisStatus = workspace.pipeline.analysis.status;
  const visualStatus =
    workspace.pipeline.visualGeneration.completed > 0
      ? workspace.pipeline.visualGeneration.completed === workspace.pipeline.visualGeneration.total
        ? "completed"
        : "active"
      : workspace.pipeline.visualPlanning.status === "COMPLETED"
        ? "active"
        : "pending";
  const renderStatus =
    workspace.pipeline.render.status === "COMPLETED"
      ? "completed"
      : workspace.pipeline.render.status === "RUNNING"
        ? "active"
        : "pending";

  if (analysisActive || analysisStatus === "RUNNING") {
    return { analysis: "active", visual: "pending", render: "pending" };
  }

  return {
    analysis: analysisStatus === "COMPLETED" ? "completed" : "pending",
    visual: visualStatus,
    render: renderStatus,
  };
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
