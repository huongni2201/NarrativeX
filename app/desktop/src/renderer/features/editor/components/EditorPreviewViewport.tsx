import { useEffect, useRef, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  MoreVertical,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { DesktopTimelineBeat, RenderFrameRate } from "@narrativex/client-contracts";
import { activeSubtitleAt, type PlannedSubtitle } from "../../../../shared/subtitle-planner";
import { SUBTITLE_STYLE_V1 } from "../../../../shared/subtitle-style";
import {
  globalPlayheadFromNarrationSeconds,
  narrationSeekSeconds,
  previewPlaybackState,
  shouldResyncNarration,
} from "../preview-playback";

interface EditorPreviewViewportProps {
  selectedBeat: DesktopTimelineBeat | null;
  frameRate: RenderFrameRate;
  subtitleCues: PlannedSubtitle[];
  transitionBlackOpacity: number;
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
  onNarrationClock: (globalMs: number) => void;
  onNarrationEnded: () => void;
  onPlaybackError: (message: string) => void;
}

export function EditorPreviewViewport({
  selectedBeat,
  frameRate,
  subtitleCues,
  transitionBlackOpacity,
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
  onNarrationClock,
  onNarrationEnded,
  onPlaybackError,
}: Readonly<EditorPreviewViewportProps>) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);

  const currentOffsetMs = Math.max(0, playheadMs - scopeWindowStartMs);
  const totalScopeDurationMs = Math.max(0, scopeWindowEndMs - scopeWindowStartMs);
  const beatNumber = selectedBeat ? String(selectedBeat.beatIndex + 1).padStart(2, "0") : "01";
  const beatTitle = selectedBeat?.title || "Visual Beat";
  const playback = selectedBeat ? previewPlaybackState(selectedBeat, playheadMs, frameRate) : null;
  const activeSubtitle = activeSubtitleAt(subtitleCues, playheadMs);

  useEffect(() => setMediaFailed(false), [mediaUrl, selectedBeat?.visualBeatId]);
  useEffect(() => setAudioFailed(false), [narrationUrl, narrationStartMs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedBeat || selectedBeat.mediaType !== "VIDEO" || !playback) return;
    const desiredSeconds = playback.mediaTimeMs / 1000;
    if (Number.isFinite(desiredSeconds) && Math.abs(video.currentTime - desiredSeconds) > 0.3) {
      try {
        video.currentTime = desiredSeconds;
      } catch {
        // Metadata may still be loading; the next narration-clock frame retries.
      }
    }
    video.playbackRate = playback.playbackRate;
    if (playing && playback.shouldPlayVideo) void video.play().catch(() => undefined);
    else video.pause();
  }, [mediaUrl, playback, playing, selectedBeat]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
  }, [muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || narrationStartMs == null || narrationEndMs == null) return;
    const desiredSeconds = narrationSeekSeconds(playheadMs, narrationStartMs, narrationEndMs);

    if (!playing) {
      audio.pause();
      if (Math.abs(audio.currentTime - desiredSeconds) > 0.15) {
        try {
          audio.currentTime = desiredSeconds;
        } catch {
          // Metadata can arrive after a timeline seek.
        }
      }
      return;
    }

    if (audioFailed) return;
    if (shouldResyncNarration(audio.currentTime, desiredSeconds)) {
      try {
        audio.currentTime = desiredSeconds;
      } catch {
        // Metadata can arrive after an active timeline seek.
      }
    }
    if (audio.paused) {
      void audio.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("Narration audio play error:", error);
        setAudioFailed(true);
        onPlaybackError("Không thể phát narration audio cho preview. Đã chuyển sang timer đồng bộ.");
      });
    }
  }, [audioFailed, narrationEndMs, narrationStartMs, narrationUrl, onPlaybackError, playheadMs, playing]);

  useEffect(() => {
    if (!playing || narrationStartMs == null || narrationEndMs == null) return;
    let frame = 0;
    const sampleAudioClock = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused && !audioFailed) {
        onNarrationClock(
          globalPlayheadFromNarrationSeconds(
            audio.currentTime,
            narrationStartMs,
            narrationEndMs,
          ),
        );
      }
      frame = window.requestAnimationFrame(sampleAudioClock);
    };
    frame = window.requestAnimationFrame(sampleAudioClock);
    return () => window.cancelAnimationFrame(frame);
  }, [audioFailed, narrationEndMs, narrationStartMs, onNarrationClock, playing]);

  const objectFit = selectedBeat?.mediaType === "IMAGE" ? "cover" : "contain";
  const showMedia = Boolean(mediaUrl && selectedBeat?.mediaType && !mediaFailed);
  const previewStatus = audioFailed
    ? "Audio error"
    : previewLoading
      ? "Loading"
      : showMedia
        ? "Live preview"
        : selectedBeat?.assetReady
          ? "Ready"
          : "Draft";

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
    <div className="nx-editor-preview-viewport flex min-h-0 flex-col bg-background px-5 py-2">
      {narrationUrl && (
        <audio
          key={narrationUrl}
          ref={audioRef}
          src={narrationUrl}
          preload="auto"
          onEnded={onNarrationEnded}
          onError={(event) => {
            console.warn("Narration audio load error for URL:", narrationUrl, event);
            setAudioFailed(true);
            onPlaybackError("Không tải được narration audio cho preview.");
          }}
          className="hidden"
        />
      )}

      <div className="mx-auto flex h-8 shrink-0 w-full max-w-[1040px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-mono text-[10px] font-semibold text-text-dim">{beatNumber}</span>
          <h2 className="nx-preview-scene-title truncate text-[13px] font-semibold tracking-tight text-foreground">{beatTitle}</h2>
          <span className={`flex items-center gap-1.5 text-[10px] font-medium ${audioFailed ? "text-danger" : "text-text-muted"}`}>
            <span className={`size-1.5 rounded-full ${audioFailed ? "bg-danger" : showMedia ? "bg-success" : previewLoading ? "bg-warning" : "bg-text-dim"}`} aria-hidden="true" />
            {previewStatus}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[10px] text-text-dim">
          <span>Duration <strong className="ml-1 font-mono font-medium text-text-secondary">{formatTimecode(selectedBeat?.durationMs || 10_000)}</strong></span>
          <button type="button" className="nx-icon-button size-6" aria-label="More options"><MoreVertical size={13} /></button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1">
        <div ref={frameRef} className="nx-editor-preview-frame relative aspect-video max-h-full max-w-full overflow-hidden rounded-md border border-border-subtle bg-surface-dark">
          {showMedia && selectedBeat?.mediaType === "IMAGE" ? (
            <img
              src={mediaUrl as string}
              alt={selectedBeat.title || "Visual beat preview"}
              onError={() => setMediaFailed(true)}
              className="h-full w-full select-none will-change-transform"
              style={{ objectFit, transform: playback?.imageTransform || "scale(1)" }}
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
            <div className="flex h-full w-full items-center justify-center bg-surface-dark">
              <div className="max-w-lg px-6 text-center">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim">
                  {selectedBeat?.cameraMovement || "AUTO EDIT"}
                </span>
                <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-foreground">
                  {previewLoading ? "Đang tải preview…" : selectedBeat?.title || "Visual Beat"}
                </h3>
                <p className="mt-2 max-w-md text-[11px] leading-5 text-text-muted">
                  {mediaFailed
                    ? "Không tải được media preview. Render source vẫn được giữ nguyên."
                    : previewMessage || selectedBeat?.visualIntent || "Chưa có media để preview."}
                </p>
              </div>
            </div>
          )}

          <div
            className="pointer-events-none absolute inset-0 z-10 bg-black"
            style={{ opacity: transitionBlackOpacity }}
            aria-hidden="true"
          />

          {activeSubtitle && (
            <div
              className="pointer-events-none absolute z-20 flex justify-center"
              style={{
                left: `${((1 - SUBTITLE_STYLE_V1.maxWidthRatio) / 2) * 100}%`,
                right: `${((1 - SUBTITLE_STYLE_V1.maxWidthRatio) / 2) * 100}%`,
                bottom: `${SUBTITLE_STYLE_V1.bottomMarginRatio * 100}%`,
              }}
            >
              <span
                className="rounded-sm px-3 py-1.5 text-center leading-snug"
                style={{
                  maxWidth: "100%",
                  fontFamily: SUBTITLE_STYLE_V1.fontFamily,
                  fontWeight: SUBTITLE_STYLE_V1.fontWeight,
                  fontSize: `clamp(11px, ${SUBTITLE_STYLE_V1.fontSizeRatio * 100}vw, 19px)`,
                  color: SUBTITLE_STYLE_V1.primaryColor,
                  backgroundColor: hexToRgba(
                    SUBTITLE_STYLE_V1.backgroundColor,
                    SUBTITLE_STYLE_V1.backgroundOpacity,
                  ),
                  textShadow: `0 ${Math.max(1, SUBTITLE_STYLE_V1.shadowDepthRatio * 1000)}px ${Math.max(2, SUBTITLE_STYLE_V1.outlineWidthRatio * 1600)}px ${SUBTITLE_STYLE_V1.outlineColor}`,
                }}
              >
                {activeSubtitle.text}
              </span>
            </div>
          )}

          {audioFailed && (
            <div className="absolute inset-x-4 bottom-4 z-30 border-l-2 border-danger bg-black/80 px-3 py-2 text-center text-[10px] text-danger">
              Không tải được luồng audio cho chương này. Playback vẫn đang chạy bằng timer đồng bộ.
            </div>
          )}
        </div>
      </div>

      <div className="relative mx-auto flex h-11 w-full max-w-[1040px] items-center justify-between">
        <div className="font-mono text-[10px]">
          <span className="font-medium text-foreground">{formatFullTimecode(currentOffsetMs)}</span>
          <span className="mx-1.5 text-text-dim">/</span>
          <span className="text-text-muted">{formatFullTimecode(totalScopeDurationMs || 10_000)}</span>
        </div>
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5">
          <button type="button" onClick={onPrevBeat} className="nx-icon-button" title="Previous beat"><SkipBack size={15} /></button>
          <button type="button" onClick={() => onStepMs(-500)} className="nx-icon-button" title="Step back"><ChevronsLeft size={16} /></button>
          <button type="button" onClick={onTogglePlay} className="mx-1 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary-hover" title={playing ? "Pause" : "Play"}>{playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5 fill-current" />}</button>
          <button type="button" onClick={() => onStepMs(500)} className="nx-icon-button" title="Step forward"><ChevronsRight size={16} /></button>
          <button type="button" onClick={onNextBeat} className="nx-icon-button" title="Next beat"><SkipForward size={15} /></button>
          <button type="button" onClick={() => setMuted(!muted)} className="nx-icon-button ml-1" title={muted ? "Unmute narration" : "Mute narration"}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-dim" title="Preview framing follows final render policy">
            {selectedBeat?.mediaType === "IMAGE" ? "Cover" : "Contain"}
          </span>
          <button type="button" onClick={() => void toggleFullscreen()} className="nx-icon-button size-7 border border-border-subtle bg-surface-input" title="Toàn màn hình"><Maximize2 size={12} /></button>
        </div>
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace(/^#/, "");
  const value = Number.parseInt(normalized.padEnd(6, "0").slice(0, 6), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`;
}

function formatTimecode(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

function formatFullTimecode(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
