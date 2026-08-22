import { ChevronRight } from "lucide-react";
import type { ApiChapterWorkspace } from "@/types/api";

interface ChapterBreadcrumbProps {
  workspace: ApiChapterWorkspace;
  chapterNumber: string;
}

export function ChapterBreadcrumb({ workspace, chapterNumber }: Readonly<ChapterBreadcrumbProps>) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-slate-400">
      <span>Dự án</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      <span className="truncate text-orange-300 font-medium">{workspace.projectName}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      <span className="truncate text-slate-200">
        Chapter {chapterNumber} – {workspace.chapter.title}
      </span>
    </div>
  );
}
