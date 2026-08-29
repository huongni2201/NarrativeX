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
          <FolderOpen size={14} />
          {controller.busy ? "Preparing…" : "Choose folder & render"}
        </Button>
      }
    >
      <div className="grid gap-4">
        <section className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 rounded-lg border border-border bg-card p-4">
          <Metric
            label="Timeline"
            value={timeline ? `${Math.round(timeline.totalDurationMs / 1000)}s` : "Not loaded"}
            icon={<Film size={16} />}
          />
          <Metric
            label="Auto Edit"
            value={controller.canRender ? "Ready" : "Blocked"}
            icon={<WandSparkles size={16} />}
          />
          <Metric
            label="Disk free"
            value={controller.preflight?.diskFreeBytes != null ? formatBytes(controller.preflight.diskFreeBytes) : "Not checked"}
            icon={<HardDrive size={16} />}
          />
          <label className="grid gap-1 text-[10px] text-muted-foreground">
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
          <label className="grid gap-1 text-[10px] text-muted-foreground">
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

        <section className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Type size={16} className="text-primary" />
            <div>
              <h2 className="text-xs font-semibold">Subtitles · Automatic</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Final render burns narration-derived subtitles using alignment when available and deterministic timing fallback otherwise.
              </p>
            </div>
          </div>
          <span className="rounded bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-400">ON</span>
        </section>

        {!!controller.readinessBlockers.length && (
          <section className="rounded-lg border border-warning/30 bg-card p-4">
            <h2 className="text-xs font-semibold text-warning">Render blockers</h2>
            <ul className="mt-2 space-y-1 text-[10px] text-muted-foreground">
              {controller.readinessBlockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
            </ul>
          </section>
        )}

        {controller.autoEditPlan && (
          <section className="rounded-lg border border-primary/25 bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-primary-hover">
                  <WandSparkles size={14} />
                  <h2 className="text-xs font-semibold">Auto Edit plan</h2>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Camera intent từ AI được ưu tiên, media fit theo narration và scene/chapter boundaries nhận transition duration-preserving.
                </p>
              </div>
              <span className="rounded-md border border-border bg-popover px-2 py-1 text-[9px] text-muted-foreground">
                {controller.autoEditPlan.renderOverrides.length} changes
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[9px] text-muted-foreground">
              {Object.entries(fitSummary).map(([mode, count]) => (
                <span key={mode} className="rounded-md border border-border-subtle bg-popover px-2 py-1">
                  {mode}: {count}
                </span>
              ))}
            </div>
          </section>
        )}

        {controller.destinationDirectory && (
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-xs font-semibold">Final destination</h2>
            <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
              {controller.finalPath ?? controller.destinationDirectory}
            </p>
          </section>
        )}

        {controller.notice && (
          <p className="rounded-md border border-border bg-card p-3 text-[10px] text-muted-foreground">
            {controller.notice}
          </p>
        )}

        {controller.preflight && (
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-xs font-semibold">Preflight</h2>
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
              {controller.preflight.assets.map((asset) => (
                <div key={asset.assetId} className="rounded-md border border-border-subtle bg-popover p-2 text-[10px]">
                  <strong>{asset.assetId.slice(0, 10)}</strong>
                  <span className="ml-2 text-muted-foreground">{asset.state}</span>
                </div>
              ))}
            </div>
            {!!controller.preflight.warnings.length && (
              <p className="mt-3 text-[10px] text-warning">{controller.preflight.warnings.join(" · ")}</p>
            )}
          </section>
        )}

        {controller.liveJob && (
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Render job</span>
                <h2 className="text-sm font-semibold">{controller.liveJob.jobId}</h2>
              </div>
              <span className="text-[10px] text-muted-foreground">{controller.liveJob.status}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${clampProgress(controller.liveJob.progress)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
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
    <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-popover p-3">
      <span className="text-primary-hover">{icon}</span>
      <div><span className="block text-[9px] text-muted-foreground">{label}</span><strong className="text-xs">{value}</strong></div>
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
