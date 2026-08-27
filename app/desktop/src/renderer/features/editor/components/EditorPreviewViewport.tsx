import { useEffect, useRef, useState } from "react";
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
import { narrationTimeMs, previewPlaybackState } from "../preview-playback";

interface EditorPreviewViewportProps {
  selectedBeat: DesktopTimelineBeat | null;
  mediaUrl: string | null;
  narrationUrl: string | null;
  narrationStartMs: number | null;
  narrationEndMs: number | null;
  previewLoading: boolean;
  previewMessage: string | null;
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
  mediaUrl,
  narrationUrl,
  narrationStartMs,
  narrationEndMs,
  previewLoading,
  previewMessage,
  playheadMs,
  scopeWindowStartMs,
  scopeWindowEndMs,
  playing,
  onTogglePlay,
  onPrevBeat,
  onNextBeat,
  onStepMs,
}: Readonly<EditorPreviewViewportProps>) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const [fitMode, setFitMode] = useState<"Fit" | "100%" | "Fill">("Fit");
  const [isFitOpen, setIsFitOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);

  const currentOffsetMs = Math.max(0, playheadMs - scopeWindowStartMs);
  const totalScopeDurationMs = Math.max(0, scopeWindowEndMs - scopeWindowStartMs);
  const beatNumber = selectedBeat ? String(selectedBeat.beatIndex + 1).padStart(2, "0") : "01";
  const playback = selectedBeat ? previewPlaybackState(selectedBeat, playheadMs) : null;

  useEffect(() => {
    setMediaFailed(false);
  }, [mediaUrl, selectedBeat?.visualBeatId]);

  useEffect(() => {
    setAudioFailed(false);
  }, [narrationUrl, narrationStartMs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedBeat || selectedBeat.mediaType !== "VIDEO" || !playback) return;

    const desiredSeconds = playback.mediaTimeMs / 1000;
    if (Number.isFinite(desiredSeconds) && Math.abs(video.currentTime - desiredSeconds) > 0.3) {
      try {
        video.currentTime = desiredSeconds;
      } catch {
        // The media metadata may not have loaded yet; the next playhead tick will retry.
      }
    }
    video.playbackRate = playback.playbackRate;

    if (playing && playback.shouldPlayVideo) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [mediaUrl, playback, playing, selectedBeat]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || narrationStartMs == null || narrationEndMs == null) return;

    const desiredSeconds = narrationTimeMs(playheadMs, narrationStartMs, narrationEndMs) / 1000;
    if (Number.isFinite(desiredSeconds) && Math.abs(audio.currentTime - desiredSeconds) > 0.3) {
      try {
        audio.currentTime = desiredSeconds;
      } catch {
        // Retry after metadata becomes available.
      }
    }
    audio.muted = muted;
    if (playing) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [muted, narrationEndMs, narrationStartMs, narrationUrl, playheadMs, playing]);

  const objectFit = fitMode === "Fill" ? "cover" : "contain";
  const showMedia = Boolean(mediaUrl && selectedBeat?.mediaType && !mediaFailed);

  async function toggleFullscreen() {
    const frame = frameRef.current;
    if (!frame) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    await frame.requestFullscreen().catch(() => undefined);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background px-3 py-1.5">
      {narrationUrl && !audioFailed && (
        <audio
          ref={audioRef}
          src={narrationUrl}
          preload="auto"
          onError={() => setAudioFailed(true)}
          className="hidden"
        />
      )}

      <div className="mx-auto flex h-7 w-full max-w-[680px] items-center justify-between gap-3 text-[10px]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[9px] font-semibold text-text-dim">{beatNumber}</span>
          <h2 className="truncate text-[11px] font-semibold text-foreground">
            {selectedBeat?.title || "Visual Beat"}
          </h2>
          <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[8px] font-medium ${
            showMedia
              ? "border-success/30 bg-success-bg text-success"
              : "border-border bg-surface-2 text-text-muted"
          }`}>
            {previewLoading ? "Loading" : showMedia ? "Live preview" : selectedBeat?.assetReady ? "Ready" : "Draft"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-text-muted">
          <span className="hidden font-mono xl:inline">
            Duration <strong className="ml-1 font-semibold text-text-secondary">{formatTimecode(selectedBeat?.durationMs || 0)}</strong>
          </span>
          <button type="button" className="nx-icon-button size-6" aria-label="More options">
            <MoreVertical size={13} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-1">
        <div
          ref={frameRef}
          className="nx-editor-preview-frame relative aspect-[21/9] overflow-hidden rounded-md border border-border bg-surface-dark shadow-[var(--shadow-panel)]"
        >
          {showMedia && selectedBeat?.mediaType === "IMAGE" ? (
            <img
              src={mediaUrl as string}
              alt={selectedBeat.title || "Visual beat preview"}
              onError={() => setMediaFailed(true)}
              className="h-full w-full select-none"
              style={{
                objectFit,
                transform: playback?.imageTransform || "scale(1)",
                transition: playing ? "transform 260ms linear" : "none",
              }}
              draggable={false}
            />
          ) : showMedia && selectedBeat?.mediaType === "VIDEO" ? (
            <video
              ref={videoRef}
              key={`${selectedBeat.visualBeatId}:${mediaUrl}`}
              src={mediaUrl as string}
              muted
              playsInline
              preload="auto"
              loop={selectedBeat.fitMode === "LOOP"}
              onError={() => setMediaFailed(true)}
              className="h-full w-full"
              style={{ objectFit }}
            />
          ) : (
            <div className="nx-media-placeholder relative flex h-full w-full items-center justify-center overflow-hidden">
              <div className="relative z-10 max-w-md px-5 text-center">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary-hover">
                  {selectedBeat?.cameraMovement || "Auto Edit"}
                </span>
                <h3 className="mt-1 text-sm font-semibold text-foreground">
                  {previewLoading ? "Đang tải preview…" : selectedBeat?.title || "Visual Beat"}
                </h3>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-text-secondary">
                  {mediaFailed
                    ? "Không tải được media preview. Render source vẫn được giữ nguyên."
                    : previewMessage || selectedBeat?.visualIntent || "Chưa có media để preview."}
                </p>
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
            </div>
          )}

          {showMedia && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/70 to-transparent px-3 pb-2 pt-8">
              <div className="flex items-end justify-between gap-3 text-[8px] text-white/80">
                <span>{selectedBeat?.cameraMovement || "NONE"}</span>
                <span>{selectedBeat?.fitMode || "TRIM"}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex h-8 w-full max-w-[680px] items-center justify-between gap-3">
        <div className="min-w-[118px] font-mono text-[9px]">
          <span className="font-semibold text-text-secondary">{formatTimecode(currentOffsetMs)}</span>
          <span className="mx-1 text-text-dim">/</span>
          <span className="text-text-muted">{formatTimecode(totalScopeDurationMs)}</span>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={onPrevBeat} className="nx-icon-button" title="Previous beat" aria-label="Previous beat">
            <SkipBack size={13} />
          </button>
          <button type="button" onClick={() => onStepMs(-500)} className="nx-icon-button" title="Step back" aria-label="Step back">
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
          <button type="button" onClick={() => onStepMs(500)} className="nx-icon-button" title="Step forward" aria-label="Step forward">
            <span className="font-mono text-[10px] font-bold">››</span>
          </button>
          <button type="button" onClick={onNextBeat} className="nx-icon-button" title="Next beat" aria-label="Next beat">
            <SkipForward size={13} />
          </button>
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="nx-icon-button ml-1"
            title={muted ? "Unmute narration" : "Mute narration"}
            aria-label={muted ? "Unmute narration" : "Mute narration"}
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
            onClick={() => void toggleFullscreen()}
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
