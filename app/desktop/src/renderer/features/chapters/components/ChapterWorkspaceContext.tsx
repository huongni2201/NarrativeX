import type { ReactNode } from "react";
import type { DesktopChapterWorkspace } from "@narrativex/client-contracts";
import { Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InlineNotice,
  PaneHeader,
  PropertyRow,
  StatusIndicator,
  WorkspacePane,
} from "../../workspace/components/WorkstationPrimitives";
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
  const renderStatus = selectedWorkspace
    ? pipelineStatusLabel(selectedWorkspace.pipeline.render.status)
    : selectedWorkspaceError
      ? "Không tải được"
      : selected
        ? "Đang tải…"
        : "Chưa chọn";

  return (
    <WorkspacePane className="flex flex-col bg-surface-panel">
      <PaneHeader title="Context" meta={projectName} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <InspectorSection title="Project">
          <PropertyRow label="Project" value={<span className="block truncate">{projectName}</span>} />
          <PropertyRow label="Chapters" value={metrics.chapters} />
          <PropertyRow label="Words" value={`${metrics.words.toLocaleString("vi-VN")} từ`} />
        </InspectorSection>

        <InspectorSection title="Production readiness">
          <PropertyRow label="Scenes" value={metrics.scenes ?? "—"} />
          <PropertyRow label="Visual beats" value={metrics.beats ?? "—"} />
          <PropertyRow label="Audio ready" value={metrics.audioReady ?? "—"} />
          <PropertyRow label="Render ready" value={metrics.renderReady ?? "—"} />
        </InspectorSection>

        <InspectorSection title="Render">
          <PropertyRow
            label="Status"
            value={
              <StatusIndicator
                label={renderStatus}
                tone={selectedWorkspace?.pipeline.render.status === "COMPLETED" ? "success" : selectedWorkspaceError ? "danger" : "neutral"}
                className="justify-end"
              />
            }
          />
          <PropertyRow
            label="Latest job"
            value={
              <span className="block truncate font-mono text-[9px]">
                {selectedWorkspace?.pipeline.render.latestJobId ?? "—"}
              </span>
            }
          />
          <div className="p-2.5">
            <Button variant="outline" size="sm" onClick={onOpenRender} className="w-full">
              <Clapperboard size={12} /> Open Render Queue
            </Button>
          </div>
        </InspectorSection>

        <InlineNotice className="mx-3 my-3">
          Lưu chapter trước khi chạy AI/media. Narration tiếp tục là master clock của timeline render.
        </InlineNotice>
      </div>
    </WorkspacePane>
  );
}

function InspectorSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="border-b border-border-subtle">
      <div className="bg-surface-dark px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-text-dim">
        {title}
      </div>
      {children}
    </section>
  );
}
