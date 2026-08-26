import type { DesktopChapterWorkspace } from "@narrativex/client-contracts";
import { Clapperboard, Folder, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pipelineStatusLabel } from "../model/chapter-ui";

type Metrics = Readonly<{
  chapters: number;
  words: number;
  scenes: number | null;
  beats: number | null;
  audioReady: number | null;
  renderReady: number | null;
}>;

type Props = Readonly<{
  projectName: string;
  selected: boolean;
  selectedWorkspace: DesktopChapterWorkspace | undefined;
  selectedWorkspaceError: boolean;
  metrics: Metrics;
  onOpenRender: () => void;
}>;

export function ChapterWorkspaceContext({
  projectName,
  selected,
  selectedWorkspace,
  selectedWorkspaceError,
  metrics,
  onOpenRender,
}: Props) {
  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-surface-panel shadow-[var(--shadow-panel)]">
      <div className="space-y-3 border-b border-border p-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            WORKSPACE CONTEXT
          </span>
          <div className="mt-1 flex items-center gap-2">
            <Folder className="text-primary-hover" size={16} />
            <h2 className="text-sm font-bold text-foreground">Chapters</h2>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-text-muted">Project</span>
          <div className="flex h-8 items-center justify-between rounded-md border border-border bg-surface-input px-3 text-xs text-foreground">
            <span className="truncate">{projectName}</span>
          </div>
        </div>

        <div className="space-y-2 pt-1 text-xs">
          <Metric label="Tổng chapter" value={metrics.chapters} />
          <Metric label="Tổng từ" value={`${metrics.words.toLocaleString("vi-VN")} từ`} />
          <Metric label="Tổng scene" value={metrics.scenes ?? "—"} />
          <Metric label="Tổng visual beat" value={metrics.beats ?? "—"} />
          <Metric label="Audio sẵn sàng" value={metrics.audioReady ?? "—"} />
          <Metric label="Chapter sẵn sàng render" value={metrics.renderReady ?? "—"} />
        </div>
      </div>

      <div className="flex-1 space-y-3 p-4">
        <div className="rounded-md border border-warning/20 bg-warning-bg p-3 text-xs leading-relaxed text-text-secondary">
          <div className="flex items-center gap-1.5 font-bold text-warning">
            <Lightbulb size={14} />
            <span>Mẹo nhanh</span>
          </div>
          <ul className="mt-2 space-y-2 text-[11px] text-text-secondary">
            <li>• Lưu chapter trước khi chạy tác vụ AI/media.</li>
            <li>• Status filter chỉ tải toàn bộ workspace khi bạn thực sự dùng bộ lọc đó.</li>
            <li>• Narration là master clock cho timeline render.</li>
          </ul>
        </div>

        <div className="space-y-2.5 rounded-md border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
                RENDER STATUS
              </span>
              <h3 className="mt-0.5 text-xs font-bold text-foreground">Production render</h3>
            </div>
            <span className="rounded bg-surface-3 px-2 py-1 text-[10px] font-bold text-text-muted">
              {selectedWorkspace
                ? pipelineStatusLabel(selectedWorkspace.pipeline.render.status)
                : selectedWorkspaceError
                  ? "Không tải được"
                  : selected
                    ? "Đang tải…"
                    : "Chưa chọn"}
            </span>
          </div>

          <p className="text-xs text-text-muted">
            {selectedWorkspace?.pipeline.render.latestJobId
              ? `Job: ${selectedWorkspace.pipeline.render.latestJobId}`
              : selected
                ? "Chapter này chưa có render job."
                : "Chọn một chapter để xem trạng thái render."}
          </p>

          <Button
            variant="outline"
            onClick={onOpenRender}
            className="h-8 w-full gap-1.5 border-border bg-surface-input text-xs text-text-secondary hover:border-primary/50 hover:text-foreground"
          >
            <Clapperboard size={12} />
            <span>Open Render Queue</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return (
    <div className="flex items-center justify-between gap-3 text-text-secondary">
      <span>{label}</span>
      <strong className="shrink-0 font-mono text-foreground">{value}</strong>
    </div>
  );
}
