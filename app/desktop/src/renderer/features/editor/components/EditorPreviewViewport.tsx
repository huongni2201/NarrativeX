import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
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
import type { DesktopTimelineBeat } from "@narrativex/client-contracts";
import { activeSubtitleAt, type PlannedSubtitle } from "../../../../shared/subtitle-planner";
import {
  globalPlayheadFromNarrationSeconds,
  narrationSeekSeconds,
  previewPlaybackState,
  shouldResyncNarration,
} from "../preview-playback";

interface EditorPreviewViewportProps {
  selectedBeat: DesktopTimelineBeat | null;
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
  const [fitMode, setFitMode] = useState<"Fit" | "100%" | "Fill">("Fit");
  const [isFitOpen, setIsFitOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);

  const currentOffsetMs = Math.max(0, playheadMs - scopeWindowStartMs);
  const totalScopeDurationMs = Math.max(0, scopeWindowEndMs - scopeWindowStartMs);
  const beatNumber = selectedBeat ? String(selectedBeat.beatIndex + 1).padStart(2, "0") : "01";
  const beatTitle = selectedBeat?.title || "Visual Beat";
  const playback = selectedBeat ? previewPlaybackState(selectedBeat, playheadMs) : null;
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
        const message = error instanceof Error ? error.message : "Narration audio could not play.";
        setAudioFailed(true);
        onPlaybackError(message);
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
    <div className="nx-editor-preview-viewport flex min-h-0 flex-col bg-background px-5 py-2">
      {narrationUrl && (
        <audio
          key={narrationUrl}
          ref={audioRef}
          src={narrationUrl}
          preload="auto"
          onEnded={onNarrationEnded}
          onError={() => {
            setAudioFailed(true);
            onPlaybackError("Không tải được narration audio cho preview.");
          }}
          className="hidden"
        />
      )}

