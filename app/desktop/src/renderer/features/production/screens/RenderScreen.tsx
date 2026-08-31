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
import { useRenderController } from "../useRenderController";

export function RenderScreen({
  projectId,
  timeline,
}: Readonly<{
  projectId: string;
  timeline: DesktopTimeline | null;
}>) {
  const controller = useRenderController({ projectId, timeline });
  const fitSummary = controller.autoEditPlan
    ? controller.autoEditPlan.decisions.reduce<Record<string, number>>((summary, decision) => {
        summary[decision.fitMode] = (summary[decision.fitMode] ?? 0) + 1;
        return summary;
      }, {})
    : {};

  return (
    <FeaturePage
      title="Auto Edit & Render"
      description="Narration là master clock. NarrativeX tự lập edit plan rồi local FFmpeg render video final vào thư mục bạn chọn."
      actions={
        <Button
          size="sm"
          onClick={() => void controller.startRender()}
          disabled={controller.busy || !controller.canRender}
        >
          <FolderOpen size={13} />
          {controller.busy ? "Preparing…" : "Choose folder & render"}
        </Button>
      }
    >
      <div className="grid gap-4">
        <section className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] border-y border-border-subtle">
          <Metric
            label="Timeline"
            value={timeline ? `${Math.round(timeline.totalDurationMs / 1000)}s` : "Not loaded"}
            icon={<Film size={15} />}
          />
          <Metric
            label="Auto Edit"
            value={controller.canRender ? "Ready" : "Blocked"}
            icon={<WandSparkles size={15} />}
          />
          <Metric
            label="Disk free"
            value={controller.preflight?.diskFreeBytes != null ? formatBytes(controller.preflight.diskFreeBytes) : "Not checked"}
            icon={<HardDrive size={15} />}
          />
          <label className="grid gap-1.5 border-l border-border-subtle px-3 py-2.5 text-[10px] font-medium text-text-muted">
            Edit style
            <Select
              value={controller.autoEditStyle}
              onValueChange={(value) => controller.setAutoEditStyle(value as AutoEditStyle)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Auto · Recommended</SelectItem>
                <SelectItem value="CINEMATIC">Cinematic</SelectItem>
                <SelectItem value="BALANCED">Balanced</SelectItem>
                <SelectItem value="DYNAMIC">Dynamic</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5 border-l border-border-subtle px-3 py-2.5 text-[10px] font-medium text-text-muted">
            Resolution
            <Select
              value={controller.resolution}
              onValueChange={(value) => controller.setResolution(value as RenderResolution)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p · HD</SelectItem>
                <SelectItem value="1080p">1080p · Full HD</SelectItem>
                <SelectItem value="1440p">2K · 1440p (QHD)</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </section>

        <section className="flex items-center justify-between border-b border-border-subtle px-1 pb-3">
          <div className="flex items-center gap-3">
            <Type size={15} className="text-text-muted" />
            <div>
              <h2 className="text-[12px] font-medium text-foreground">Subtitles · Automatic</h2>
              <p className="mt-0.5 text-[10px] leading-4 text-text-muted">
                Final render burns narration-derived subtitles using alignment when available and deterministic timing fallback otherwise.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-success">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" /> On
          </span>
        </section>

        {!!controller.readinessBlockers.length && (
          <section className="border-l-2 border-warning bg-warning-bg px-3 py-2.5">
            <h2 className="text-[11px] font-semibold text-warning">Render blockers</h2>
            <ul className="mt-1.5 space-y-1 text-[10px] leading-4 text-text-muted">
              {controller.readinessBlockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
            </ul>
          </section>
        )}

        {controller.autoEditPlan && (
          <section className="border-y border-border-subtle py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <WandSparkles size={13} className="text-primary" />
                  <h2 className="text-[12px] font-semibold text-foreground">Auto Edit plan</h2>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-text-muted">
                  Camera intent từ AI được ưu tiên, media fit theo narration và scene/chapter boundaries nhận transition duration-preserving.
                </p>
              </div>
              <span className="text-[10px] tabular-nums text-text-dim">
                {controller.autoEditPlan.renderOverrides.length} changes
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-text-muted">
              {Object.entries(fitSummary).map(([mode, count]) => (
                <span key={mode}>{mode}: <strong className="font-medium text-text-secondary">{count}</strong></span>
              ))}
            </div>
          </section>
        )}

        {controller.destinationDirectory && (
          <section className="border-b border-border-subtle pb-3">
            <h2 className="text-[11px] font-semibold text-foreground">Final destination</h2>
            <p className="mt-1.5 break-all font-mono text-[10px] leading-4 text-text-muted">
              {controller.finalPath ?? controller.destinationDirectory}
            </p>
          </section>
        )}

        {controller.notice && (
          <p className="border-l-2 border-border-dark bg-surface-panel px-3 py-2 text-[10px] leading-4 text-text-muted" role="status">
            {controller.notice}
          </p>
        )}

        {controller.preflight && (
          <section className="border-y border-border-subtle py-3">
            <h2 className="text-[11px] font-semibold text-foreground">Preflight</h2>
            <div className="mt-2 divide-y divide-border-subtle">
              {controller.preflight.assets.map((asset) => (
                <div key={asset.assetId} className="flex items-center justify-between gap-3 px-1 py-1.5 text-[10px]">
                  <strong className="font-mono font-medium text-text-secondary">{asset.assetId.slice(0, 10)}</strong>
                  <span className="text-text-muted">{asset.state}</span>
                </div>
              ))}
            </div>
            {!!controller.preflight.warnings.length && (
              <p className="mt-2 text-[10px] leading-4 text-warning">{controller.preflight.warnings.join(" · ")}</p>
            )}
          </section>
        )}

        {controller.liveJob && (
          <section className="border-y border-border-subtle py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim">Render job</span>
                <h2 className="truncate font-mono text-[12px] font-medium text-foreground">{controller.liveJob.jobId}</h2>
              </div>
              <span className="text-[10px] text-text-muted">{controller.liveJob.status}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-secondary">
              <div
                className="h-full bg-primary transition-[width] duration-150"
                style={{ width: `${clampProgress(controller.liveJob.progress)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-text-muted">
              {Math.round(clampProgress(controller.liveJob.progress))}% · {controller.liveJob.currentStep ?? "Waiting"}
            </p>
          </section>
        )}
      </div>
    </FeaturePage>
  );
}

function Metric({ label, value, icon }: Readonly<{ label: string; value: string; icon: React.ReactNode }>) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-3 py-2.5">
      <span className="text-text-muted">{icon}</span>
      <div className="min-w-0">
        <span className="block text-[10px] text-text-dim">{label}</span>
        <strong className="mt-0.5 block truncate text-[11px] font-medium text-foreground">{value}</strong>
      </div>
    </div>
  );
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatBytes(value: number) {
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
