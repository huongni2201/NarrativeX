import { useEffect, useState } from "react";
import type { DesktopTimelineBeat } from "@narrativex/client-contracts";
import { Check, Clapperboard, Copy, ExternalLink, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineNotice, StatusIndicator } from "../../workspace/components/WorkstationPrimitives";
import type { StoryboardVisualBeat, VisualBeatReviewStatus } from "../api/storyboard.api";
import type { GeminiQueueStatus } from "../model/gemini-queue";
import { useStoryboardImagePreview } from "../queries/storyboard-media.queries";

export function VisualBeatGrid({
  projectId,
  beats,
  hasSelectedScene,
  selectedSceneBeatCount,
  timelineBeats,
  updating,
  mediaBusyBeatId,
  activeGeminiBeatIds,
  pendingImportBeatId,
  copiedPromptBeatId,
  currentQueueBeatId,
  queueStatus,
  onReview,
  onGenerate,
  onCopyPrompt,
  onImport,
}: Readonly<{
  projectId: string;
  beats: StoryboardVisualBeat[];
  hasSelectedScene: boolean;
  selectedSceneBeatCount: number;
  timelineBeats: Map<string, DesktopTimelineBeat>;
  updating: boolean;
  mediaBusyBeatId: string | null;
  activeGeminiBeatIds: ReadonlySet<string>;
  pendingImportBeatId: string | null;
  copiedPromptBeatId: string | null;
  currentQueueBeatId: string | null;
  queueStatus: GeminiQueueStatus | null;
  onReview: (beat: StoryboardVisualBeat, status: VisualBeatReviewStatus) => void;
  onGenerate: (beat: StoryboardVisualBeat) => void;
  onCopyPrompt: (beat: StoryboardVisualBeat) => void;
  onImport: (beat: StoryboardVisualBeat) => void;
}>) {
  if (!hasSelectedScene) {
    return <EmptyState title="Chọn scene để xem Visual Beat" detail="Chọn một scene trong navigator để bắt đầu review media." />;
  }
  if (!selectedSceneBeatCount) {
    return <EmptyState title="Scene chưa có Visual Beat" detail="Thêm Visual Beat mới từ thanh công cụ phía trên." />;
  }
  if (!beats.length) {
    return <EmptyState title="Không có Visual Beat phù hợp" detail="Đổi bộ lọc review để xem các Visual Beat còn lại." />;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5">
      {beats.map((beat) => {
        const queueRunning = activeGeminiBeatIds.has(beat.id);
        return (
          <VisualBeatCard
            key={beat.id}
            projectId={projectId}
            beat={beat}
            timelineBeat={timelineBeats.get(beat.id) ?? null}
            updating={updating}
            mediaBusy={queueRunning || mediaBusyBeatId === beat.id}
            pendingImport={pendingImportBeatId === beat.id}
            promptCopied={copiedPromptBeatId === beat.id}
            queueRunning={queueRunning}
            queueCurrent={currentQueueBeatId === beat.id && queueStatus !== "COMPLETED"}
            generationLocked={queueStatus === "RUNNING" && !queueRunning}
            onReview={(status) => onReview(beat, status)}
            onGenerate={() => onGenerate(beat)}
            onCopyPrompt={() => onCopyPrompt(beat)}
            onImport={() => onImport(beat)}
          />
        );
      })}
    </div>
  );
}

