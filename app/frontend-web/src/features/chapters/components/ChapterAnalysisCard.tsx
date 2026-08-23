import { Pencil } from "lucide-react";
import type { ApiChapterWorkspace } from "@/types/api";

interface ChapterAnalysisCardProps {
  workspace: ApiChapterWorkspace;
  onEdit: () => void;
}

export function ChapterAnalysisCard({ workspace, onEdit }: Readonly<ChapterAnalysisCardProps>) {
  return (
    <section className="rounded-2xl border border-border bg-surface-card/90 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-100">Nội dung Chapter</h2>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-dark px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <Pencil className="h-3.5 w-3.5" />
          Chỉnh sửa
        </button>
      </div>
      <p className="mt-3 max-h-36 overflow-hidden whitespace-pre-wrap rounded-xl border border-border bg-surface-panel px-4 py-3.5 text-base leading-7 text-slate-300">
        {workspace.chapter.sourceText || "Chapter chưa có nội dung."}
      </p>
    </section>
  );
}