      <div className="mx-auto flex h-8 shrink-0 w-full max-w-[1040px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-mono text-[12px] font-bold text-text-dim">{beatNumber}</span>
          <h2 className="nx-preview-scene-title truncate text-[13px] font-bold text-foreground">{beatTitle}</h2>
          <span className="rounded-full bg-[#182236] px-2.5 py-0.5 text-[10px] font-semibold text-[#8faadc]">
            {audioFailed ? "Audio error" : previewLoading ? "Loading" : showMedia ? "Live preview" : selectedBeat?.assetReady ? "Ready" : "Draft"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] text-text-dim">
          <span>Duration <strong className="ml-1 font-mono font-semibold text-foreground">{formatTimecode(selectedBeat?.durationMs || 10_000)}</strong></span>
          <button type="button" className="nx-icon-button size-6 text-text-muted hover:text-foreground" aria-label="More options"><MoreVertical size={14} /></button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1">
        <div ref={frameRef} className="nx-editor-preview-frame relative aspect-video max-h-full max-w-full overflow-hidden rounded-xl border border-border-subtle bg-[#080c14] shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
          {showMedia && selectedBeat?.mediaType === "IMAGE" ? (
            <img
              src={mediaUrl as string}
              alt={selectedBeat.title || "Visual beat preview"}
              onError={() => setMediaFailed(true)}
              className="h-full w-full select-none will-change-transform"
              style={{
                objectFit,
                transform: playback?.imageTransform || "scale(1)",
                transition: playing ? "transform 90ms linear" : "none",
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
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#070b12]">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-80" aria-hidden="true">
                <svg viewBox="0 0 900 220" preserveAspectRatio="none" className="h-full w-full">
                  <defs>
                    <linearGradient id="preview-wave-gradient-1" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#43187a" stopOpacity="0.85" /><stop offset="50%" stopColor="#7c3aed" stopOpacity="0.65" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0.8" /></linearGradient>
                    <linearGradient id="preview-wave-gradient-2" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stopColor="#7c3aed" stopOpacity="0.4" /><stop offset="70%" stopColor="#3b82f6" stopOpacity="0.3" /><stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" /></linearGradient>
                  </defs>
                  <path d="M0 150 C140 90 230 190 380 135 S620 70 900 115" fill="none" stroke="url(#preview-wave-gradient-1)" strokeWidth="2.5" />
                  <path d="M0 165 C150 110 240 210 400 150 S650 80 900 130" fill="none" stroke="url(#preview-wave-gradient-2)" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="relative z-10 max-w-lg px-6 text-center">
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{selectedBeat?.cameraMovement || "AUTO EDIT"}</span>
                <h3 className="mt-2 text-[24px] font-extrabold tracking-tight text-white">{previewLoading ? "Đang tải preview…" : selectedBeat?.title || "Visual Beat"}</h3>
                <p className="mt-2.5 text-[13px] text-[#7d8b9e]">{mediaFailed ? "Không tải được media preview. Render source vẫn được giữ nguyên." : previewMessage || selectedBeat?.visualIntent || "Chưa có media để preview."}</p>
              </div>
            </div>
          )}

          <div
            className="pointer-events-none absolute inset-0 z-10 bg-black"
            style={{ opacity: transitionBlackOpacity }}
            aria-hidden="true"
          />

          {activeSubtitle && (
            <div className="pointer-events-none absolute inset-x-[8%] bottom-[7%] z-20 flex justify-center">
              <span className="max-w-[90%] rounded-md bg-black/70 px-3 py-1.5 text-center text-[clamp(12px,1.5vw,22px)] font-semibold leading-snug text-white shadow-lg [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                {activeSubtitle.text}
              </span>
            </div>
          )}

          {audioFailed && (
            <div className="absolute inset-x-4 bottom-4 z-30 rounded-md border border-red-400/30 bg-black/80 px-3 py-2 text-center text-[10px] text-red-200">
              Narration preview failed. Playback đã dừng để timeline không bị lệch audio.
            </div>
          )}
        </div>
      </div>

      <div className="relative mx-auto flex h-11 w-full max-w-[1040px] items-center justify-between">
        <div className="font-mono text-[11px]"><span className="font-semibold text-foreground">{formatFullTimecode(currentOffsetMs)}</span><span className="mx-1.5 text-text-dim">/</span><span className="text-text-muted">{formatFullTimecode(totalScopeDurationMs || 10_000)}</span></div>
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
          <button type="button" onClick={onPrevBeat} className="nx-icon-button text-text-muted hover:text-foreground" title="Previous beat"><SkipBack size={15} /></button>
          <button type="button" onClick={() => onStepMs(-500)} className="nx-icon-button text-text-muted hover:text-foreground" title="Step back"><ChevronsLeft size={16} /></button>
          <button type="button" onClick={onTogglePlay} disabled={!narrationUrl || audioFailed} className="mx-1 flex size-9 items-center justify-center rounded-full bg-primary text-white shadow-[0_0_16px_rgba(255,138,0,0.35)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40" title={playing ? "Pause" : "Play"}>{playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5 fill-white" />}</button>
          <button type="button" onClick={() => onStepMs(500)} className="nx-icon-button text-text-muted hover:text-foreground" title="Step forward"><ChevronsRight size={16} /></button>
          <button type="button" onClick={onNextBeat} className="nx-icon-button text-text-muted hover:text-foreground" title="Next beat"><SkipForward size={15} /></button>
          <button type="button" onClick={() => setMuted(!muted)} className="nx-icon-button ml-1 text-text-muted hover:text-foreground" title={muted ? "Unmute narration" : "Mute narration"}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <button type="button" onClick={() => setIsFitOpen(!isFitOpen)} className="flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-input px-2.5 text-[10px] font-medium text-text-secondary hover:border-border hover:bg-surface-2"><span>{fitMode}</span><ChevronDown size={11} /></button>
            {isFitOpen && (
              <div className="absolute bottom-8 right-0 z-30 w-24 rounded-md border border-border-subtle bg-surface-elevated p-1 shadow-[var(--shadow-panel)]">
                {(["Fit", "100%", "Fill"] as const).map((mode) => <button key={mode} type="button" onClick={() => { setFitMode(mode); setIsFitOpen(false); }} className={`w-full rounded px-2 py-1.5 text-left text-[10px] ${fitMode === mode ? "bg-primary-muted font-semibold text-primary" : "text-text-muted hover:bg-surface-3"}`}>{mode}</button>)}
              </div>
            )}
          </div>
          <button type="button" onClick={() => void toggleFullscreen()} className="grid size-7 place-items-center rounded-md border border-border-subtle bg-surface-input text-text-muted hover:text-foreground" title="Toàn màn hình"><Maximize2 size={12} /></button>
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

function formatFullTimecode(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