function VisualBeatCard({
  projectId,
  beat,
  timelineBeat,
  updating,
  mediaBusy,
  pendingImport,
  promptCopied,
  queueRunning,
  queueCurrent,
  generationLocked,
  onReview,
  onGenerate,
  onCopyPrompt,
  onImport,
}: Readonly<{
  projectId: string;
  beat: StoryboardVisualBeat;
  timelineBeat: DesktopTimelineBeat | null;
  updating: boolean;
  mediaBusy: boolean;
  pendingImport: boolean;
  promptCopied: boolean;
  queueRunning: boolean;
  queueCurrent: boolean;
  generationLocked: boolean;
  onReview: (status: VisualBeatReviewStatus) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
  onImport: () => void;
}>) {
  const approved = beat.reviewStatus === "APPROVED";
  const prompt = beat.prompt ?? "Backend prompt unavailable.";
  const borderClass = queueRunning
    ? "border-primary ring-1 ring-primary/35"
    : queueCurrent
      ? "border-primary/60"
      : "border-border-subtle hover:border-border";

  return (
    <article className={`group min-w-0 overflow-hidden border bg-surface-panel transition-colors ${borderClass}`}>
      <div className="relative bg-surface-dark">
        <BeatImagePreview projectId={projectId} beat={beat} timelineBeat={timelineBeat} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <span className="rounded-sm bg-background/85 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-text-secondary backdrop-blur-sm">
            Beat {beat.orderIndex + 1}
          </span>
          <span className={`rounded-sm bg-background/85 px-1.5 py-0.5 text-[9px] font-semibold backdrop-blur-sm ${approved ? "text-success" : "text-warning"}`}>
            {approved ? "Approved" : "Review"}
          </span>
        </div>
      </div>

      <div className="p-2.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[12px] font-semibold text-foreground">{beat.title}</h3>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-text-dim">
              <span>{timelineBeat ? `${formatMs(timelineBeat.startMs)}–${formatMs(timelineBeat.endMs)}` : "No timing"}</span>
              <span>{formatEnum(beat.cameraMovement)}</span>
              <span>{formatEnum(beat.motionMode)}</span>
            </div>
          </div>
          {queueRunning ? (
            <StatusIndicator label="Generating" tone="accent" className="shrink-0" />
          ) : queueCurrent ? (
            <StatusIndicator label="Current" tone="accent" className="shrink-0" />
          ) : null}
        </div>

        <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-text-muted">{beat.visualIntent}</p>

        {pendingImport ? (
          <InlineNotice tone="info" className="mt-2">
            Automation chưa hoàn tất. Import ảnh thủ công vẫn khả dụng.
          </InlineNotice>
        ) : null}

        <div className="mt-2.5 flex items-center gap-1.5 border-t border-border-subtle pt-2">
          {!approved ? (
            <Button size="sm" disabled={updating} onClick={() => onReview("APPROVED")} className="min-w-0 flex-1">
              <Check size={12} /> Approve
            </Button>
          ) : (
            <Button size="sm" disabled={mediaBusy || generationLocked || !beat.prompt} onClick={onGenerate} className="min-w-0 flex-1">
              {mediaBusy ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              {mediaBusy ? "Generating…" : "Generate"}
            </Button>
          )}
          <Button variant="outline" size="icon" disabled={mediaBusy || generationLocked} onClick={onImport} title="Import generated image" aria-label={`Import image for ${beat.title}`}>
            <ImagePlus size={12} />
          </Button>
          {approved ? (
            <Button variant="ghost" size="icon" disabled={updating} onClick={() => onReview("NEEDS_REVIEW")} title="Mark as needs review" aria-label={`Mark ${beat.title} as needs review`}>
              <RotateCcw size={12} />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" disabled={mediaBusy || generationLocked || !beat.prompt} onClick={onGenerate} title="Generate with Gemini" aria-label={`Generate image for ${beat.title}`}>
              {mediaBusy ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
            </Button>
          )}
        </div>

        <details className="mt-2 border-t border-border-subtle pt-2 text-[10px]">
          <summary className="cursor-pointer select-none text-text-muted hover:text-text-secondary">Prompt & details</summary>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[9px] uppercase tracking-[0.08em] text-text-dim">Prompt</span>
            <button type="button" onClick={onCopyPrompt} className={`inline-flex items-center gap-1 text-[10px] font-medium ${promptCopied ? "text-success" : "text-primary-hover"}`}>
              {promptCopied ? <Check size={11} /> : <Copy size={11} />}
              {promptCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap leading-4 text-text-secondary">{prompt}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border-subtle pt-2 text-[9px] text-text-muted">
            <Meta label="Camera" value={formatEnum(beat.cameraMovement)} />
            <Meta label="Angle" value={formatEnum(beat.cameraAngle)} />
            <Meta label="Motion" value={formatEnum(beat.motionMode)} />
            <Meta label="Timing" value={timelineBeat ? `${formatMs(timelineBeat.startMs)} – ${formatMs(timelineBeat.endMs)}` : "—"} />
          </div>
        </details>
      </div>
    </article>
  );
}

function BeatImagePreview({ projectId, beat, timelineBeat }: Readonly<{ projectId: string; beat: StoryboardVisualBeat; timelineBeat: DesktopTimelineBeat | null }>) {
  const [failed, setFailed] = useState(false);
  const timelineImageAssetId = timelineBeat?.mediaType === "IMAGE" ? timelineBeat.mediaAssetId : null;
  const previewAssetId = beat.previewMediaAssetId ?? timelineImageAssetId;
  const preview = useStoryboardImagePreview({ projectId, assetId: previewAssetId, enabled: Boolean(previewAssetId) });

  useEffect(() => setFailed(false), [previewAssetId]);

  if (!previewAssetId) {
    return <div className="grid aspect-video w-full place-items-center text-center text-[10px] text-text-muted"><div><ImagePlus className="mx-auto mb-1.5" size={20} />No image</div></div>;
  }
  if (preview.isLoading) {
    return <div className="grid aspect-video w-full place-items-center text-text-muted"><Loader2 size={17} className="animate-spin" /></div>;
  }
  if (!preview.data?.url || preview.isError || failed) {
    return <div className="grid aspect-video w-full place-items-center px-3 text-center text-[10px] text-text-muted">Preview unavailable</div>;
  }
  return <img src={preview.data.url} alt={`Visual beat ${beat.id}`} className="aspect-video w-full object-cover" onError={() => setFailed(true)} />;
}

function Meta({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="flex min-w-0 justify-between gap-2"><span className="text-text-dim">{label}</span><span className="truncate text-text-secondary">{value}</span></div>;
}

function EmptyState({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <div className="grid min-h-48 place-items-center border-y border-dashed border-border-subtle">
      <div className="max-w-sm px-6 text-center">
        <Clapperboard size={22} className="mx-auto text-text-dim" />
        <div className="mt-2 text-[12px] font-semibold">{title}</div>
        <p className="mt-1 text-[10px] leading-4 text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function formatEnum(value: string | null | undefined) {
  if (!value) return "—";
  return value.toLocaleLowerCase().split("_").map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1)).join(" ");
}

function formatMs(value: number) {
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
