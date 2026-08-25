import { FolderOpen, Layers3 } from "lucide-react";
import type { DesktopProject } from "@narrativex/client-contracts";
import { cn } from "@/lib/utils";

export function ProjectCard({ project, onOpen }: Readonly<{ project: DesktopProject; onOpen: () => void }>) {
  return (
    <button type="button" className={cn("group grid min-h-[150px] w-full grid-cols-[38px_1fr] gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-[17px] text-left text-inherit transition-colors hover:border-[var(--orange)] hover:bg-[var(--surface-2)]")} onClick={onOpen}>
      <div className="grid size-9 place-items-center rounded-lg bg-[var(--orange-soft)] text-[var(--orange-bright)]"><FolderOpen size={20} /></div>
      <div className="grid min-w-0 content-start gap-2">
        <strong className="truncate text-sm text-[var(--text)]">{project.name}</strong>
        <span className="line-clamp-2 text-[10px] leading-[1.5] text-[var(--text-3)]">{project.description || "Chưa có mô tả project."}</span>
      </div>
      <div className="col-span-full mt-3 flex justify-between gap-2 text-[10px] text-[var(--text-3)]"><span>{project.status}</span><span className="inline-flex items-center gap-1"><Layers3 size={13} /> {project.metrics?.totalChapters ?? 0} chapters</span></div>
    </button>
  );
}
