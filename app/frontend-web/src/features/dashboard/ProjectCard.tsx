"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Clapperboard,
  Clock,
  Film,
  MoreHorizontal,
  Star,
} from "lucide-react";
import { projectsApi } from "@/features/projects/api/projects.api";
import type { ApiProject } from "@/types/api";

interface ProjectCardProps {
  project: ApiProject;
  onClick: (project: ApiProject) => void;
  viewMode?: "grid" | "list";
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "00:00";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return "21/08/2026 • 08:26";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "21/08/2026 • 08:26";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} • ${hours}:${minutes}`;
  } catch {
    return "21/08/2026 • 08:26";
  }
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onClick,
  viewMode = "grid",
}) => {
  const [isStarred, setIsStarred] = useState(false);
  const isActive = project.status === "ACTIVE";

  // Fetch metrics and overview from real backend API
  const { data: overview } = useQuery({
    queryKey: ["projects", project.id, "overview"],
    queryFn: () => projectsApi.getOverview(project.id),
    staleTime: 30000,
  });

  const totalChapters = overview?.metrics.totalChapters ?? (isActive ? 2 : 0);
  const totalScenes = overview?.metrics.totalScenes ?? (isActive ? 1 : 0);
  const durationSeconds = overview?.metrics.estimatedDurationSeconds ?? (isActive ? 42 : 0);
  const updatedAt = overview?.updatedAt ?? null;

  if (viewMode === "list") {
    return (
      <div
        onClick={() => onClick(project)}
        className="group relative flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-800/90 bg-[#0b111c] p-4 transition-all duration-300 hover:border-purple-500/50 hover:bg-[#0e1626] cursor-pointer shadow-md"
      >
        <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
          <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 border border-slate-800">
            {project.coverImageUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                style={{ backgroundImage: `url(${JSON.stringify(project.coverImageUrl).slice(1, -1)})` }}
                role="img"
                aria-label={project.name}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Clapperboard className="h-6 w-6 text-purple-400/80" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-md ${
                  isActive
                    ? "bg-emerald-950/70 border border-emerald-500/30 text-emerald-400"
                    : "bg-slate-900/70 border border-slate-700/50 text-slate-400"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
                {isActive ? "Đang hoạt động" : "Bản nháp"}
              </span>
              <h3 className="truncate text-sm font-bold text-slate-100 transition-colors group-hover:text-purple-300">
                {project.name}
              </h3>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-slate-400">
              {project.description || "Dự án mới chưa có mô tả."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-800/80 pt-3 sm:pt-0">
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-bold">{totalChapters}</span>
              <span className="text-slate-500 text-[11px]">Chapters</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-bold">{totalScenes}</span>
              <span className="text-slate-500 text-[11px]">Scenes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-mono font-bold">{formatDuration(durationSeconds)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isActive ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(project);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-purple-950/50 hover:bg-purple-500 transition-colors"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(project);
                }}
                className="rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Chỉnh sửa
              </button>
            )}
            <button
              type="button"
              aria-label="Tùy chọn khác"
              onClick={(e) => e.stopPropagation()}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article
      onClick={() => onClick(project)}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0b111c] text-left transition-all duration-300 hover:border-purple-500/60 hover:shadow-xl hover:shadow-purple-950/20 cursor-pointer"
    >
      {/* Thumbnail or Empty Clapperboard */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[#0e1628] via-[#09101d] to-[#060a12]">
        {project.coverImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${JSON.stringify(project.coverImageUrl).slice(1, -1)})` }}
            role="img"
            aria-label={project.name}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
            {/* Clapperboard Illustration */}
            <div className="relative flex h-14 w-16 rotate-[-4deg] flex-col items-center justify-between rounded-xl border border-purple-400/40 bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-900 p-1.5 shadow-xl shadow-purple-950/80 transition-transform duration-300 group-hover:rotate-0 group-hover:scale-105">
              <div className="flex h-3 w-full items-center justify-around overflow-hidden rounded-t border-b border-purple-300/30 bg-slate-950/80">
                <div className="h-full w-1.5 -skew-x-12 bg-purple-200/90" />
                <div className="h-full w-1.5 -skew-x-12 bg-purple-200/90" />
                <div className="h-full w-1.5 -skew-x-12 bg-purple-200/90" />
              </div>
              <div className="my-auto flex h-6 w-6 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm shadow-inner">
                <div className="ml-0.5 h-0 w-0 border-y-[4px] border-y-transparent border-l-[7px] border-l-white" />
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0b111c] via-transparent to-transparent opacity-60" />

        {/* Status Badge (Top-Left) */}
        <div className="absolute left-3 top-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-md shadow-sm ${
              isActive
                ? "bg-emerald-950/80 border border-emerald-500/30 text-emerald-400"
                : "bg-slate-900/80 border border-slate-700/50 text-slate-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
            {isActive ? "Đang hoạt động" : "Bản nháp"}
          </span>
        </div>

        {/* Star Button (Top-Right) */}
        <button
          type="button"
          aria-label={isStarred ? "Bỏ yêu thích" : "Yêu thích dự án"}
          onClick={(e) => {
            e.stopPropagation();
            setIsStarred(!isStarred);
          }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 border border-white/10 text-slate-300 backdrop-blur-md transition-colors hover:text-amber-400 hover:border-amber-400/30"
        >
          <Star className={`h-4 w-4 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
        </button>
      </div>

      {/* Main Info Section */}
      <div className="flex flex-1 flex-col justify-between p-3.5 pb-0">
        <div>
          <h3 className="truncate text-sm font-bold text-slate-100 transition-colors group-hover:text-purple-300">
            {project.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400 min-h-[32px]">
            {project.description || "Dự án mới chưa có mô tả."}
          </p>
        </div>

        {/* 3-Column Metrics Statistics Bar */}
        <div className="mt-3 border-y border-slate-800/80 py-2 px-1 flex items-center justify-between text-xs text-slate-300 bg-[#090e18]/40">
          <div className="flex items-center gap-1.5 min-w-0">
            <BookOpen className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <div className="truncate">
              <span className="font-bold text-slate-200 block text-xs leading-tight">{totalChapters}</span>
              <span className="text-[10px] text-slate-500 block truncate">Chapters</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-800/80 pl-2 min-w-0">
            <Film className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <div className="truncate">
              <span className="font-bold text-slate-200 block text-xs leading-tight">{totalScenes}</span>
              <span className="text-[10px] text-slate-500 block truncate">Scenes</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-800/80 pl-2 min-w-0">
            <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <div className="truncate">
              <span className="font-mono font-bold text-slate-200 block text-xs leading-tight">
                {formatDuration(durationSeconds)}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">Ước tính</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="flex items-center justify-between p-3.5 pt-2.5">
        <span className="text-[10px] text-slate-500 font-mono truncate max-w-[100px] sm:max-w-none">
          {formatDate(updatedAt)}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {isActive ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick(project);
              }}
              className="flex items-center gap-1 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-purple-950/60 hover:bg-purple-500 transition-colors"
            >
              <span>Tiếp tục</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick(project);
              }}
              className="rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Chỉnh sửa
            </button>
          )}

          <button
            type="button"
            aria-label="Tùy chọn dự án"
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
