import { ArrowRight, Layers3 } from "lucide-react";
import type { DesktopProject } from "../../../../shared/api-types";
import { resolveProjectContinuation } from "../model/project-continuation";

const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "Bản nháp",
  ACTIVE: "Đang thực hiện",
  ARCHIVED: "Đã lưu trữ",
};

/** "9:16" -> 0.5625. Falls back to landscape when the ratio is unparseable. */
function aspectValue(ratio: string): number {
  const [w, h] = ratio.split(":").map(Number);
  return w > 0 && h > 0 ? w / h : 16 / 9;
}

export function ProjectCard({ project, onOpen }: Readonly<{ project: DesktopProject; onOpen: () => void }>) {
  const continuation = resolveProjectContinuation(project);
  const ratio = project.imageAspectRatio ?? "16:9";
  const isActive = project.status === "ACTIVE";

  return (
    <button
      type="button"
      className="group flex w-full cursor-pointer flex-col rounded-xl border border-border bg-surface-card p-4 text-left text-inherit shadow-[var(--shadow-card)] transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-surface-2 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
    >
      {/* The frame is drawn at the project's own aspect ratio, so the format
          is visible at a glance. */}
      <div className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-dark">
        <div
          className="flex h-[68%] items-center justify-center rounded-md border border-dashed border-border-dark bg-surface-3/60 transition-colors duration-200 group-hover:border-primary/60 group-hover:bg-primary-muted"
          style={{ aspectRatio: aspectValue(ratio) }}
        >
          <span className="font-mono text-label font-medium text-text-secondary">{ratio}</span>
        </div>
      </div>

      <div className="mt-3.5 flex min-w-0 flex-1 flex-col">
        <strong className="truncate text-[15px] font-semibold tracking-tight text-foreground">
          {project.name}
        </strong>
        <p className="mt-1.5 line-clamp-2 min-h-[44px] text-body text-text-muted">
          {project.description || "Chưa có mô tả."}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-label text-text-muted">
        <span className="inline-flex items-center gap-1.5 font-medium text-text-secondary">
          <span
            className={`size-2 rounded-full ${isActive ? "bg-success nx-dot-live" : "bg-text-dim"}`}
            aria-hidden="true"
          />
          {STATUS_LABELS[project.status] ?? project.status}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Layers3 size={14} aria-hidden="true" />
          {project.metrics?.totalChapters ?? 0} chapter
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 text-body font-medium text-primary">
        <span>{continuation.label}</span>
        <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
      </div>
    </button>
  );
}
