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
  if (!totalSeconds || totalSeconds <= 0) return "-";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return "Chưa cập nhật";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Chưa cập nhật";
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "Chưa cập nhật";
  }
}

function formatMetric(value?: number | null): string {
  return value == null ? "-" : String(value);
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

  const totalChapters = overview?.metrics.totalChapters;
  const totalScenes = overview?.metrics.totalScenes;
  const durationSeconds = overview?.metrics.estimatedDurationSeconds;
  const updatedAt = overview?.updatedAt ?? null;

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick(project);
    }
  };

  if (viewMode === "list") {
    return (
      <div
        onClick={() => onClick(project)}
        onKeyDown={handleCardKeyDown}
        role="link"
        tabIndex={0}
        aria-label={`Mở dự án ${project.name}`}
        className="group relative flex cursor-pointer flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-surface-card p-4 shadow-md transition-colors duration-200 hover:border-primary/60 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-row"
      >
        <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
          <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2">
            {project.coverImageUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                style={{ backgroundImage: `url(${JSON.stringify(project.coverImageUrl).slice(1, -1)})` }}
                role="img"
                aria-label={project.name}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Clapperboard className="h-6 w-6 text-text-muted" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                  isActive
                    ? "border-success/40 bg-success-bg text-success"
                    : "border-border bg-surface-2 text-text-muted"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-success" : "bg-text-muted"}`} />
                {isActive ? "Đang hoạt động" : "Bản nháp"}
              </span>
              <h3 className="truncate text-sm font-bold text-text-primary transition-colors group-hover:text-primary-light">
                {project.name}
              </h3>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-text-secondary">
              {project.description || "Dự án mới chưa có mô tả."}
            </p>
          </div>
        </div>

        <div className="flex w-full shrink-0 items-center justify-between gap-6 border-t border-border pt-3 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0">
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-text-muted" />
              <span className="font-bold">{formatMetric(totalChapters)}</span>
              <span className="text-text-muted text-[11px]">Chapters</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5 text-text-muted" />
              <span className="font-bold">{formatMetric(totalScenes)}</span>
              <span className="text-text-muted text-[11px]">Scenes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-text-muted" />
              <span className="font-mono font-bold">{formatDuration(durationSeconds ?? 0)}</span>
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
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
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
                className="rounded-lg border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3"
              >
                Chỉnh sửa
              </button>
            )}
            <button
              type="button"
              aria-label="Tùy chọn khác"
              onClick={(e) => e.stopPropagation()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-muted transition-colors hover:border-border-subtle hover:text-text-primary"
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
      onKeyDown={handleCardKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`Mở dự án ${project.name}`}
      className="group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-surface-card text-left transition-colors duration-200 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Thumbnail or Empty Clapperboard */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
        {project.coverImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${JSON.stringify(project.coverImageUrl).slice(1, -1)})` }}
            role="img"
            aria-label={project.name}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
            <Clapperboard className="h-10 w-10 text-text-muted transition-transform duration-200 group-hover:scale-105" aria-hidden="true" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-surface-card to-transparent opacity-80" />

        {/* Status Badge (Top-Left) */}
        <div className="absolute left-3 top-3">
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

        {/* Star Button (Top-Right) */}
        <button
          type="button"
          aria-label={isStarred ? "Bỏ yêu thích" : "Yêu thích dự án"}
          onClick={(e) => {
            e.stopPropagation();
            setIsStarred(!isStarred);
          }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary transition-colors hover:border-warning/50 hover:text-warning"
        >
          <Star className={`h-4 w-4 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
        </button>
      </div>

      {/* Main Info Section */}
      <div className="flex flex-1 flex-col justify-between p-3.5 pb-0">
        <div>
          <h3 className="truncate text-sm font-bold text-text-primary transition-colors group-hover:text-primary-light">
            {project.name}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-[32px] text-xs leading-relaxed text-text-secondary">
            {project.description || "Dự án mới chưa có mô tả."}
          </p>
        </div>

        {/* 3-Column Metrics Statistics Bar */}
        <div className="mt-3 flex items-center justify-between border-y border-border bg-surface-panel px-1 py-2 text-xs text-text-secondary">
          <div className="flex items-center gap-1.5 min-w-0">
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <div className="truncate">
              <span className="block text-xs font-bold leading-tight text-text-primary">{formatMetric(totalChapters)}</span>
              <span className="block truncate text-[10px] text-text-muted">Chapters</span>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 border-l border-border pl-2">
            <Film className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <div className="truncate">
              <span className="block text-xs font-bold leading-tight text-text-primary">{formatMetric(totalScenes)}</span>
              <span className="block truncate text-[10px] text-text-muted">Scenes</span>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 border-l border-border pl-2">
            <Clock className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <div className="truncate">
              <span className="block text-xs font-mono font-bold leading-tight text-text-primary">
                {formatDuration(durationSeconds ?? 0)}
              </span>
              <span className="block truncate text-[10px] text-text-muted">Ước tính</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="flex items-center justify-between p-3.5 pt-2.5">
        <span className="max-w-[100px] truncate font-mono text-[10px] text-text-muted sm:max-w-none">
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
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
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
              className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3"
            >
              Chỉnh sửa
            </button>
          )}

          <button
            type="button"
            aria-label="Tùy chọn dự án"
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-muted transition-colors hover:border-border-subtle hover:text-text-primary"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
