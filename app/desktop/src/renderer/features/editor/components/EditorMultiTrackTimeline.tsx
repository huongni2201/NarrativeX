import { useMemo, useRef } from "react";
import {
  FileImage,
  Film,
  Lock,
  Mic,
  Music,
  Volume2,
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
  zoom?: number;
}

export function EditorMultiTrackTimeline({
  beats,
  chapters,
  playheadMs,
  totalDurationMs,
  selectedBeatId,
  onSelectBeat,
  onSeek,
  zoom = 1,
}: Readonly<EditorMultiTrackTimelineProps>) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute duration bounds
  const effectiveTotalMs = useMemo(() => {
    if (totalDurationMs > 0) return totalDurationMs;
    const lastBeatEnd = beats.reduce((max, beat) => Math.max(max, beat.endMs), 0);
    return Math.max(30000, lastBeatEnd);
  }, [beats, totalDurationMs]);

  // Generate ruler tick marks (e.g. every 3 seconds: 00:00, 00:03, 00:06...)
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
    <div className="flex h-full min-h-0 flex-col border-t border-border/70 bg-[#080b10] select-none">
      <div className="flex flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        {/* Left Track Headers (Fixed Column) */}
        <div className="w-44 shrink-0 border-r border-border/60 bg-[#0c1017]">
          {/* Ruler spacer */}
          <div className="h-7 border-b border-border/50 bg-[#090d14]" />

          {/* Track 1: Narration */}
          <div className="flex h-11 items-center justify-between border-b border-border/40 px-3 text-xs">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <span className="font-mono text-muted-foreground text-[11px]">1</span>
              <span>Narration</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Lock size={12} className="opacity-70" />
              <Volume2 size={12} className="opacity-70" />
            </div>
          </div>

          {/* Track 2: Visual Beats */}
          <div className="flex h-16 items-center justify-between border-b border-border/40 px-3 text-xs">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <span className="font-mono text-muted-foreground text-[11px]">2</span>
              <span>Visual Beats</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileImage size={12} className="opacity-70" />
              <Lock size={12} className="opacity-70" />
            </div>
          </div>

          {/* Track 3: Voiceover */}
          <div className="flex h-11 items-center justify-between border-b border-border/40 px-3 text-xs">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <span className="font-mono text-muted-foreground text-[11px]">3</span>
              <span>Voiceover</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Mic size={12} className="opacity-70" />
              <Lock size={12} className="opacity-70" />
            </div>
          </div>

          {/* Track 4: Music */}
          <div className="flex h-11 items-center justify-between border-b border-border/40 px-3 text-xs">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <span className="font-mono text-muted-foreground text-[11px]">4</span>
              <span>Music</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Music size={12} className="opacity-70" />
              <Lock size={12} className="opacity-70" />
            </div>
          </div>
        </div>

        {/* Right Tracks Canvas Area */}
        <div
          ref={containerRef}
          onClick={handleTimelineClick}
          className="relative min-w-[900px] flex-1 cursor-pointer bg-[#0a0e16]"
          style={{ width: `${Math.max(100, zoom * 100)}%` }}
        >
          {/* Time Ruler */}
          <div className="relative h-7 border-b border-border/50 bg-[#0c1017]">
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
                    className={`font-mono text-[10px] ${
                      isPlayheadNear ? "font-bold text-[#ff8a00]" : "text-muted-foreground/80"
                    }`}
                  >
                    {formatRulerTime(tickMs)}
                  </span>
                  <div className="h-1.5 w-px bg-border/80" />
                </div>
              );
            })}
          </div>

          {/* Track 1: Narration Row */}
          <div className="relative h-11 border-b border-border/40 px-1 py-1">
            <div
              className="absolute inset-y-1 rounded-md border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-emerald-900/40 to-emerald-950/60 px-2.5 flex items-center shadow-sm"
              style={{
                left: "0%",
                width: `${Math.min(100, (beats.reduce((acc, b) => Math.max(acc, b.endMs), 0) / effectiveTotalMs) * 100)}%`,
              }}
            >
              <span className="truncate font-mono text-[11px] font-medium text-emerald-400">
                narration_voice.mp3
              </span>
              <WaveformSvg color="#34d399" className="ml-2 h-4 flex-1 opacity-70" />
            </div>
          </div>

          {/* Track 2: Visual Beats Row */}
          <div className="relative h-16 border-b border-border/40 p-1 flex items-center">
            {beats.map((beat) => {
              const isSelected = beat.visualBeatId === selectedBeatId;
              const leftPercent = (beat.startMs / effectiveTotalMs) * 100;
              const widthPercent = (beat.durationMs / effectiveTotalMs) * 100;
              const beatNumber = String(beat.beatIndex + 1).padStart(2, "0");

              return (
                <div
                  key={beat.visualBeatId}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBeat(beat);
                    onSeek(beat.startMs);
                  }}
                  className={`absolute inset-y-1.5 flex cursor-pointer items-center gap-2 overflow-hidden rounded-lg border px-2 transition-all duration-150 ${
                    isSelected
                      ? "z-10 border-[#ff8a00] bg-gradient-to-r from-[#241c16] via-[#1a1c24] to-[#121620] shadow-[0_0_16px_rgba(255,138,0,0.45)] ring-1 ring-[#ff8a00]"
                      : "border-border/60 bg-[#121824] hover:border-border hover:bg-[#182030]"
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${Math.max(1.5, widthPercent)}%`,
                  }}
                >
                  {/* Badge: AI / IMAGE / VIDEO */}
                  <span
                    className={`rounded px-1 py-0.5 font-bold uppercase text-[9px] ${
                      beat.mediaType === "VIDEO"
                        ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                        : beat.mediaType === "IMAGE"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-[#ff8a00]/20 text-[#ff8a00] border border-[#ff8a00]/30"
                    }`}
                  >
                    {beat.mediaType ?? "AI"}
                  </span>

                  {/* Thumbnail / Title snippet */}
                  <span className="truncate text-xs font-semibold text-foreground">
                    {beat.title || `Beat ${beatNumber}`}
                  </span>

                  {/* Duration on right */}
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatDurationSeconds(beat.durationMs)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Track 3: Voiceover Row */}
          <div className="relative h-11 border-b border-border/40 px-1 py-1">
            <div
              className="absolute inset-y-1 rounded-md border border-purple-500/40 bg-gradient-to-r from-purple-950/60 via-purple-900/40 to-purple-950/60 px-2.5 flex items-center shadow-sm"
              style={{
                left: "0%",
                width: "45%",
              }}
            >
              <span className="truncate font-mono text-[11px] font-medium text-purple-300">
                intro_voice.mp3
              </span>
              <WaveformSvg color="#c084fc" className="ml-2 h-4 flex-1 opacity-70" />
            </div>
          </div>

          {/* Track 4: Music Row */}
          <div className="relative h-11 border-b border-border/40 px-1 py-1">
            <div
              className="absolute inset-y-1 rounded-md border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-amber-950/60 px-2.5 flex items-center shadow-sm"
              style={{
                left: "0%",
                width: "90%",
              }}
            >
              <span className="truncate font-mono text-[11px] font-medium text-amber-300">
                bgm_ambient_01.mp3
              </span>
              <WaveformSvg color="#f59e0b" className="ml-2 h-4 flex-1 opacity-70" />
            </div>
          </div>

          {/* Playhead Scrub Line & Knob */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-[#ff8a00]"
            style={{ left: `${playheadPercent}%` }}
          >
            {/* Scrubber Top Handle */}
            <div className="absolute -top-1 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white bg-[#ff8a00] shadow-[0_0_10px_rgba(255,138,0,0.8)]" />
          </div>
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

