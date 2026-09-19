import { Layers3, Play } from "lucide-react";
import type { DesktopProject } from "@narrativex/client-contracts";

export function ProjectCard({ project, onOpen }: Readonly<{ project: DesktopProject; onOpen: () => void }>) {
  return (
    <button
      type="button"
      className="group flex w-full flex-col rounded-xl border border-border bg-surface-card p-4 text-left text-inherit transition-all duration-200 hover:border-primary/40 hover:bg-surface-2 hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      onClick={onOpen}
    >
      {/* Cinema Slate Preview Box */}
      <div className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-dark">
        {/* Subtle studio gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-dark/95 via-surface-dark/40 to-surface-3/30" />

        {/* Center play icon button on hover */}
        <div className="relative flex size-12 items-center justify-center rounded-full border border-border-subtle bg-surface-2/85 text-text-muted shadow-md transition-all duration-200 group-hover:scale-110 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
          <Play size={18} className="ml-0.5 fill-current" />
        </div>

        {/* Aspect Ratio Badge */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
          <span className="rounded border border-border-subtle bg-surface-dark/90 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-text-secondary backdrop-blur-xs">
            {project.imageAspectRatio ?? "16:9"}
          </span>
        </div>
      </div>

      {/* Project Details */}
      <div className="mt-3.5 flex min-w-0 flex-1 flex-col">
        <strong className="truncate text-[16px] font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
          {project.name}
        </strong>

        <p className="mt-1.5 line-clamp-2 min-h-[38px] text-[13px] leading-relaxed text-text-muted">
          {project.description || "Chưa có mô tả project."}
        </p>
      </div>

      {/* Metadata Footer */}
      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-border-subtle pt-3 text-[12px] text-text-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-success">
          <span className="size-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
          {project.status || "Ready"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-text-secondary font-medium">
          <Layers3 size={13} aria-hidden="true" className="text-text-muted" />
          {project.metrics?.totalChapters ?? 0} chapters
        </span>
      </div>
    </button>
  );
}
