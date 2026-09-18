import { Layers3, Play } from "lucide-react";
import type { DesktopProject } from "@narrativex/client-contracts";

export function ProjectCard({ project, onOpen }: Readonly<{ project: DesktopProject; onOpen: () => void }>) {
  return (
    <button
      type="button"
      className="group flex w-full flex-col rounded-lg border border-border bg-surface-card p-3 text-left text-inherit transition-all duration-150 hover:border-border-dark hover:bg-surface-2 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      onClick={onOpen}
    >
      {/* Cinema Slate Preview Box */}
      <div className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-surface-dark">
        {/* Subtle studio gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-dark/95 via-surface-dark/40 to-surface-3/30" />

        {/* Center play icon button on hover */}
        <div className="relative flex size-10 items-center justify-center rounded-full border border-border-subtle bg-surface-2/80 text-text-muted shadow-sm transition-all duration-200 group-hover:scale-110 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
          <Play size={15} className="ml-0.5 fill-current" />
        </div>

        {/* Aspect Ratio Badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <span className="rounded border border-border-subtle bg-surface-dark/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-text-secondary backdrop-blur-xs">
            {project.imageAspectRatio ?? "16:9"}
          </span>
        </div>
      </div>

      {/* Project Details */}
      <div className="mt-3 flex min-w-0 flex-1 flex-col">
        <strong className="truncate text-[13px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
          {project.name}
        </strong>

        <p className="mt-1 line-clamp-2 min-h-[32px] text-[11px] leading-relaxed text-text-muted">
          {project.description || "Chưa có mô tả project."}
        </p>
      </div>

      {/* Metadata Footer */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border-subtle pt-2.5 text-[10px] text-text-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          {project.status || "Ready"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <Layers3 size={11} aria-hidden="true" className="text-text-muted" />
          {project.metrics?.totalChapters ?? 0} chapters
        </span>
      </div>
    </button>
  );
}
