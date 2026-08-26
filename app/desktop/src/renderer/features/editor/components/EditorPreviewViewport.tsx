import { useState } from "react";
import {
  ChevronDown,
  Maximize2,
  MoreVertical,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { DesktopTimelineBeat } from "@narrativex/client-contracts";

interface EditorPreviewViewportProps {
  selectedBeat: DesktopTimelineBeat | null;
  playheadMs: number;
  scopeWindowStartMs: number;
  scopeWindowEndMs: number;
  playing: boolean;
  onTogglePlay: () => void;
  onPrevBeat: () => void;
  onNextBeat: () => void;
  onStepMs: (deltaMs: number) => void;
}

export function EditorPreviewViewport({
  selectedBeat,
  playheadMs,
  scopeWindowStartMs,
  scopeWindowEndMs,
  playing,
  onTogglePlay,
  onPrevBeat,
  onNextBeat,
  onStepMs,
}: Readonly<EditorPreviewViewportProps>) {
  const [muted, setMuted] = useState(false);
  const [fitMode, setFitMode] = useState<"Fit" | "100%" | "Fill">("Fit");
  const [isFitOpen, setIsFitOpen] = useState(false);

  const currentOffsetMs = Math.max(0, playheadMs - scopeWindowStartMs);
  const totalScopeDurationMs = Math.max(0, scopeWindowEndMs - scopeWindowStartMs);
  const beatNumber = selectedBeat ? String(selectedBeat.beatIndex + 1).padStart(2, "0") : "01";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background px-3 py-2">
      <div className="mx-auto flex h-8 w-full max-w-[820px] items-center justify-between gap-3 text-[10px]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[9px] font-semibold text-text-dim">{beatNumber}</span>
          <h2 className="truncate text-[11px] font-semibold text-foreground">
            {selectedBeat?.title || "Mở đầu bi kịch"}
          </h2>
          <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[8px] font-medium ${
            selectedBeat?.assetReady
              ? "border-success/30 bg-success-bg text-success"
              : "border-border bg-surface-2 text-text-muted"
          }`}>
            {selectedBeat?.assetReady ? "Ready" : "Draft"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-text-muted">
          <span className="hidden font-mono xl:inline">
            Duration <strong className="ml-1 font-semibold text-text-secondary">{formatTimecode(selectedBeat?.durationMs || 12000)}</strong>
          </span>
          <button type="button" className="nx-icon-button size-6" aria-label="More options">
            <MoreVertical size={13} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-1">
        <div className="relative aspect-video max-h-[300px] w-full max-w-[820px] overflow-hidden rounded-md border border-border bg-surface-dark shadow-[var(--shadow-panel)]">
          <div className="nx-media-placeholder relative flex h-full w-full items-center justify-center overflow-hidden">
            <div className="relative z-10 max-w-md px-5 text-center">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary-hover">
                {selectedBeat?.cameraMovement || "Slow Pan · Cinematic"}
              </span>
              <h3 className="mt-1 text-sm font-semibold text-foreground">
                {selectedBeat?.title || "Visual Beat"}
              </h3>
              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-text-secondary">
                {selectedBeat?.visualIntent || "Giới thiệu bối cảnh và nhân vật chính."}
              </p>
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-9 w-full max-w-[820px] items-center justify-between gap-3">
        <div className="min-w-[118px] font-mono text-[9px]">
          <span className="font-semibold text-text-secondary">{formatTimecode(currentOffsetMs)}</span>
          <span className="mx-1 text-text-dim">/</span>
          <span className="text-text-muted">{formatTimecode(totalScopeDurationMs || 12000)}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevBeat}
            className="nx-icon-button"
            title="Previous beat"
            aria-label="Previous beat"
          >
            <SkipBack size={13} />
          </button>
          <button
            type="button"
            onClick={() => onStepMs(-500)}
            className="nx-icon-button"
            title="Step back"
            aria-label="Step back"
          >
            <span className="font-mono text-[10px] font-bold">‹‹</span>
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            className="mx-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-primary)] transition hover:bg-primary-hover active:scale-95"
            title={playing ? "Pause" : "Play"}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => onStepMs(500)}
            className="nx-icon-button"
            title="Step forward"
            aria-label="Step forward"
          >
            <span className="font-mono text-[10px] font-bold">››</span>
          </button>
          <button
            type="button"
            onClick={onNextBeat}
            className="nx-icon-button"
            title="Next beat"
            aria-label="Next beat"
          >
            <SkipForward size={13} />
          </button>
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="nx-icon-button ml-1"
            title={muted ? "Unmute" : "Mute"}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>

        <div className="flex min-w-[118px] justify-end gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFitOpen(!isFitOpen)}
              className="nx-compact-control flex h-7 items-center gap-1 px-2 text-[9px] font-medium"
              aria-expanded={isFitOpen}
            >
              <span>{fitMode}</span>
              <ChevronDown size={10} className="text-text-muted" />
            </button>
            {isFitOpen && (
              <div className="absolute bottom-8 right-0 z-30 w-24 rounded-md border border-border bg-surface-elevated p-1 shadow-[var(--shadow-panel)]">
                {(["Fit", "100%", "Fill"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setFitMode(mode);
                      setIsFitOpen(false);
                    }}
                    className={`w-full rounded-sm px-2 py-1 text-left text-[9px] transition ${
                      fitMode === mode
                        ? "bg-primary-muted font-semibold text-primary-hover"
                        : "text-text-muted hover:bg-surface-3 hover:text-foreground"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="nx-compact-control grid size-7 place-items-center text-text-muted"
            title="Toàn màn hình"
            aria-label="Fullscreen"
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimecode(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}
