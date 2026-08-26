import { ArrowUpRight, FolderOpen, Layers3 } from "lucide-react";
import type { DesktopProject } from "@narrativex/client-contracts";
import { cn } from "@/lib/utils";

export function ProjectCard({ project, onOpen }: Readonly<{ project: DesktopProject; onOpen: () => void }>) {
  return (
    <button
      type="button"
      className={cn(
        "group grid min-h-[184px] w-full grid-cols-[40px_minmax(0,1fr)_24px] gap-x-3 gap-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4 text-left text-inherit transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--border-glow)] hover:bg-[var(--surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
      )}
      onClick={onOpen}
    >
      <div className="grid size-10 place-items-center rounded-lg border border-[var(--primary-light)] bg-[var(--orange-soft)] text-[var(--orange-bright)]">
        <FolderOpen size={19} strokeWidth={1.8} />
      </div>
      <div className="grid min-w-0 content-start gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[.12em] text-[var(--text-3)]">Project</span>
        <strong className="truncate text-[15px] font-semibold text-[var(--text)]">{project.name}</strong>
      </div>
      <ArrowUpRight size={17} className="mt-1 text-[var(--text-3)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--orange-bright)]" aria-hidden="true" />

      <span className="col-span-full line-clamp-2 min-h-8 text-xs leading-5 text-[var(--text-3)]">
        {project.description || "Chưa có mô tả project."}
      </span>

      <div className="col-span-full flex items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-3 text-[10px] text-[var(--text-3)]">
        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--cyan)]">
          <span className="size-1.5 rounded-full bg-[var(--cyan)]" aria-hidden="true" />
          {project.status || "Ready"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Layers3 size={13} aria-hidden="true" />
          {project.metrics?.totalChapters ?? 0} chapters
        </span>
      </div>
    </button>
  );
}
