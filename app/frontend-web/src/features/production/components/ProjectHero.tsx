"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Clock,
  Film,
  Image as ImageIcon,
  Info,
  Play,
  Sparkles,
  Star,
} from "lucide-react";
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
  const [isStarred, setIsStarred] = useState(false);
  const isActive = project.status === "ACTIVE";

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 shadow-2xl">
      {/* Left: Project Cover Thumbnail */}
      <div className="relative w-full lg:w-80 xl:w-96 aspect-[16/11] lg:aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 shadow-xl group">
        {project.coverImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${JSON.stringify(project.coverImageUrl).slice(1, -1)})` }}
            role="img"
            aria-label={project.name}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950">
            <Film className="h-16 w-16 text-purple-400/40" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

        {/* Status Badge (Top-Left) */}
        <div className="absolute top-3 left-3">
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

        {/* Change Cover Button (Bottom-Right) */}
        <button
          type="button"
          onClick={onOpenInfo}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-medium text-slate-200 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <span>Đổi ảnh bìa</span>
        </button>
      </div>

      {/* Right: Project Meta & Statistics */}
      <div className="flex min-w-0 flex-1 flex-col justify-between space-y-4">
        <div>
          {/* Title and Action Buttons Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="truncate text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {project.name}
              </h1>
              <button
                type="button"
                aria-label={isStarred ? "Bỏ yêu thích" : "Yêu thích dự án"}
                onClick={() => setIsStarred(!isStarred)}
                className="text-slate-400 hover:text-amber-400 transition-colors shrink-0"
              >
                <Star className={`h-5 w-5 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onOpenInfo}
                className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700/80 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors"
              >
                <Info className="h-4 w-4 text-slate-400" />
                <span>Chi tiết dự án</span>
              </button>

              <button
                type="button"
                onClick={onContinue}
                aria-label={continueChapter ? "Tiếp tục Chapter hiện tại" : "Tạo Chapter đầu tiên"}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/60 transition-all hover:from-purple-500 hover:to-indigo-500 hover:shadow-purple-700/30"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>Continue Project</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-3xl line-clamp-2">
            {project.description || "Dự án sáng tạo video tự động từ kịch bản phân cảnh AI."}
          </p>

          {/* Date Meta */}
          <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
            <span>Tạo ngày: {formatDate(project.createdAt)}</span>
            <span>•</span>
            <span>Cập nhật: {formatDate(project.updatedAt)}</span>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<BookOpen className="h-4 w-4 text-purple-400" />}
            value={metrics.totalChapters}
            label="Chapters"
          />
          <StatCard
            icon={<Film className="h-4 w-4 text-indigo-400" />}
            value={metrics.totalScenes}
            label="Scene"
          />
          <StatCard
            icon={<Clock className="h-4 w-4 text-cyan-400" />}
            value={formatDuration(metrics.estimatedDurationSeconds)}
            label="Thời lượng"
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4 text-pink-400" />}
            value={metrics.approvedVisuals}
            label="Visual đã duyệt"
          />
        </div>

        {/* Progress Bar & Sub-metrics */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300 shrink-0">Tiến độ tổng thể</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800/90">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-400 transition-all duration-500 shadow-sm shadow-purple-500/50"
                style={{ width: `${Math.max(0, Math.min(metrics.overallProgress, 100))}%` }}
              />
            </div>
            <span className="font-mono text-xs font-bold text-purple-300 shrink-0">
              {metrics.overallProgress}%
            </span>
          </div>

          {/* 4 Progress Badges */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <span className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-400">
              <span className="font-bold">{metrics.readyChapters}/{metrics.totalChapters}</span> Chapters ready
            </span>
            <span className="rounded-xl border border-amber-500/20 bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-400">
              <span className="font-bold">{metrics.renderedChapters}/{metrics.totalChapters}</span> Chapters rendered
            </span>
            <span className="rounded-xl border border-blue-500/20 bg-blue-950/40 px-3 py-1 text-xs font-medium text-blue-400">
              <span className="font-bold">{metrics.processingJobs}</span> Đang xử lý
            </span>
            <span className="rounded-xl border border-purple-500/20 bg-purple-950/40 px-3 py-1 text-xs font-medium text-purple-300">
              ~{formatMinutes(metrics.estimatedDurationSeconds)} Thời lượng dự kiến
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-[#090e18]/80 p-3 shadow-inner">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
        {icon}
      </div>
      <div className="min-w-0">
        <span className="block font-mono text-base font-bold text-white leading-tight">
          {value}
        </span>
        <span className="block text-[11px] text-slate-400 truncate">{label}</span>
      </div>
    </div>
  );
}
