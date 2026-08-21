"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText, MoreHorizontal } from "lucide-react";
import type { ProductionChapter } from "../production.types";
import { formatDateTime, formatDuration } from "./production-formatters";

interface ChapterTableProps {
  chapters: readonly ProductionChapter[];
  onOpenChapter: (chapter: ProductionChapter) => void;
}

export function ChapterTable({ chapters, onOpenChapter }: Readonly<ChapterTableProps>) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalChapters = chapters.length;
  const totalPages = Math.max(1, Math.ceil(totalChapters / pageSize));

  const startIndex = (currentPage - 1) * pageSize;
  const currentChapters = chapters.slice(startIndex, startIndex + pageSize);

  if (totalChapters === 0) {
    return (
      <div className="p-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-slate-600" />
        <h3 className="mt-3 text-sm font-semibold text-slate-200">Chưa có Chapter</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Thêm Chapter đầu tiên hoặc import từ file văn bản để bắt đầu.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-slate-800 bg-surface-panel/80 font-semibold text-slate-400 text-sm">
            <tr>
              <th className="w-12 px-4 py-3.5 text-center font-mono">#</th>
              <th className="px-4 py-3.5">Tên chapter</th>
              <th className="px-4 py-3.5">Trạng thái</th>
              <th className="px-4 py-3.5 text-center">Scenes</th>
              <th className="px-4 py-3.5">Thời lượng</th>
              <th className="px-4 py-3.5">Cập nhật lần cuối</th>
              <th className="w-16 px-4 py-3.5 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {currentChapters.map((chapter, index) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                displayNumber={startIndex + index + 1}
                onOpen={() => onOpenChapter(chapter)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-3 text-sm text-slate-400">
        <span>
          Hiển thị {startIndex + 1}–{Math.min(startIndex + pageSize, totalChapters)} của {totalChapters} chapter
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Trang trước"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <span className="flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-primary px-2 font-mono text-sm font-bold text-white shadow-sm">
            {currentPage}
          </span>

          <button
            type="button"
            aria-label="Trang sau"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChapterRow({
  chapter,
  displayNumber,
  onOpen,
}: Readonly<{ chapter: ProductionChapter; displayNumber: number; onOpen: () => void }>) {
  return (
    <tr
      onClick={onOpen}
      className="group cursor-pointer bg-surface/70 text-slate-200 transition-colors hover:bg-surface-2"
    >
      <td className="px-4 py-4 text-center font-mono text-slate-400 font-bold text-sm">
        {String(displayNumber).padStart(2, "0")}
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-slate-100 transition-colors group-hover:text-primary-light">
        {"Chương " + (chapter.orderIndex + 1) + ": " + chapter.title}
      </td>
      <td className="px-4 py-4">
        <ChapterStatusBadge status={chapter.status} />
      </td>
      <td className="px-4 py-4 text-center font-mono font-bold text-slate-300 text-sm">
        {chapter.sceneCount}
      </td>
      <td className="px-4 py-4 font-mono text-slate-300 text-sm">
        {formatDuration(chapter.durationSeconds)}
      </td>
      <td className="px-4 py-4 font-mono text-slate-400 text-sm">
        {formatDateTime(chapter.updatedAt)}
      </td>
      <td className="px-4 py-4 text-center">
        <button
          type="button"
          aria-label={`Tùy chọn Chapter ${chapter.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="flex h-7 w-7 mx-auto items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function ChapterStatusBadge({ status }: Readonly<{ status: string }>) {
  const normalized = status.toUpperCase();

  if (normalized === "ANALYZED" || normalized === "VISUAL_READY") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-950/70 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Analyzed
      </span>
    );
  }

  if (normalized === "RENDERED" || normalized === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary-muted px-2.5 py-0.5 text-xs font-semibold text-primary-light">
        <span className="h-1.5 w-1.5 rounded-full bg-primary-light" />
        Rendered
      </span>
    );
  }

  if (normalized === "ANALYZING" || normalized === "IN_PROGRESS") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary-muted px-2.5 py-0.5 text-xs font-semibold text-primary-light">
        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary-light" />
        Analyzing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-950/70 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
      Draft
    </span>
  );
}
