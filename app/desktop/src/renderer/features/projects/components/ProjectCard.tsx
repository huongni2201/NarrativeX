import { FolderOpen, Layers3 } from "lucide-react";
import type { DesktopProject } from "@narrativex/client-contracts";

export function ProjectCard({ project, onOpen }: Readonly<{ project: DesktopProject; onOpen: () => void }>) {
  return (
    <button
      type="button"
      className="group grid min-h-36 w-full grid-cols-[34px_minmax(0,1fr)] gap-x-2 gap-y-3 rounded-md border border-border bg-surface-card p-3 pr-20 text-left text-inherit transition-colors hover:border-primary/35 hover:bg-surface-2"
      onClick={onOpen}
    >
      <div className="grid size-[34px] place-items-center rounded-sm border border-primary/20 bg-primary-muted text-primary-hover">
        <FolderOpen size={16} strokeWidth={1.8} />
      </div>

      <div className="min-w-0 self-center">
        <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-text-dim">Project</span>
        <strong className="mt-0.5 block truncate text-[11px] font-semibold text-foreground">{project.name}</strong>
      </div>

      <p className="col-span-full line-clamp-2 min-h-8 text-[9px] leading-4 text-text-muted">
        {project.description || "Chưa có mô tả project."}
      </p>

      <div className="col-span-full flex items-center justify-between gap-3 border-t border-border-subtle pt-2 text-[8px] text-text-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          {project.status || "Ready"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Layers3 size={10} aria-hidden="true" />
          {project.metrics?.totalChapters ?? 0} chapters
        </span>
      </div>
    </button>
  );
}
