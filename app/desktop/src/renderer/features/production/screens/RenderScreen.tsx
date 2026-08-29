import { useEffect, useMemo, useState } from "react";
import type {
  AutoEditStyle,
  DesktopRenderJob,
  DesktopTimeline,
  LocalRenderPreflight,
} from "@narrativex/client-contracts";
import { ExternalLink, Film, HardDrive, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerationJob } from "../../generation/queries/generation.queries";
import { FeaturePage } from "../../workspace/components/FeaturePage";
import { productionApi } from "../api/production.api";
import { createAutoEditPlan } from "../auto-edit-planner";
import { getRenderReadinessBlockers } from "../render-readiness";

export function RenderScreen({
  projectId,
  timeline,
}: Readonly<{
  projectId: string;
  timeline: DesktopTimeline | null;
}>) {
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [autoEditStyle, setAutoEditStyle] = useState<AutoEditStyle>("AUTO");
  const [job, setJob] = useState<DesktopRenderJob | null>(null);
  const [preflight, setPreflight] = useState<LocalRenderPreflight | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trackedJob = useGenerationJob(job?.jobId ?? null);
  const liveJob = trackedJob.data ?? job;
  const autoEditPlan = useMemo(
    () => (timeline ? createAutoEditPlan(timeline, autoEditStyle) : null),
    [autoEditStyle, timeline],
  );
  const readinessBlockers = useMemo(() => getRenderReadinessBlockers(timeline), [timeline]);
  const canRender = readinessBlockers.length === 0 && Boolean(autoEditPlan);

  useEffect(() => {
    if (trackedJob.data?.status === "COMPLETED") setNotice("Render hoàn tất.");
  }, [trackedJob.data?.status]);

  useEffect(() => {
    if (trackedJob.isError) {
      setNotice("Không thể tải trạng thái render job. NarrativeX sẽ tiếp tục thử lại bằng watchdog.");
    }
  }, [trackedJob.isError]);

  async function startRender() {
    if (!timeline || !autoEditPlan || !canRender) {
      setNotice(readinessBlockers[0] ?? "Timeline chưa ready for render.");
      return;
    }
    setBusy(true);
    setNotice("Auto Edit đang tự lập kế hoạch và chạy local render preflight…");
    try {
      const assetIds = [
        ...timeline.beats.map((beat) => beat.mediaAssetId),
        ...timeline.chapters.map((chapter) => chapter.narrationAssetId ?? null),
      ].filter((assetId): assetId is string => Boolean(assetId));
      const estimatedOutputBytes = Math.max(
        64 * 1024 * 1024,
        Math.round((timeline.totalDurationMs / 1000) * 1_500_000),
      );
      const nextPreflight = await productionApi.preflight({
        projectId,
        assetIds,
        estimatedOutputBytes,
        requiredTemporaryBytes: estimatedOutputBytes * 2,
      });
      setPreflight(nextPreflight);
      if (!nextPreflight.ready) {
        setNotice(`Preflight blocked: ${nextPreflight.blockers.join(", ")}`);
        return;
      }
      const nextJob = await productionApi.startRender(
        projectId,
        autoEditPlan.renderOverrides,
        resolution,
      );
      setJob(nextJob);
      setNotice(
        `Auto Edit ${autoEditStyle.toLowerCase()} đã áp dụng ${autoEditPlan.renderOverrides.length} thay đổi; render job ${nextJob.jobId.slice(0, 8)} đã được queue.`,
      );
    } catch (error) {
      setNotice(toMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function openOutput() {
    if (!liveJob || liveJob.status !== "COMPLETED") return;
    try {
      await window.narrativex.localStorage.revealArtifact({ projectId, jobId: liveJob.jobId });
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  const fitSummary = autoEditPlan
    ? autoEditPlan.decisions.reduce<Record<string, number>>((summary, decision) => {
        summary[decision.fitMode] = (summary[decision.fitMode] ?? 0) + 1;
        return summary;
      }, {})
    : {};

  return (
    <FeaturePage
      title="Auto Edit & Render"
      description="Mặc định không cần chỉnh tay: NarrativeX tự chọn nhịp edit, motion, trim và cách fit media theo narration rồi giao cho local FFmpeg."
      actions={
        <Button size="sm" onClick={() => void startRender()} disabled={busy || !canRender}>
          <WandSparkles size={14} /> {busy ? "Preparing…" : "Auto Edit & Render"}
        </Button>
      }
    >
      <div className="grid gap-4">
        <section className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 rounded-lg border border-border bg-card p-4">
          <Metric label="Timeline" value={timeline ? `${Math.round(timeline.totalDurationMs / 1000)}s` : "Not loaded"} icon={<Film size={16} />} />
          <Metric label="Auto Edit" value={canRender ? "Zero-config ready" : "Blocked"} icon={<WandSparkles size={16} />} />
          <Metric label="Disk free" value={preflight?.diskFreeBytes != null ? formatBytes(preflight.diskFreeBytes) : "Not checked"} icon={<HardDrive size={16} />} />
          <label className="grid gap-1 text-[10px] text-muted-foreground">
            Edit style · optional override
            <Select value={autoEditStyle} onValueChange={(value) => setAutoEditStyle(value as AutoEditStyle)}>
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
            <Select value={resolution} onValueChange={(value) => setResolution(value as typeof resolution)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="1080p">1080p</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </section>

        {!!readinessBlockers.length && (
          <section className="rounded-lg border border-warning/30 bg-card p-4">
            <h2 className="text-xs font-semibold text-warning">Render blockers</h2>
            <ul className="mt-2 space-y-1 text-[10px] text-muted-foreground">
              {readinessBlockers.map((blocker) => (
                <li key={blocker}>• {blocker}</li>
              ))}
            </ul>
          </section>
        )}

        {autoEditPlan && (
          <section className="rounded-lg border border-primary/25 bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-primary-hover">
                  <WandSparkles size={14} />
                  <h2 className="text-xs font-semibold">Auto Edit plan</h2>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Narration là master clock. Camera intent từ AI được ưu tiên; khi style là Auto, NarrativeX tự đổi nhịp theo nội dung beat và rule engine xử lý các quyết định media có thể xác định chắc chắn.
                </p>
              </div>
              <span className="rounded-md border border-border bg-popover px-2 py-1 text-[9px] text-muted-foreground">
                {autoEditPlan.renderOverrides.length} changes
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

        {notice && <p className="rounded-md border border-border bg-card p-3 text-[10px] text-muted-foreground">{notice}</p>}

        {preflight && (
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-xs font-semibold">Preflight</h2>
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
              {preflight.assets.map((asset) => (
                <div key={asset.assetId} className="rounded-md border border-border-subtle bg-popover p-2 text-[10px]">
                  <strong>{asset.assetId.slice(0, 10)}</strong>
                  <span className="ml-2 text-muted-foreground">{asset.state}</span>
                </div>
              ))}
            </div>
            {!!preflight.warnings.length && <p className="mt-3 text-[10px] text-warning">{preflight.warnings.join(" · ")}</p>}
          </section>
        )}

        {liveJob && (
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Render job</span>
                <h2 className="text-sm font-semibold">{liveJob.jobId}</h2>
              </div>
              {liveJob.status === "COMPLETED" && (
                <Button variant="outline" onClick={() => void openOutput()}>
                  <ExternalLink size={14} /> Open output
                </Button>
              )}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${clampProgress(liveJob.progress)}%` }} />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">{liveJob.status} · {Math.round(clampProgress(liveJob.progress))}% · {liveJob.currentStep ?? "Waiting"}</p>
          </section>
        )}
      </div>
    </FeaturePage>
  );
}

function Metric({ label, value, icon }: Readonly<{ label: string; value: string; icon: React.ReactNode }>) {
  return <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-popover p-3"><span className="text-primary-hover">{icon}</span><div><span className="block text-[9px] text-muted-foreground">{label}</span><strong className="text-xs">{value}</strong></div></div>;
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatBytes(value: number) {
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Render operation thất bại.";
}
