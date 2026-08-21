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
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface-card p-6 shadow-2xl lg:flex-row">
      {/* Left: Project Cover Thumbnail */}
      <div className="group relative aspect-[16/11] w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-xl lg:aspect-[4/3] lg:w-80 xl:w-96">
        {project.coverImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${JSON.stringify(project.coverImageUrl).slice(1, -1)})` }}
            role="img"
            aria-label={project.name}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
            <Film className="h-16 w-16 text-text-muted" aria-hidden="true" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

        {/* Status Badge (Top-Left) */}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
              isActive
                ? "border-success/40 bg-success-bg text-success"
                : "border-border bg-surface-card text-text-muted"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-success" : "bg-text-muted"}`} />
            {isActive ? "Đang hoạt động" : "Bản nháp"}
          </span>
        </div>

        {/* Change Cover Button (Bottom-Right) */}
        <button
          type="button"
          onClick={onOpenInfo}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
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
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
              >
                <Info className="h-4 w-4 text-slate-400" />
                <span>Chi tiết dự án</span>
              </button>

              <button
                type="button"
                onClick={onContinue}
                aria-label={continueChapter ? "Tiếp tục Chapter hiện tại" : "Tạo Chapter đầu tiên"}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>Tiếp tục dự án</span>
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
                className="h-full rounded-full bg-primary transition-[width] duration-500"
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
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-panel p-3 shadow-inner">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-primary-muted">
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
