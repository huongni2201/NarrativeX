import { Play, Settings, Sparkles } from "lucide-react";
import type {
  ProductionChapter,
  ProductionMetrics,
  ProductionProject,
} from "../production.types";
import { formatDate, formatDuration, formatMinutes } from "./production-formatters";

interface ProjectHeroProps {
  project: ProductionProject;
  metrics: ProductionMetrics;
  continueChapter: ProductionChapter | null;
  onContinue: () => void;
  onOpenInfo: () => void;
}

export function ProjectHero({
  project,
  metrics,
  continueChapter,
  onContinue,
  onOpenInfo,
}: Readonly<ProjectHeroProps>) {
  return (
    <div className="flex flex-col gap-6 p-6 md:flex-row">
      <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-xl border border-purple-500/30 bg-slate-950 shadow-[0_0_25px_rgba(124,58,237,0.25)] md:w-56">
        <ProjectCover name={project.name} coverImageUrl={project.coverImageUrl ?? null} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between space-y-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="truncate text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              {project.name}
            </h1>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenInfo}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700/80"
              >
                <Settings className="h-4 w-4 text-slate-300" />
                <span>Chi tiết dự án</span>
              </button>

              <button
                type="button"
                onClick={onContinue}
                aria-label={continueChapter ? "Tiếp tục Chapter hiện tại" : "Tạo Chapter đầu tiên"}
                className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.5)] transition-all hover:bg-purple-500"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>Continue Project</span>
              </button>
            </div>
          </div>

          <p className="max-w-3xl text-sm leading-relaxed text-slate-200 sm:text-base">
            {project.description || "Hành trình sáng tạo video tự động từ kịch bản phân cảnh AI."}
          </p>

          <div className="mt-2.5 flex items-center gap-4 font-mono text-xs text-slate-300 sm:text-sm">
            <span>Tạo: {formatDate(project.createdAt)}</span>
            <span>•</span>
            <span>Cập nhật: {formatDate(project.updatedAt)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-slate-800/80 py-4 sm:grid-cols-4">
          <Metric value={metrics.totalChapters} label="Chapters" />
          <Metric value={formatDuration(metrics.estimatedDurationSeconds)} label="Estimated" />
          <Metric value={metrics.totalScenes} label="Scenes" />
          <Metric value={metrics.approvedVisuals} label="Approved Visuals" accent />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-sm">
            <span className="font-bold text-slate-200">Tiến độ tổng thể</span>
            <span className="text-base font-extrabold text-purple-300">{metrics.overallProgress}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-400 transition-[width] duration-500"
              style={{ width: `${Math.max(0, Math.min(metrics.overallProgress, 100))}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-xs text-slate-300 sm:text-sm">
            <span>{metrics.readyChapters}/{metrics.totalChapters} Chapters ready</span>
            <span>•</span>
            <span>{metrics.renderedChapters}/{metrics.totalChapters} Chapters rendered</span>
            <span>•</span>
            <span className="font-bold text-purple-400">{metrics.processingJobs} Đang xử lý</span>
            <span>•</span>
            <span>~{formatMinutes(metrics.estimatedDurationSeconds)} Thời lượng dự kiến</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  value,
  label,
  accent = false,
}: Readonly<{ value: number | string; label: string; accent?: boolean }>) {
  return (
    <div>
      <div className={`font-mono text-2xl font-extrabold ${accent ? "text-purple-300" : "text-white"}`}>
        {value}
      </div>
      <div className={`text-sm font-medium ${accent ? "text-purple-400" : "text-slate-300"}`}>
        {label}
      </div>
    </div>
  );
}

function ProjectCover({ name, coverImageUrl }: Readonly<{ name: string; coverImageUrl: string | null }>) {
  if (coverImageUrl) {
    return (
      <div
        className="relative h-full w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${coverImageUrl})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col justify-end bg-gradient-to-b from-[#1b1938] via-[#0f1424] to-[#080c16] p-4">
      <div className="absolute inset-0 overflow-hidden opacity-40 mix-blend-screen">
        <svg viewBox="0 0 200 300" className="h-full w-full object-cover">
          <defs>
            <linearGradient id="castleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d="M20 300 L20 220 L40 220 L40 180 L50 180 L50 140 L70 140 L70 110 L90 110 L90 70 L110 70 L110 110 L130 110 L130 140 L150 140 L150 180 L160 180 L160 220 L180 220 L180 300 Z" fill="url(#castleGrad)" />
          <circle cx="100" cy="80" r="40" fill="#c084fc" opacity="0.15" />
          <circle cx="100" cy="80" r="20" fill="#e9d5ff" opacity="0.25" />
        </svg>
      </div>
      <div className="relative z-10 space-y-1">
        <Sparkles className="mb-1 h-5 w-5 text-purple-400" />
        <p className="line-clamp-2 text-xs font-bold text-slate-100">{name}</p>
        <p className="text-[10px] font-medium text-purple-300">NarrativeX Visual</p>
      </div>
    </div>
  );
}
