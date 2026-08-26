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

  // Compute duration bounds
  const effectiveTotalMs = useMemo(() => {
    if (totalDurationMs > 0) return totalDurationMs;
    const lastBeatEnd = beats.reduce((max, beat) => Math.max(max, beat.endMs), 0);
    return Math.max(30000, lastBeatEnd);
  }, [beats, totalDurationMs]);

  // Generate ruler tick marks (00:00, 00:03, 00:06...)
  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepMs = 3000;
    const count = Math.ceil(effectiveTotalMs / stepMs) + 1;
    for (let i = 0; i <= count; i++) {
      ticks.push(i * stepMs);
    }
    return ticks;
  }, [effectiveTotalMs]);

  const playheadPercent = Math.max(
    0,
    Math.min(100, (playheadMs / effectiveTotalMs) * 100),
  );

  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(Math.round(fraction * effectiveTotalMs));
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-border/60 bg-[#070a0f] select-none text-xs">
      {/* Scrollable Tracks Viewport */}
      <div className="flex flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        {/* Left Track Headers Column */}
        <div className="w-36 shrink-0 border-r border-border/50 bg-[#090d15]">
          {/* Ruler blank spacer */}
          <div className="h-6 border-b border-border/40 bg-[#080b12]" />

          {/* Track 1: Narration */}
          <div className="flex h-10 items-center justify-between border-b border-border/40 px-2.5">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="font-mono text-muted-foreground text-[10px]">1</span>
              <span className="text-[11px]">Narration</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Lock size={11} className="opacity-60" />
              <Volume2 size={11} className="opacity-60" />
            </div>
          </div>

          {/* Track 2: Visual Beats */}
          <div className="flex h-14 items-center justify-between border-b border-border/40 px-2.5">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="font-mono text-muted-foreground text-[10px]">2</span>
              <span className="text-[11px]">Visual Beats</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <FileImage size={11} className="opacity-60" />
              <Lock size={11} className="opacity-60" />
            </div>
          </div>

          {/* Track 3: Voiceover */}
          <div className="flex h-10 items-center justify-between border-b border-border/40 px-2.5">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="font-mono text-muted-foreground text-[10px]">3</span>
              <span className="text-[11px]">Voiceover</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Mic size={11} className="opacity-60" />
              <Lock size={11} className="opacity-60" />
            </div>
          </div>

          {/* Track 4: Music */}
          <div className="flex h-10 items-center justify-between border-b border-border/40 px-2.5">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="font-mono text-muted-foreground text-[10px]">4</span>
              <span className="text-[11px]">Music</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Music size={11} className="opacity-60" />
              <Lock size={11} className="opacity-60" />
            </div>
          </div>
        </div>

        {/* Right Tracks Canvas */}
        <div
          ref={containerRef}
          onClick={handleTimelineClick}
          className="relative min-w-[760px] flex-1 cursor-pointer bg-[#080c14]"
          style={{ width: `${Math.max(100, zoomLevel * 100)}%` }}
        >
          {/* Time Ruler */}
          <div className="relative h-6 border-b border-border/40 bg-[#090d15]">
            {rulerTicks.map((tickMs) => {
              const leftPercent = (tickMs / effectiveTotalMs) * 100;
              if (leftPercent > 100) return null;
              const isPlayheadNear = Math.abs(playheadMs - tickMs) < 1500;

              return (
                <div
                  key={tickMs}
                  className="absolute top-0 bottom-0 flex flex-col justify-between"
                  style={{ left: `${leftPercent}%` }}
                >
                  <span
                    className={`font-mono text-[9px] ${
                      isPlayheadNear ? "font-bold text-[#ff8a00]" : "text-muted-foreground/70"
                    }`}
                  >
                    {formatRulerTime(tickMs)}
                  </span>
                  <div className="h-1 w-px bg-border/60" />
                </div>
              );
            })}
          </div>

          {/* Track 1: Narration */}
          <div className="relative h-10 border-b border-border/30 px-1 py-1">
            <div
              className="absolute inset-y-1 rounded-md border border-emerald-500/40 bg-gradient-to-r from-emerald-950/70 via-emerald-900/50 to-emerald-950/70 px-2 flex items-center shadow-sm"
              style={{
                left: "0%",
                width: `${Math.min(100, (beats.reduce((acc, b) => Math.max(acc, b.endMs), 0) / effectiveTotalMs) * 100)}%`,
              }}
            >
              <span className="truncate font-mono text-[10px] text-emerald-400">
                narration_voice.mp3
              </span>
              <WaveformSvg color="#34d399" className="ml-2 h-3.5 flex-1 opacity-70" />
            </div>
          </div>

          {/* Track 2: Visual Beats */}
          <div className="relative h-14 border-b border-border/30 p-1 flex items-center">
            {beats.map((beat) => {
              const isSelected = beat.visualBeatId === selectedBeatId;
              const leftPercent = (beat.startMs / effectiveTotalMs) * 100;
              const widthPercent = (beat.durationMs / effectiveTotalMs) * 100;

              return (
                <div
                  key={beat.visualBeatId}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBeat(beat);
                    onSeek(beat.startMs);
                  }}
                  className={`absolute inset-y-1 flex cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg border px-1.5 transition-all ${
                    isSelected
                      ? "z-10 border-[#ff8a00] bg-[#1a1f2c] shadow-[0_0_12px_rgba(255,138,0,0.4)] ring-1 ring-[#ff8a00]"
                      : "border-border/50 bg-[#0f1420] hover:border-border hover:bg-[#141b2b]"
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${Math.max(1.8, widthPercent)}%`,
                  }}
                >
                  {/* Badge */}
                  <span
                    className={`rounded px-1 py-0.2 font-bold uppercase text-[8px] ${
                      beat.mediaType === "VIDEO"
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                        : beat.mediaType === "IMAGE"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : "bg-[#ff8a00]/20 text-[#ff8a00] border border-[#ff8a00]/40"
                    }`}
                  >
                    {beat.mediaType === "VIDEO" ? "VID" : beat.mediaType === "IMAGE" ? "IMG" : "AI"}
                  </span>

                  {/* Thumbnail / Duration */}
                  <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">
                    {formatDurationSeconds(beat.durationMs)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Track 3: Voiceover */}
          <div className="relative h-10 border-b border-border/30 px-1 py-1">
            <div
              className="absolute inset-y-1 rounded-md border border-purple-500/40 bg-gradient-to-r from-purple-950/70 via-purple-900/50 to-purple-950/70 px-2 flex items-center shadow-sm"
              style={{
                left: "0%",
                width: "42%",
              }}
            >
              <span className="truncate font-mono text-[10px] text-purple-300">
                intro_voice.mp3
              </span>
              <WaveformSvg color="#c084fc" className="ml-2 h-3.5 flex-1 opacity-70" />
            </div>
          </div>

          {/* Track 4: Music */}
          <div className="relative h-10 border-b border-border/30 px-1 py-1">
            <div
              className="absolute inset-y-1 rounded-md border border-amber-500/40 bg-gradient-to-r from-amber-950/70 via-amber-900/50 to-amber-950/70 px-2 flex items-center shadow-sm"
              style={{
                left: "0%",
                width: "88%",
              }}
            >
              <span className="truncate font-mono text-[10px] text-amber-300">
                bgm_ambient_01.mp3
              </span>
              <WaveformSvg color="#f59e0b" className="ml-2 h-3.5 flex-1 opacity-70" />
            </div>
          </div>

          {/* Playhead Scrub Line & Knob */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-[#ff8a00]"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="absolute -top-0.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-[#ff8a00] shadow-[0_0_8px_rgba(255,138,0,0.8)]" />
          </div>
        </div>
      </div>

      {/* Bottom Timeline Footer: Badges Legend & Zoom Controls */}
      <div className="flex h-8 items-center justify-between border-t border-border/50 bg-[#080c14] px-3 text-[10px] text-muted-foreground">
        {/* Left Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-[#ff8a00]/20 px-1 py-0.2 font-bold text-[#ff8a00] border border-[#ff8a00]/40 text-[8px]">
              AI
            </span>
            <span>AI Generated Image</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rounded bg-emerald-500/20 px-1 py-0.2 font-bold text-emerald-400 border border-emerald-500/40 text-[8px]">
              IMG
            </span>
            <span>Uploaded Image</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rounded bg-purple-500/20 px-1 py-0.2 font-bold text-purple-400 border border-purple-500/40 text-[8px]">
              VID
            </span>
            <span>Uploaded Video</span>
          </div>
        </div>

        {/* Right Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
            className="text-muted-foreground hover:text-foreground"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <input
            type="range"
            min={0.75}
            max={2.5}
            step={0.25}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-[#ff8a00]"
          />
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
            className="text-muted-foreground hover:text-foreground"
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

function WaveformSvg({ color, className }: Readonly<{ color: string; className?: string }>) {
  return (
    <svg
      viewBox="0 0 400 30"
      preserveAspectRatio="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0,15 Q20,3 40,15 T80,15 T120,5 T160,25 T200,10 T240,20 T280,7 T320,23 T360,12 T400,15"
        fill="none"
        stroke={color}
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
