import { useMemo, useRef, useState } from "react";
import {
  Eye,
  Film,
  Link as LinkIcon,
  Lock,
  Search,
  Type,
  Upload,
  ZoomIn,
} from "lucide-react";
import type {
  DesktopTimeline,
  DesktopTimelineBeat,
} from "@narrativex/client-contracts";

interface EditorMultiTrackTimelineProps {
  beats: DesktopTimelineBeat[];
  chapters: DesktopTimeline["chapters"];
  playheadMs: number;
  totalDurationMs: number;
  selectedBeatId: string;
  onSelectBeat: (beat: DesktopTimelineBeat) => void;
  onSeek: (ms: number) => void;
  onUploadMedia?: (type: "IMAGE" | "VIDEO") => void;
}

export function EditorMultiTrackTimeline({
  beats,
  playheadMs,
  totalDurationMs,
  selectedBeatId,
  onSelectBeat,
  onSeek,
  onUploadMedia,
}: Readonly<EditorMultiTrackTimelineProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const effectiveTotalMs = useMemo(() => {
    if (totalDurationMs > 0) return totalDurationMs;
    const lastBeatEnd = beats.reduce((maximum, beat) => Math.max(maximum, beat.endMs), 0);
    return Math.max(20000, lastBeatEnd);
  }, [beats, totalDurationMs]);

  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepMs = 2000;
    const count = Math.ceil(effectiveTotalMs / stepMs) + 2;
    for (let index = 0; index <= count; index += 1) ticks.push(index * stepMs);
    return ticks;
  }, [effectiveTotalMs]);

  const playheadPercent = Math.max(0, Math.min(100, (playheadMs / effectiveTotalMs) * 100));

  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(Math.round(fraction * effectiveTotalMs));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background font-sans text-[11px] select-none">
      {/* Tracks Container */}
      <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Left Track Headers Rail */}
        <div className="w-36 shrink-0 border-r border-border-subtle bg-surface-dark">
          <div className="h-7 border-b border-border-subtle bg-surface-dark" />
          <TrackHeader index="1" label="Narration" heightClass="h-10" />
          <TrackHeader index="2" label="Visual Beats" heightClass="h-12" />
          <TrackHeader index="3" label="Voiceover" heightClass="h-10" />
          <TrackHeader index="4" label="Music" heightClass="h-10" />
        </div>

        {/* Timeline Lanes Surface */}
        <div
          ref={containerRef}
          onClick={handleTimelineClick}
          className="relative min-w-0 flex-none cursor-pointer bg-[#090d15]"
          style={{ width: `${zoomLevel * 100}%` }}
        >
          {/* Time Ruler */}
          <div className="relative h-7 border-b border-border-subtle bg-surface-dark">
            {rulerTicks.map((tickMs) => {
              const leftPercent = (tickMs / effectiveTotalMs) * 100;
              if (leftPercent > 100) return null;
              const isPlayheadNear = Math.abs(playheadMs - tickMs) < 1000;

              return (
                <div
                  key={tickMs}
                  className="absolute inset-y-0 flex flex-col justify-between"
                  style={{ left: `${leftPercent}%` }}
                >
                  <span className={`font-mono text-[9px] ${isPlayheadNear ? "font-bold text-primary" : "text-text-dim"}`}>
                    {formatRulerTime(tickMs)}
                  </span>
                  <div className="h-1.5 w-px bg-border-dark" />
                </div>
              );
            })}
          </div>

          {/* Track 1: Narration */}
          <div className="relative h-10 border-b border-border-subtle/50 px-1 py-1">
            <div
              className="absolute inset-y-1 left-0 flex items-center justify-between overflow-hidden rounded-md border border-[#1d5939] bg-[#0f241a] px-3 text-[#22c55e] shadow-[0_2px_8px_rgba(34,197,94,0.12)]"
              style={{ width: "55%" }}
            >
              <span className="shrink-0 font-mono text-[10px] font-medium">narration_voice.mp3</span>
              <AudioWaveformBars className="ml-3 h-4.5 flex-1 text-[#22c55e]" barCount={48} seed={1} />
            </div>
          </div>

          {/* Track 2: Visual Beats */}
          <div className="relative flex h-12 items-center border-b border-border-subtle/50 px-1 py-1">
            {beats.length > 0 ? (
              beats.map((beat) => {
                const isSelected = beat.visualBeatId === selectedBeatId;
                const leftPercent = (beat.startMs / effectiveTotalMs) * 100;
                const widthPercent = (beat.durationMs / effectiveTotalMs) * 100;

                return (
                  <button
                    key={beat.visualBeatId}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectBeat(beat);
                      onSeek(beat.startMs);
                    }}
                    className={`absolute inset-y-1 flex min-w-8 items-center justify-between overflow-hidden rounded-md border px-2 text-left transition-all ${
                      isSelected
                        ? "z-10 border-primary bg-[#13233d] shadow-[0_0_12px_rgba(255,138,0,0.25)] ring-1 ring-primary"
                        : "border-[#1d3d6b] bg-[#0f1b2e] hover:border-info/60 hover:bg-[#14233c]"
                    }`}
                    style={{ left: `${leftPercent}%`, width: `${Math.max(2, widthPercent)}%` }}
                    title={`${beat.title} · ${formatDurationSeconds(beat.durationMs)}`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <FilmFramesGraphic className="h-4.5 shrink-0 opacity-80 text-[#3b82f6]" />
                      <span className="truncate font-mono text-[10px] text-[#93c5fd]">
                        {beat.title ? `${beat.title.toLowerCase().replace(/\s+/g, "_")}.mp4` : "visual_beat_01.mp4"}
                      </span>
                    </div>
                    <LinkIcon size={11} className="shrink-0 text-[#60a5fa]" />
                  </button>
                );
              })
            ) : (
              <div
                className="absolute inset-y-1 left-0 flex items-center justify-between overflow-hidden rounded-md border border-[#1d3d6b] bg-[#0f1b2e] px-3 text-[#3b82f6] shadow-[0_2px_8px_rgba(59,130,246,0.12)]"
                style={{ width: "68%" }}
              >
                <div className="flex items-center gap-2">
                  <FilmFramesGraphic className="h-4.5 shrink-0 opacity-80 text-[#3b82f6]" />
                  <span className="font-mono text-[10px] text-[#93c5fd]">visual_beat_01.mp4</span>
                </div>
                <LinkIcon size={11} className="text-[#60a5fa]" />
              </div>
            )}
          </div>

          {/* Track 3: Voiceover */}
          <div className="relative h-10 border-b border-border-subtle/50 px-1 py-1">
            <div
              className="absolute inset-y-1 left-0 flex items-center justify-between overflow-hidden rounded-md border border-[#441f77] bg-[#1e1133] px-3 text-[#a855f7] shadow-[0_2px_8px_rgba(168,85,247,0.12)]"
              style={{ width: "68%" }}
            >
              <span className="shrink-0 font-mono text-[10px] font-medium">intro_voice.mp3</span>
              <AudioWaveformBars className="ml-3 h-4.5 flex-1 text-[#a855f7]" barCount={60} seed={2} />
            </div>
          </div>

          {/* Track 4: Music */}
          <div className="relative h-10 border-b border-border-subtle px-1 py-1">
            <div
              className="absolute inset-y-1 left-0 flex items-center justify-between overflow-hidden rounded-md border border-[#552e0c] bg-[#291708] px-3 text-[#f59e0b] shadow-[0_2px_8px_rgba(245,158,11,0.12)]"
              style={{ width: "95%" }}
            >
              <span className="shrink-0 font-mono text-[10px] font-medium">bgm_ambient_01.mp3</span>
              <AudioWaveformBars className="ml-3 h-4.5 flex-1 text-[#f59e0b]" barCount={80} seed={3} />
            </div>
          </div>

          {/* Orange Playhead Scrubber */}
          <div
            className="pointer-events-none absolute inset-y-0 z-30 w-px bg-primary"
            style={{ left: `${playheadPercent}%` }}
          >
            {/* Top Orange Flag Marker */}
            <div className="absolute -top-0.5 left-1/2 h-3.5 w-2 -translate-x-1/2 rounded-[2px] bg-primary shadow-[0_0_8px_rgba(255,138,0,0.6)]" />
          </div>
        </div>
      </div>

      {/* Bottom Timeline Toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between gap-4 border-t border-border-subtle bg-surface-dark px-4 text-[10px] text-text-muted">
        {/* Left Badges & Filters */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-input px-2.5 py-1 text-[10px]">
            <span className="rounded bg-[#2a1b08] px-1 py-0.5 font-mono text-[8px] font-bold text-primary">AI</span>
            <span className="text-text-secondary">AI Generated</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-input px-2.5 py-1 text-[10px]">
            <span className="rounded bg-[#0f241a] px-1 py-0.5 font-mono text-[8px] font-bold text-[#22c55e]">IMG</span>
            <span className="text-text-secondary">Uploaded Image</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-input px-2.5 py-1 text-[10px]">
            <span className="rounded bg-[#0f1b2e] px-1 py-0.5 font-mono text-[8px] font-bold text-[#3b82f6]">VID</span>
            <span className="text-text-secondary">Uploaded Video</span>
          </div>

          <button
            type="button"
            className="ml-2 flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-input px-3 text-[11px] font-medium text-text-secondary transition hover:border-border hover:bg-surface-2"
          >
            <Type size={12} className="text-text-muted" />
            <span>Text</span>
          </button>

          <button
            type="button"
            onClick={() => onUploadMedia?.("IMAGE")}
            className="flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-input px-3 text-[11px] font-medium text-text-secondary transition hover:border-border hover:bg-surface-2"
          >
            <Upload size={12} className="text-text-muted" />
            <span>Upload Media</span>
          </button>

          <button
            type="button"
            onClick={() => onUploadMedia?.("VIDEO")}
            className="flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-input px-3 text-[11px] font-medium text-text-secondary transition hover:border-border hover:bg-surface-2"
          >
            <Film size={12} className="text-text-muted" />
            <span>Upload Video</span>
          </button>
        </div>

        {/* Right Zoom Controls */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomLevel((zoom) => Math.max(0.75, zoom - 0.25))}
            className="nx-icon-button size-6 text-text-muted hover:text-foreground"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Search size={12} />
          </button>
          <input
            type="range"
            min={0.75}
            max={2.5}
            step={0.25}
            value={zoomLevel}
            onChange={(event) => setZoomLevel(Number.parseFloat(event.target.value))}
            className="h-1 w-20 cursor-pointer accent-primary"
            aria-label="Timeline zoom"
          />
          <button
            type="button"
            onClick={() => setZoomLevel((zoom) => Math.min(2.5, zoom + 0.25))}
            className="nx-icon-button size-6 text-text-muted hover:text-foreground"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TrackHeader({
  index,
  label,
  heightClass,
}: Readonly<{
  index: string;
  label: string;
  heightClass: string;
}>) {
  return (
    <div className={`flex items-center justify-between border-b border-border-subtle px-3 ${heightClass}`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-text-dim">{index}</span>
        <span className="text-[11px] font-medium text-text-secondary">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 text-text-dim">
        <button type="button" className="text-text-dim hover:text-text-secondary" aria-label="Lock track">
          <Lock size={11} />
        </button>
        <button type="button" className="text-text-dim hover:text-text-secondary" aria-label="Mute / Hide track">
          <Eye size={11} />
        </button>
      </div>
    </div>
  );
}

function AudioWaveformBars({
  className,
  barCount = 40,
  seed = 1,
}: Readonly<{
  className?: string;
  barCount?: number;
  seed?: number;
}>) {
  const bars = useMemo(() => {
    const items: number[] = [];
    for (let i = 0; i < barCount; i += 1) {
      const v = Math.abs(Math.sin((i + seed * 3) * 0.4) * 0.7 + Math.cos((i * 2 + seed) * 0.3) * 0.3);
      items.push(Math.max(0.15, Math.min(0.95, v)));
    }
    return items;
  }, [barCount, seed]);

  return (
    <div className={`flex items-center gap-[2px] opacity-75 ${className}`}>
      {bars.map((height, idx) => (
        <span
          key={idx}
          className="w-[2px] rounded-full bg-current"
          style={{ height: `${Math.round(height * 100)}%` }}
        />
      ))}
    </div>
  );
}

function FilmFramesGraphic({ className }: Readonly<{ className?: string }>) {
  return (
    <div className={`flex items-center gap-1 opacity-70 ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-4 w-3 rounded-sm border border-current bg-current/20" />
      ))}
    </div>
  );
}

function formatRulerTime(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDurationSeconds(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
