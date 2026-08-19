import { FileText, MoreVertical } from "lucide-react";
import type { ProductionChapter } from "../production.types";
import { formatDateTime, formatDuration } from "./production-formatters";

interface ChapterTableProps {
  chapters: readonly ProductionChapter[];
  onOpenChapter: (chapter: ProductionChapter) => void;
}

export function ChapterTable({ chapters, onOpenChapter }: Readonly<ChapterTableProps>) {
  if (chapters.length === 0) {
    return (
      <div className="p-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-slate-600" />
        <h2 className="mt-3 text-sm font-semibold text-slate-200">Chưa có Chapter</h2>
        <p className="mt-1 text-xs text-slate-500">
          Thêm Chapter đầu tiên để bắt đầu nhập nội dung truyện và tạo storyboard.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-slate-800 bg-[#090e18] font-bold uppercase tracking-wide text-slate-200">
          <tr>
            <th className="w-12 px-4 py-4 text-center">#</th>
            <th className="px-4 py-4">Chapter</th>
            <th className="px-4 py-4">Trạng thái</th>
            <th className="px-4 py-4 text-center">Scenes</th>
            <th className="px-4 py-4">Thời lượng</th>
            <th className="px-4 py-4">Cập nhật lần cuối</th>
            <th className="px-4 py-4 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 font-medium">
          {chapters.map((chapter, index) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              displayNumber={index + 1}
              onOpen={() => onOpenChapter(chapter)}
            />
          ))}
        </tbody>
      </table>
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
      className="group cursor-pointer bg-[#0d1420] font-medium text-slate-200 transition hover:bg-[#111a29]"
    >
      <td className="px-4 py-5 text-center font-mono text-slate-300">{String(displayNumber).padStart(2, "0")}</td>
      <td className="px-4 py-5 text-sm font-semibold text-slate-200 transition-colors group-hover:text-purple-300">
        {"Chương " + (chapter.orderIndex + 1) + ": " + chapter.title}
      </td>
      <td className="px-4 py-5"><OverviewStatusBadge status={chapter.status} /></td>
      <td className="px-4 py-5 text-center font-mono text-slate-200">{chapter.sceneCount}</td>
      <td className="px-4 py-5 font-mono text-slate-300">{formatDuration(chapter.durationSeconds)}</td>
      <td className="px-4 py-5 font-mono text-sm text-slate-300">{formatDateTime(chapter.updatedAt)}</td>
      <td className="px-4 py-5 text-right">
        <button
          type="button"
          aria-label={`Mở Chapter ${chapter.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="rounded p-1 text-slate-400 transition-colors hover:text-slate-200"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function OverviewStatusBadge({ status }: Readonly<{ status: string }>) {
  const normalized = status.toUpperCase();
  const styles = {
    RENDERED: "border-emerald-600/50 bg-emerald-950/80 text-emerald-300",
    VISUAL_REVIEW: "border-purple-600/50 bg-purple-950/80 text-purple-300",
    IN_REVIEW: "border-purple-600/50 bg-purple-950/80 text-purple-300",
    ANALYZED: "border-blue-600/50 bg-blue-950/80 text-blue-300",
    ANALYZING: "animate-pulse border-purple-500 bg-purple-950/90 text-purple-200",
    IN_PROGRESS: "animate-pulse border-purple-500 bg-purple-950/90 text-purple-200",
    DRAFT: "border-amber-600/50 bg-amber-950/80 text-amber-300",
    FAILED: "border-rose-600/50 bg-rose-950/80 text-rose-300",
  } as const;
  const style = styles[normalized as keyof typeof styles] ?? "border-slate-700 bg-slate-900 text-slate-400";
  return (
    <span className={`inline-flex rounded border px-2.5 py-1 text-xs font-bold ${style}`}>
      {normalized === "RENDERED"
        ? "Rendered"
        : normalized === "VISUAL_REVIEW" || normalized === "IN_REVIEW"
          ? "Visual Review"
          : normalized === "ANALYZED"
            ? "Analyzed"
            : normalized === "ANALYZING" || normalized === "IN_PROGRESS"
              ? "Analyzing"
              : normalized === "DRAFT"
                ? "Draft"
                : normalized === "FAILED"
                  ? "Failed"
                  : status.replaceAll("_", " ")}
    </span>
  );
}
