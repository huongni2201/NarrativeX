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
    <div className="flex h-full min-h-0 flex-col items-center justify-between bg-[#080b10] px-4 py-2">
      {/* Top Header Bar over Canvas */}
      <div className="flex w-full max-w-2xl items-center justify-between pb-1.5 text-xs">
        {/* Left: Beat Number & Title & Status badge */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground">
            {selectedBeat ? `${beatNumber} ${selectedBeat.title}` : "01 Mở đầu bi kịch"}
          </h2>
          <span className="rounded-md border border-border/70 bg-[#141b27] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {selectedBeat?.assetReady ? "Ready" : "Draft"}
          </span>
        </div>

        {/* Right: Metrics & Menu */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-mono">
            <span>Duration:</span>
            <span className="font-bold text-foreground">
              {formatTimecode(selectedBeat?.durationMs || 12000)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            <span>Beats:</span>
            <span className="font-bold text-foreground">6</span>
          </div>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-[#151e2b] hover:text-foreground"
            aria-label="More options"
          >
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {/* 16:9 Viewport Canvas */}
      <div className="relative flex aspect-video max-h-[260px] w-full max-w-2xl items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-[#0c111a] shadow-xl shadow-black">
        {/* Cinematic Atmospheric Visual Scene */}
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#070c14]">
          {/* Visual gradient backdrop */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-[#0d1624] to-[#15233a] opacity-90" />
          
          {/* Gothic / Cinematic castle atmosphere illustration preview */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-full w-full bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-sky-950/40 via-[#0a101b] to-black opacity-80" />
            {/* Center Atmospheric Details */}
            <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#ff8a00]">
                {selectedBeat?.cameraMovement || "Slow Pan · Cinematic"}
              </span>
              <h3 className="mt-1 text-base font-bold text-white drop-shadow-lg">
                {selectedBeat?.title || "Visual Beat"}
              </h3>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-300 drop-shadow">
                {selectedBeat?.visualIntent || "Giới thiệu bối cảnh và nhân vật chính."}
              </p>
            </div>
          </div>

          {/* Vignette shadow */}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.85)]" />
        </div>
      </div>

      {/* Bottom Transport Controls Bar */}
      <div className="flex w-full max-w-2xl items-center justify-between pt-1.5">
        {/* Timecode */}
        <div className="flex items-center gap-1 font-mono text-xs">
          <span className="font-bold text-foreground">
            {formatTimecode(currentOffsetMs)}
          </span>
          <span className="text-muted-foreground/60">/</span>
          <span className="text-muted-foreground">
            {formatTimecode(totalScopeDurationMs || 12000)}
          </span>
        </div>

        {/* Center Transport Controls */}
        <div className="flex items-center gap-2">
          {/* Prev Beat */}
          <button
            type="button"
            onClick={onPrevBeat}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-[#151e2b] hover:text-foreground"
            title="Previous beat"
            aria-label="Previous beat"
          >
            <SkipBack size={14} />
          </button>

          {/* Frame Step Back */}
          <button
            type="button"
            onClick={() => onStepMs(-500)}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-[#151e2b] hover:text-foreground"
            title="Step back"
            aria-label="Step back"
          >
            <span className="font-mono text-[11px] font-bold">‹‹</span>
          </button>

          {/* Large Circular Orange Play Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff8a00] text-black shadow-[0_0_16px_rgba(255,138,0,0.4)] transition hover:scale-105 hover:bg-[#ffa133] active:scale-95"
            title={playing ? "Pause" : "Play"}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={15} className="fill-black" /> : <Play size={15} className="ml-0.5 fill-black" />}
          </button>

          {/* Frame Step Forward */}
          <button
            type="button"
            onClick={() => onStepMs(500)}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-[#151e2b] hover:text-foreground"
            title="Step forward"
            aria-label="Step forward"
          >
            <span className="font-mono text-[11px] font-bold">››</span>
          </button>

          {/* Next Beat */}
          <button
            type="button"
            onClick={onNextBeat}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-[#151e2b] hover:text-foreground"
            title="Next beat"
            aria-label="Next beat"
          >
            <SkipForward size={14} />
          </button>

          {/* Volume toggle */}
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-[#151e2b] hover:text-foreground"
            title={muted ? "Unmute" : "Mute"}
            aria-label="Volume"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>

        {/* Right Viewport Controls */}
        <div className="flex items-center gap-2">
          {/* Fit Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFitOpen(!isFitOpen)}
              className="flex h-7 items-center gap-1 rounded-md border border-border/70 bg-[#101724] px-2.5 text-[11px] font-medium text-foreground transition hover:bg-[#162032]"
            >
              <span>{fitMode}</span>
              <ChevronDown size={11} className="text-muted-foreground" />
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
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-[#101724] text-muted-foreground transition hover:bg-[#162032] hover:text-foreground"
            title="Toàn màn hình"
            aria-label="Fullscreen"
          >
            <Maximize2 size={12} />
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
