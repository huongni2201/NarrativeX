import type { ReactNode } from "react";
import type { AutoEditStyle, DesktopTimeline, RenderResolution } from "@narrativex/client-contracts";
import { Film, FolderOpen, HardDrive, Type, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeaturePage } from "../../workspace/components/FeaturePage";
import {
  InlineNotice,
  MetricStrip,
  PaneHeader,
  PropertyRow,
  StatusIndicator,
  WorkspacePane,
} from "../../workspace/components/WorkstationPrimitives";
import type { RenderController } from "../useRenderController";

export function RenderScreen({ timeline, controller }: Readonly<{ timeline: DesktopTimeline | null; controller: RenderController }>) {
  const fitSummary = controller.autoEditPlan
    ? controller.autoEditPlan.decisions.reduce<Record<string, number>>((summary, decision) => {
        summary[decision.fitMode] = (summary[decision.fitMode] ?? 0) + 1;
        return summary;
      }, {})
    : {};

  return (
    <FeaturePage
      title="Auto Edit & Render"
      description="Narration là master clock; local FFmpeg render video final vào thư mục bạn chọn."
      contentClassName="min-h-0 overflow-hidden bg-background p-0"
    >
      <div className="grid h-full min-h-0 grid-cols-[minmax(250px,288px)_minmax(0,1fr)] overflow-hidden">
        <WorkspacePane className="flex flex-col border-r border-border-subtle bg-surface-panel">
          <PaneHeader title="Render Settings" meta={controller.canRender ? "Ready to finish" : "Review blockers"} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <section className="border-b border-border-subtle p-3">
              <label className="grid gap-1 text-[10px] text-text-muted">
                Edit style
                <Select value={controller.autoEditStyle} onValueChange={(value) => controller.setAutoEditStyle(value as AutoEditStyle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto · Recommended</SelectItem>
                    <SelectItem value="CINEMATIC">Cinematic</SelectItem>
                    <SelectItem value="BALANCED">Balanced</SelectItem>
                    <SelectItem value="DYNAMIC">Dynamic</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="mt-2 grid gap-1 text-[10px] text-text-muted">
                Resolution
                <Select value={controller.resolution} onValueChange={(value) => controller.setResolution(value as RenderResolution)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="720p">720p · HD</SelectItem>
                    <SelectItem value="1080p">1080p · Full HD</SelectItem>
                    <SelectItem value="1440p">2K · 1440p (QHD)</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </section>

            <section className="border-b border-border-subtle">
              <PropertyRow label="Subtitles" value={<StatusIndicator label="Automatic" tone="success" className="justify-end" />} />
              <PropertyRow label="Timeline" value={timeline ? `${Math.round(timeline.totalDurationMs / 1000)}s` : "Not loaded"} />
              <PropertyRow label="Auto Edit" value={<StatusIndicator label={controller.canRender ? "Ready" : "Blocked"} tone={controller.canRender ? "success" : "warning"} className="justify-end" />} />
              <PropertyRow label="Disk free" value={controller.preflight?.diskFreeBytes != null ? formatBytes(controller.preflight.diskFreeBytes) : "Not checked"} />
            </section>

            {controller.destinationDirectory ? (
              <section className="border-b border-border-subtle p-3">
                <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-dim">Destination</div>
                <p className="mt-1 break-all font-mono text-[9px] leading-4 text-text-muted">{controller.finalPath ?? controller.destinationDirectory}</p>
              </section>
            ) : null}
          </div>
          <div className="shrink-0 border-t border-border-subtle p-3">
            <Button className="w-full" onClick={() => void controller.chooseDestinationAndStartRender()} disabled={controller.busy || !controller.canRender}>
              <FolderOpen size={13} /> {controller.busy ? "Preparing…" : "Choose folder & render"}
            </Button>
          </div>
        </WorkspacePane>

        <WorkspacePane className="flex flex-col">
          <PaneHeader
            title="Finishing Workspace"
            meta="Preflight, auto-edit decisions and render progress"
            actions={
              <MetricStrip
                items={[
                  { label: "timeline", value: timeline ? `${Math.round(timeline.totalDurationMs / 1000)}s` : "—" },
                  { label: "changes", value: controller.autoEditPlan?.renderOverrides.length ?? 0 },
                  { label: "blockers", value: controller.readinessBlockers.length },
                ]}
              />
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!!controller.readinessBlockers.length ? (
              <section className="border-b border-border-subtle">
                <InlineNotice tone="warning">
                  <strong className="font-semibold">Render blockers</strong>
                  <ul className="mt-1 space-y-0.5">{controller.readinessBlockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul>
                </InlineNotice>
              </section>
            ) : null}

            {controller.notice ? <InlineNotice>{controller.notice}</InlineNotice> : null}

            {controller.autoEditPlan ? (
              <WorkspaceSection title="Auto Edit plan" icon={<WandSparkles size={13} />} meta={`${controller.autoEditPlan.renderOverrides.length} changes`}>
                <p className="text-[10px] leading-4 text-text-muted">
                  Camera intent từ AI được ưu tiên; media fit theo narration và scene/chapter boundaries giữ nguyên duration.
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-muted">
                  {Object.entries(fitSummary).map(([mode, count]) => <span key={mode}>{mode}: <strong className="font-medium text-text-secondary">{count}</strong></span>)}
                </div>
              </WorkspaceSection>
            ) : null}

            {controller.preflight ? (
              <WorkspaceSection title="Preflight" icon={<HardDrive size={13} />} meta={`${controller.preflight.assets.length} assets`}>
                <div className="divide-y divide-border-subtle border-y border-border-subtle">
                  {controller.preflight.assets.map((asset) => (
                    <div key={asset.assetId} className="flex min-h-8 items-center justify-between gap-3 px-2 text-[10px]">
                      <span className="truncate font-mono text-text-secondary">{asset.assetId.slice(0, 12)}</span>
                      <StatusIndicator
                        label={asset.state}
                        tone={asset.state === "AVAILABLE" ? "success" : asset.state === "CORRUPT" ? "danger" : "warning"}
                      />
                    </div>
                  ))}
                </div>
                {!!controller.preflight.warnings.length && <p className="mt-2 text-[10px] leading-4 text-warning">{controller.preflight.warnings.join(" · ")}</p>}
              </WorkspaceSection>
            ) : null}

            {controller.liveJob ? (
              <WorkspaceSection title="Render job" icon={<Film size={13} />} meta={controller.liveJob.status}>
                <div className="flex items-center justify-between gap-3 text-[10px]">
                  <span className="truncate font-mono text-text-secondary">{controller.liveJob.jobId}</span>
                  <span className="tabular-nums text-text-muted">{Math.round(clampProgress(controller.liveJob.progress))}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden bg-secondary">
                  <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${clampProgress(controller.liveJob.progress)}%` }} />
                </div>
                <p className="mt-2 text-[10px] text-text-muted">{controller.liveJob.currentStep ?? "Waiting"}</p>
              </WorkspaceSection>
            ) : (
              <div className="grid min-h-48 place-items-center border-b border-border-subtle text-center">
                <div className="max-w-sm px-6">
                  <Type size={20} className="mx-auto text-text-dim" />
                  <div className="mt-2 text-[12px] font-semibold">Ready for finishing</div>
                  <p className="mt-1 text-[10px] leading-4 text-text-muted">Run preflight and choose a destination when the timeline is ready.</p>
                </div>
              </div>
            )}
          </div>
        </WorkspacePane>
      </div>
    </FeaturePage>
  );
}

function WorkspaceSection({ title, icon, meta, children }: Readonly<{ title: string; icon: ReactNode; meta?: ReactNode; children: ReactNode }>) {
  return (
    <section className="border-b border-border-subtle p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground"><span className="text-primary">{icon}</span>{title}</div>
        {meta ? <span className="text-[9px] text-text-dim">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatBytes(value: number) {
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
