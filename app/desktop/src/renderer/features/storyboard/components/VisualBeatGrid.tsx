import { useEffect, useState } from "react";
import type { DesktopTimelineBeat } from "@narrativex/client-contracts";
import {
  Check,
  Clapperboard,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type {
  StoryboardVisualBeat,
  VisualBeatReviewStatus,
} from "../api/storyboard.api";
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
    return (
      <EmptyState
        title="Chọn scene để xem Visual Beat"
        detail="Mỗi scene chứa các visual beat được tạo bởi quá trình phân tích hoặc thêm thủ công."
      />
    );
  }

  if (!selectedSceneBeatCount) {
    return (
      <EmptyState
        title="Scene chưa có Visual Beat"
        detail="Bạn có thể thêm Visual Beat mới bằng nút phía trên."
      />
    );
  }

  if (!beats.length) {
    return (
      <EmptyState
        title="Không có Visual Beat phù hợp"
        detail="Thử chọn một trạng thái review khác để xem các Visual Beat còn lại."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
      {beats.map((beat) => (
        <VisualBeatCard
          key={beat.id}
          projectId={projectId}
          beat={beat}
          timelineBeat={timelineBeats.get(beat.id) ?? null}
          updating={updating}
          mediaBusy={mediaBusyBeatId === beat.id}
          pendingImport={pendingImportBeatId === beat.id}
          promptCopied={copiedPromptBeatId === beat.id}
          queueCurrent={currentQueueBeatId === beat.id && queueStatus !== "COMPLETED"}
          generationLocked={queueStatus === "RUNNING" && currentQueueBeatId !== beat.id}
          onReview={(status) => onReview(beat, status)}
          onGenerate={() => onGenerate(beat)}
          onCopyPrompt={() => onCopyPrompt(beat)}
          onImport={() => onImport(beat)}
        />
      ))}
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
  queueCurrent: boolean;
  generationLocked: boolean;
  onReview: (status: VisualBeatReviewStatus) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
  onImport: () => void;
}>) {
  const approved = beat.reviewStatus === "APPROVED";
  const prompt = beat.prompt ?? "Backend prompt unavailable.";

  return (
    <article className={`rounded-lg border bg-surface-panel p-4 ${queueCurrent ? "border-primary/60 ring-1 ring-primary/20" : "border-border"}`}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-surface-input px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-text-muted">
              Beat {beat.orderIndex + 1}
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-hover">
              Gemini Web
            </span>
            <span className="rounded bg-surface-input px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-text-muted">
              Generate New
            </span>
            {queueCurrent && (
              <span className="rounded bg-info-bg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-hover">
                Gemini All · Current
              </span>
            )}
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                approved ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              }`}
            >
              {approved ? "Approved" : "Needs review"}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-bold text-foreground">{beat.title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-text-secondary">
            {beat.visualIntent}
          </p>

          <div className="mt-3 rounded-md border border-border-subtle bg-surface-dark p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] font-bold uppercase tracking-wide text-text-muted">
                Prompt preview
              </span>
              <button
                type="button"
                onClick={onCopyPrompt}
                aria-label={promptCopied ? `Prompt copied for ${beat.title}` : `Copy prompt for ${beat.title}`}
                className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  promptCopied ? "text-success" : "text-primary-hover hover:text-primary"
                }`}
              >
                {promptCopied ? <Check size={11} /> : <Copy size={11} />}
                {promptCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[10px] leading-4 text-text-secondary">
              {prompt}
            </p>
          </div>

          {pendingImport && (
            <div className="mt-3 rounded-md border border-info/25 bg-info-bg p-3 text-[10px] leading-4 text-text-secondary">
              Automation chưa hoàn tất. Bạn vẫn có thể dùng Import Generated Image làm fallback để gắn file ảnh thủ công vào beat này.
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={mediaBusy || generationLocked || !beat.prompt}
              onClick={onGenerate}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mediaBusy ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              {mediaBusy ? "Generating…" : "Generate with Gemini"}
            </button>
            <button
              type="button"
              disabled={mediaBusy || generationLocked}
              onClick={onImport}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-input px-3 text-[11px] font-semibold text-text-secondary hover:bg-surface-2 disabled:opacity-50"
            >
              {mediaBusy ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
              Import Image (fallback)
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={() => onReview(approved ? "NEEDS_REVIEW" : "APPROVED")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition disabled:opacity-50 ${
                approved
                  ? "border-border text-text-secondary hover:bg-surface-2"
                  : "border-success/35 bg-success/5 text-success hover:bg-success/10"
              }`}
            >
              {approved ? <RotateCcw size={12} /> : <Check size={12} />}
              {approved ? "Needs review" : "Approve"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border-subtle pt-3 text-[10px] text-text-muted">
            <Meta label="Motion" value={formatEnum(beat.motionMode)} />
            <Meta label="Camera" value={formatEnum(beat.cameraMovement)} />
            <Meta label="Angle" value={formatEnum(beat.cameraAngle)} />
            <Meta
              label="Time"
              value={timelineBeat ? `${formatMs(timelineBeat.startMs)} – ${formatMs(timelineBeat.endMs)}` : "—"}
            />
          </div>
        </div>

        <BeatImagePreview projectId={projectId} beat={beat} timelineBeat={timelineBeat} />
      </div>
    </article>
  );
}

function BeatImagePreview({
  projectId,
  beat,
  timelineBeat,
}: Readonly<{
  projectId: string;
  beat: StoryboardVisualBeat;
  timelineBeat: DesktopTimelineBeat | null;
}>) {
  const [failed, setFailed] = useState(false);
  const timelineImageAssetId =
    timelineBeat?.mediaType === "IMAGE" ? timelineBeat.mediaAssetId : null;
  const previewAssetId = beat.previewMediaAssetId ?? timelineImageAssetId;
  const preview = useStoryboardImagePreview({
    projectId,
    assetId: previewAssetId,
    enabled: Boolean(previewAssetId),
  });

  useEffect(() => setFailed(false), [previewAssetId]);

  if (!previewAssetId) {
    return (
      <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-border bg-surface-dark text-center text-[10px] text-text-muted">
        <div>
          <ImagePlus className="mx-auto mb-2" size={22} />
          Chưa có ảnh cho beat này
        </div>
      </div>
    );
  }

  if (preview.isLoading) {
    return (
      <div className="grid min-h-40 place-items-center rounded-md border border-border bg-surface-dark text-text-muted">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (!preview.data?.url || preview.isError || failed) {
    return (
      <div className="grid min-h-40 place-items-center rounded-md border border-border bg-surface-dark px-3 text-center text-[10px] text-text-muted">
        Ảnh đã attach nhưng preview hiện không khả dụng.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-dark">
      <img
        src={preview.data.url}
        alt={`Visual beat ${beat.id}`}
        className="aspect-video h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function Meta({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <div className="font-semibold uppercase tracking-wide text-text-dim">{label}</div>
      <div className="mt-1 truncate text-text-secondary">{value}</div>
    </div>
  );
}

function EmptyState({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <div className="grid min-h-[220px] place-items-center">
      <div className="max-w-md px-6 text-center">
        <Clapperboard size={24} className="mx-auto text-text-dim" />
        <div className="mt-3 text-sm font-bold">{title}</div>
        <p className="mt-1 text-xs leading-5 text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function formatEnum(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .toLocaleLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}

function formatMs(value: number) {
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
