"use client";

import { useState } from "react";
import {
  BarChart2,
  ChevronDown,
  ChevronRight,
  Clock,
  HardDrive,
  Sparkles,
} from "lucide-react";
import type { ProductionMetrics } from "../production.types";
import { formatDuration, formatMinutes } from "./production-formatters";

interface ProjectSummaryWidgetProps {
  metrics: ProductionMetrics;
}

export function ProjectSummaryWidget({ metrics }: Readonly<ProjectSummaryWidgetProps>) {
  const [timeRange, setTimeRange] = useState("7d");
  const overallProgress = Math.max(0, Math.min(metrics.overallProgress ?? 0, 100));

  // Storage calculation placeholder based on project assets / chapters
  const usedStorageGb = "1.2";
  const maxStorageGb = "20";
  const storagePercent = 6;

  return (
    <aside className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0d1420] p-5 shadow-xl">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
          <h3 className="text-sm font-bold text-slate-100">Tổng quan dự án</h3>

          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              aria-label="Khoảng thời gian thống kê"
              className="appearance-none cursor-pointer rounded-lg border border-slate-800 bg-[#090e18] px-2.5 py-1 pr-6 text-xs text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <option value="7d">7 ngày qua</option>
              <option value="30d">30 ngày qua</option>
              <option value="all">Toàn thời gian</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        {/* Metric Items List */}
        <div className="divide-y divide-slate-800/60 text-xs">
          {/* Item 1: Project Duration */}
          <div className="flex items-center justify-between py-3.5">
            <div className="flex items-center gap-2.5 text-slate-300">
              <Clock className="h-4 w-4 text-slate-500" />
              <span>Thời lượng dự án</span>
            </div>
            <div className="font-mono font-bold text-slate-200">
              {formatDuration(metrics.estimatedDurationSeconds)}{" "}
              <span className="font-normal text-slate-500">
                / ~{formatMinutes(metrics.estimatedDurationSeconds)}
              </span>
            </div>
          </div>

          {/* Item 2: Completion Rate with Circular Progress */}
          <div className="flex items-center justify-between py-3.5">
            <div className="flex items-center gap-2.5 text-slate-300">
              <div className="relative flex h-4 w-4 items-center justify-center">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-purple-500/30 border-t-purple-500" />
              </div>
              <span>Mức độ hoàn thành</span>
            </div>

            {/* Circular Progress Badge */}
            <div className="relative flex h-8 w-8 items-center justify-center">
              <svg className="h-8 w-8 -rotate-90 transform" viewBox="0 0 36 36">
                <path
                  className="text-slate-800"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-purple-500 transition-all duration-500"
                  strokeDasharray={`${overallProgress}, 100`}
                  strokeWidth="3"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute font-mono text-[10px] font-bold text-purple-300">
                {overallProgress}%
              </span>
            </div>
          </div>

          {/* Item 3: Approved Visuals */}
          <div className="flex items-center justify-between py-3.5">
            <div className="flex items-center gap-2.5 text-slate-300">
              <Sparkles className="h-4 w-4 text-slate-500" />
              <span>Visual đã duyệt</span>
            </div>
            <span className="font-mono font-bold text-slate-200">
              {metrics.approvedVisuals}
            </span>
          </div>

          {/* Item 4: Storage Usage */}
          <div className="py-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-slate-300">
                <HardDrive className="h-4 w-4 text-slate-500" />
                <span>Dung lượng dự án</span>
              </div>
              <div className="font-mono text-slate-200">
                <span className="font-bold">{usedStorageGb} GB</span>{" "}
                <span className="text-slate-500">/ {maxStorageGb} GB</span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-purple-500"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <button
        type="button"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 py-2.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
      >
        <BarChart2 className="h-4 w-4" />
        <span>Xem báo cáo chi tiết</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </aside>
  );
}
