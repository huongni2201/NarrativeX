import { useState } from "react";
import {
  ChevronDown,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
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

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-between bg-[#080b11] p-4">
      {/* 16:9 Viewport Canvas */}
      <div className="relative flex aspect-video max-h-[calc(100%-68px)] w-full max-w-4xl items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-[#0d131f] shadow-2xl shadow-black/80">
        {selectedBeat ? (
          <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-b from-[#141b29] via-[#0d1420] to-[#070b12]">
            {/* Cinematic preview atmosphere / backdrop */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1d2b40]/30 via-[#0a1018]/60 to-[#05080e]/95" />

            {/* Visual Beat Content Overlay */}
            <div className="relative z-10 flex flex-col items-center justify-center px-8 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ff8a00]/30 bg-[#ff8a00]/10 shadow-[0_0_24px_rgba(255,138,0,0.2)]">
                <Sparkles size={26} className="text-[#ff8a00]" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#ff8a00]/90">
                Visual Beat {selectedBeat.beatIndex + 1}
              </span>
              <h3 className="mt-1 text-lg font-bold text-foreground drop-shadow-md">
                {selectedBeat.title}
              </h3>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground/90">
                {selectedBeat.visualIntent}
              </p>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="rounded-md border border-border/80 bg-[#121927] px-2.5 py-1">
                  {selectedBeat.mediaType ?? "NO MEDIA"}
                </span>
                <span className="rounded-md border border-border/80 bg-[#121927] px-2.5 py-1">
                  {selectedBeat.cameraMovement || "Static Camera"}
                </span>
                <span className="rounded-md border border-[#ff8a00]/40 bg-[#ff8a00]/10 px-2.5 py-1 font-semibold text-[#ff8a00]">
                  Narration {(selectedBeat.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Inner vignette overlay */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_80px_rgba(0,0,0,0.7)]" />
          </div>
        ) : (
          <div className="text-center text-xs text-muted-foreground">
            Chưa có visual beat được chọn để preview.
          </div>
        )}
      </div>

      {/* Bottom Player Controls */}
      <div className="flex w-full max-w-4xl items-center justify-between px-2 pt-2">
        {/* Timecode */}
        <div className="flex items-center gap-1 font-mono text-xs">
          <span className="font-bold text-[#ff8a00]">
            {formatTimecode(currentOffsetMs)}
          </span>
          <span className="text-muted-foreground/60">/</span>
          <span className="text-muted-foreground">
            {formatTimecode(totalScopeDurationMs)}
          </span>
        </div>

        {/* Center Transport Controls */}
        <div className="flex items-center gap-2">
          {/* Prev Beat */}
          <button
            type="button"
            onClick={onPrevBeat}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-[#141b27] hover:text-foreground"
            title="Beat trước"
            aria-label="Previous beat"
          >
            <SkipBack size={15} />
          </button>

          {/* Step Back 0.5s */}
          <button
            type="button"
            onClick={() => onStepMs(-500)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-[#141b27] hover:text-foreground"
            title="Lùi 0.5 giây"
            aria-label="Step back"
          >
            <span className="font-mono text-xs font-bold">‹‹</span>
          </button>

          {/* Circular Orange Play / Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff8a00] text-black shadow-[0_0_20px_rgba(255,138,0,0.35)] transition-transform hover:scale-105 hover:bg-[#ffa133] active:scale-95"
            title={playing ? "Pause" : "Play"}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={18} className="fill-black" /> : <Play size={18} className="ml-0.5 fill-black" />}
          </button>

          {/* Step Forward 0.5s */}
          <button
            type="button"
            onClick={() => onStepMs(500)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-[#141b27] hover:text-foreground"
            title="Tiến 0.5 giây"
            aria-label="Step forward"
          >
            <span className="font-mono text-xs font-bold">››</span>
          </button>

          {/* Next Beat */}
          <button
            type="button"
            onClick={onNextBeat}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-[#141b27] hover:text-foreground"
            title="Beat sau"
            aria-label="Next beat"
          >
            <SkipForward size={15} />
          </button>

          {/* Loop toggle */}
          <button
            type="button"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-[#141b27] hover:text-foreground"
            title="Lặp lại"
            aria-label="Loop"
          >
            <RotateCcw size={14} />
          </button>

          {/* Volume toggle */}
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-[#141b27] hover:text-foreground"
            title={muted ? "Unmute" : "Mute"}
            aria-label="Volume"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>

        {/* Right Viewport Controls */}
        <div className="flex items-center gap-2">
          {/* Fit Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFitOpen(!isFitOpen)}
              className="flex h-7 items-center gap-1 rounded-md border border-border/70 bg-[#121927] px-2.5 text-[11px] font-medium text-foreground transition hover:bg-[#182234]"
            >
              <span>{fitMode}</span>
              <ChevronDown size={12} className="text-muted-foreground" />
            </button>
            {isFitOpen && (
              <div className="absolute bottom-8 right-0 z-30 w-24 rounded-lg border border-border bg-[#101724] p-1 shadow-xl">
                {(["Fit", "100%", "Fill"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setFitMode(mode);
                      setIsFitOpen(false);
                    }}
                    className={`w-full rounded-md px-2 py-1 text-left text-[11px] transition ${
                      fitMode === mode
                        ? "bg-[#ff8a00]/20 font-semibold text-[#ff8a00]"
                        : "text-muted-foreground hover:bg-[#162030] hover:text-foreground"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen toggle */}
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-[#121927] text-muted-foreground transition hover:bg-[#182234] hover:text-foreground"
            title="Toàn màn hình"
            aria-label="Fullscreen"
          >
            <Maximize2 size={13} />
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

