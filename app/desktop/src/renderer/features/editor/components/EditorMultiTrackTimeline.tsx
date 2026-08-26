import { useMemo, useRef, useState } from "react";
import {
  FileImage,
  Lock,
  Mic,
  Music,
  Volume2,
  ZoomIn,
  ZoomOut,
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
}

export function EditorMultiTrackTimeline({
  beats,
  playheadMs,
  totalDurationMs,
  selectedBeatId,
  onSelectBeat,
  onSeek,
}: Readonly<EditorMultiTrackTimelineProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const effectiveTotalMs = useMemo(() => {
    if (totalDurationMs > 0) return totalDurationMs;
    const lastBeatEnd = beats.reduce((maximum, beat) => Math.max(maximum, beat.endMs), 0);
    return Math.max(30000, lastBeatEnd);
  }, [beats, totalDurationMs]);

  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepMs = 3000;
    const count = Math.ceil(effectiveTotalMs / stepMs) + 1;
    for (let index = 0; index <= count; index += 1) ticks.push(index * stepMs);
    return ticks;
  }, [effectiveTotalMs]);

  const playheadPercent = Math.max(0, Math.min(100, (playheadMs / effectiveTotalMs) * 100));
  const contentEndMs = beats.reduce((maximum, beat) => Math.max(maximum, beat.endMs), 0);
  const contentWidthPercent = Math.min(100, (contentEndMs / effectiveTotalMs) * 100);

  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(Math.round(fraction * effectiveTotalMs));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-[10px] select-none">
      <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="w-32 shrink-0 border-r border-border-subtle bg-surface-dark">
          <div className="h-6 border-b border-border-subtle bg-surface-panel" />
          <TrackHeader index="1" label="Narration" icon={<Volume2 size={10} />} heightClass="h-9" />
          <TrackHeader index="2" label="Visual Beats" icon={<FileImage size={10} />} heightClass="h-14" />
          <TrackHeader index="3" label="Voiceover" icon={<Mic size={10} />} heightClass="h-9" />
          <TrackHeader index="4" label="Music" icon={<Music size={10} />} heightClass="h-9" />
        </div>

        <div
          ref={containerRef}
          onClick={handleTimelineClick}
          className="relative min-w-[760px] flex-1 cursor-pointer bg-background"
          style={{ width: `${Math.max(100, zoomLevel * 100)}%` }}
        >
          <div className="relative h-6 border-b border-border-subtle bg-surface-dark">
            {rulerTicks.map((tickMs) => {
              const leftPercent = (tickMs / effectiveTotalMs) * 100;
              if (leftPercent > 100) return null;
              const isPlayheadNear = Math.abs(playheadMs - tickMs) < 1500;

              return (
                <div
                  key={tickMs}
                  className="absolute inset-y-0 flex flex-col justify-between"
                  style={{ left: `${leftPercent}%` }}
                >
                  <span className={`font-mono text-[8px] ${isPlayheadNear ? "font-semibold text-primary-hover" : "text-text-dim"}`}>
                    {formatRulerTime(tickMs)}
                  </span>
                  <div className="h-1 w-px bg-border-dark" />
                </div>
              );
            })}
          </div>

          <div className="relative h-9 border-b border-border-subtle px-1 py-1">
            <div
              className="absolute inset-y-1 left-0 flex items-center rounded-sm border border-success/30 bg-success-bg px-2 text-success"
              style={{ width: `${contentWidthPercent}%` }}
            >
              <span className="shrink-0 font-mono text-[8px]">narration_voice.mp3</span>
              <WaveformSvg className="ml-2 h-3 flex-1 opacity-70" />
            </div>
          </div>

          <div className="relative flex h-14 items-center border-b border-border-subtle p-1">
            {beats.map((beat) => {
              const isSelected = beat.visualBeatId === selectedBeatId;
              const leftPercent = (beat.startMs / effectiveTotalMs) * 100;
              const widthPercent = (beat.durationMs / effectiveTotalMs) * 100;
              const mediaClass = beat.mediaType === "VIDEO"
                ? "border-info/40 bg-info-bg text-info"
                : beat.mediaType === "IMAGE"
                  ? "border-success/40 bg-success-bg text-success"
                  : "border-primary/40 bg-primary-muted text-primary-hover";

              return (
                <button
                  key={beat.visualBeatId}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectBeat(beat);
                    onSeek(beat.startMs);
                  }}
                  className={`absolute inset-y-1 flex min-w-6 items-center gap-1 overflow-hidden rounded-sm border px-1.5 text-left transition-colors ${
                    isSelected
                      ? "z-10 border-primary bg-surface-3 shadow-[var(--shadow-primary)] ring-1 ring-primary/55"
                      : "border-border bg-surface hover:border-border-dark hover:bg-surface-2"
                  }`}
                  style={{ left: `${leftPercent}%`, width: `${Math.max(1.8, widthPercent)}%` }}
                  title={`${beat.title} · ${formatDurationSeconds(beat.durationMs)}`}
                >
                  <span className={`rounded-sm border px-1 py-0.5 text-[7px] font-bold ${mediaClass}`}>
                    {beat.mediaType === "VIDEO" ? "VID" : beat.mediaType === "IMAGE" ? "IMG" : "AI"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[8px] text-text-secondary">
                    {beat.title}
                  </span>
                  <span className="shrink-0 font-mono text-[8px] text-text-dim">
                    {formatDurationSeconds(beat.durationMs)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative h-9 border-b border-border-subtle px-1 py-1">
            <div className="absolute inset-y-1 left-0 flex w-[42%] items-center rounded-sm border border-info/30 bg-info-bg px-2 text-info">
              <span className="shrink-0 font-mono text-[8px]">intro_voice.mp3</span>
              <WaveformSvg className="ml-2 h-3 flex-1 opacity-70" />
            </div>
          </div>

          <div className="relative h-9 border-b border-border-subtle px-1 py-1">
            <div className="absolute inset-y-1 left-0 flex w-[88%] items-center rounded-sm border border-warning/30 bg-warning-bg px-2 text-warning">
              <span className="shrink-0 font-mono text-[8px]">bgm_ambient_01.mp3</span>
              <WaveformSvg className="ml-2 h-3 flex-1 opacity-70" />
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 z-30 w-px bg-primary"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="absolute -top-0.5 left-1/2 size-2.5 -translate-x-1/2 rounded-full border border-foreground bg-primary shadow-[var(--shadow-primary)]" />
          </div>
        </div>
      </div>

      <div className="flex h-8 shrink-0 items-center justify-between border-t border-border-subtle bg-surface-dark px-3 text-[8px] text-text-muted">
        <div className="flex min-w-0 items-center gap-3">
          <Legend badge="AI" className="border-primary/40 bg-primary-muted text-primary-hover" label="AI generated" />
          <Legend badge="IMG" className="border-success/40 bg-success-bg text-success" label="Uploaded image" />
          <Legend badge="VID" className="border-info/40 bg-info-bg text-info" label="Uploaded video" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomLevel((zoom) => Math.max(0.75, zoom - 0.25))}
            className="nx-icon-button size-6"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={11} />
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
            className="nx-icon-button size-6"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TrackHeader({
  index,
  label,
  icon,
  heightClass,
}: Readonly<{
  index: string;
  label: string;
  icon: React.ReactNode;
  heightClass: string;
}>) {
  return (
    <div className={`flex items-center justify-between border-b border-border-subtle px-2 ${heightClass}`}>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[8px] text-text-dim">{index}</span>
        <span className="text-[9px] font-medium text-text-secondary">{label}</span>
      </div>
      <div className="flex items-center gap-1 text-text-dim">
        {icon}
        <Lock size={9} />
      </div>
    </div>
  );
}

function Legend({ badge, className, label }: Readonly<{ badge: string; className: string; label: string }>) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={`rounded-sm border px-1 py-0.5 text-[7px] font-bold ${className}`}>{badge}</span>
      <span>{label}</span>
    </div>
  );
}

function WaveformSvg({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      viewBox="0 0 400 30"
      preserveAspectRatio="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M0,15 Q20,3 40,15 T80,15 T120,5 T160,25 T200,10 T240,20 T280,7 T320,23 T360,12 T400,15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
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
