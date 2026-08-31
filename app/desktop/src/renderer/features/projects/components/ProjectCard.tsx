import { FolderOpen, Layers3 } from "lucide-react";
import type { DesktopProject } from "@narrativex/client-contracts";

export function ProjectCard({ project, onOpen }: Readonly<{ project: DesktopProject; onOpen: () => void }>) {
  return (
    <button
      type="button"
      className="group grid min-h-36 w-full grid-cols-[24px_minmax(0,1fr)] gap-x-2.5 gap-y-3 rounded-md border border-border bg-surface-card p-3 pr-20 text-left text-inherit transition-[background-color,border-color] duration-150 hover:border-border-dark hover:bg-surface-2"
      onClick={onOpen}
    >
      <div className="grid size-6 place-items-center self-center text-text-muted transition-colors group-hover:text-primary">
        <FolderOpen size={16} strokeWidth={1.7} />
      </div>

      <div className="min-w-0 self-center">
        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim">Project</span>
        <strong className="mt-0.5 block truncate text-[12px] font-semibold text-foreground">{project.name}</strong>
      </div>

      <p className="col-span-full line-clamp-2 min-h-8 text-[11px] leading-4 text-text-muted">
        {project.description || "Chưa có mô tả project."}
      </p>

      <div className="col-span-full flex items-center justify-between gap-3 border-t border-border-subtle pt-2 text-[10px] text-text-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          {project.status || "Ready"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Layers3 size={11} aria-hidden="true" />
          {project.metrics?.totalChapters ?? 0} chapters
        </span>
      </div>
    </button>
  );
}
