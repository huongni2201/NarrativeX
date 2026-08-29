import { useMemo, useState } from "react";
import { Eye, Film, Lock, Type, Upload, ZoomIn, ZoomOut } from "lucide-react";
import type { DesktopTimeline, DesktopTimelineBeat } from "@narrativex/client-contracts";
import type { PlannedSubtitle } from "../../../../shared/subtitle-planner";

interface EditorMultiTrackTimelineProps {
  beats: DesktopTimelineBeat[];
  chapters: DesktopTimeline["chapters"];
  subtitleCues: PlannedSubtitle[];
  playheadMs: number;
  totalDurationMs: number;
  selectedBeatId: string;
  onSelectBeat: (beat: DesktopTimelineBeat) => void;
  onSeek: (ms: number) => void;
  onUploadMedia?: (type: "IMAGE" | "VIDEO") => void;
}

export function EditorMultiTrackTimeline({
  beats,
  chapters,
  subtitleCues,
  playheadMs,
  totalDurationMs,
  selectedBeatId,
  onSelectBeat,
  onSeek,
  onUploadMedia,
}: Readonly<EditorMultiTrackTimelineProps>) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const effectiveTotalMs = useMemo(() => {
    if (totalDurationMs > 0) return totalDurationMs;
    return Math.max(
      20_000,
      ...beats.map((beat) => beat.endMs),
      ...chapters.map((chapter) => chapter.endMs),
    );
  }, [beats, chapters, totalDurationMs]);
  const narrationChapters = useMemo(
    () => chapters.filter((chapter) => chapter.audioReady && chapter.narrationAssetId && chapter.endMs > chapter.startMs),
    [chapters],
  );
  const rulerTicks = useMemo(() => {
    const stepMs = effectiveTotalMs > 10 * 60_000 ? 10_000 : 2_000;
    return Array.from({ length: Math.ceil(effectiveTotalMs / stepMs) + 1 }, (_, index) => index * stepMs);
  }, [effectiveTotalMs]);
  const playheadPercent = percent(playheadMs, effectiveTotalMs);

  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onSeek(Math.round(fraction * effectiveTotalMs));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-[11px] select-none">
      <div className="flex min-h-0 flex-1 overflow-auto [scrollbar-width:thin]">
        <div className="sticky left-0 z-40 w-36 shrink-0 border-r border-border-subtle bg-surface-dark">
          <div className="h-7 border-b border-border-subtle" />
          <TrackHeader index="1" label="Narration" height="h-10" />
          <TrackHeader index="2" label="Visual Beats" height="h-12" />
          <TrackHeader index="3" label="Subtitles" height="h-10" icon={<Type size={11} />} />
          <TrackHeader index="4" label="Voiceover" height="h-9" />
          <TrackHeader index="5" label="Music" height="h-9" />
        </div>

        <div
          onClick={handleTimelineClick}
          className="relative flex-none cursor-pointer bg-[#090d15]"
          style={{ width: `${Math.max(100, zoomLevel * 100)}%`, minWidth: "100%" }}
        >
          <div className="relative h-7 border-b border-border-subtle bg-surface-dark">
            {rulerTicks.map((tickMs) => (
              <div key={tickMs} className="absolute inset-y-0" style={{ left: `${percent(tickMs, effectiveTotalMs)}%` }}>
                <span className="font-mono text-[9px] text-text-dim">{formatRulerTime(tickMs)}</span>
                <div className="mt-1 h-1.5 w-px bg-border-dark" />
              </div>
            ))}
          </div>

          <TrackRow height="h-10">
            {narrationChapters.length ? narrationChapters.map((chapter) => (
              <div
                key={chapter.chapterId}
                className="absolute inset-y-1 flex items-center overflow-hidden rounded-md border border-emerald-800 bg-emerald-950/70 px-2 text-[10px] text-emerald-300"
                style={spanStyle(chapter.startMs, chapter.endMs, effectiveTotalMs)}
                title={`${chapter.title} · narration`}
              >
                <span className="truncate">{chapter.title}</span>
                <span className="ml-2 flex-1 border-b border-dashed border-emerald-700/70" />
              </div>
            )) : <EmptyTrackLabel label="Chưa có narration audio" />}
          </TrackRow>

          <TrackRow height="h-12">
            {beats.length ? beats.map((beat) => {
              const selected = beat.visualBeatId === selectedBeatId;
              return (
                <button
                  key={beat.visualBeatId}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectBeat(beat);
                    onSeek(beat.startMs);
                  }}
                  className={`absolute inset-y-1 flex min-w-8 items-center overflow-hidden rounded-md border px-2 text-left ${selected ? "z-10 border-primary bg-[#13233d] ring-1 ring-primary" : "border-[#1d3d6b] bg-[#0f1b2e] hover:border-info/60"}`}
                  style={spanStyle(beat.startMs, beat.endMs, effectiveTotalMs)}
                  title={`${beat.title} · ${formatDurationSeconds(beat.durationMs)}`}
                >
                  <Film size={11} className="mr-1 shrink-0 text-blue-400" />
                  <span className="truncate font-mono text-[9px] text-blue-200">{beat.title || `Beat ${beat.beatIndex + 1}`}</span>
                </button>
              );
            }) : <EmptyTrackLabel label="Chưa có Visual Beat" />}
          </TrackRow>

          <TrackRow height="h-10">
            {subtitleCues.length ? subtitleCues.map((cue, index) => (
              <div
                key={`${cue.chapterId}:${cue.startMs}:${index}`}
                className="absolute inset-y-1 flex min-w-6 items-center overflow-hidden rounded border border-amber-700/70 bg-amber-950/50 px-1.5 text-[9px] text-amber-100"
                style={spanStyle(cue.startMs, cue.endMs, effectiveTotalMs)}
                title={`${formatRulerTime(cue.startMs)} · ${cue.text}`}
              >
                <Type size={9} className="mr-1 shrink-0 text-amber-400" />
                <span className="truncate">{cue.text}</span>
              </div>
            )) : <EmptyTrackLabel label="Chưa có subtitle cue" />}
          </TrackRow>

          <TrackRow height="h-9"><EmptyTrackLabel label="Chưa có voiceover track" /></TrackRow>
          <TrackRow height="h-9"><EmptyTrackLabel label="Chưa có music track" /></TrackRow>

          <div className="pointer-events-none absolute inset-y-0 z-30 w-px bg-primary" style={{ left: `${playheadPercent}%` }}>
            <div className="absolute -top-0.5 left-1/2 h-3.5 w-2 -translate-x-1/2 rounded-[2px] bg-primary shadow-[0_0_8px_rgba(255,138,0,0.6)]" />
          </div>
        </div>
      </div>

      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-border-subtle bg-surface-dark px-3 text-[10px] text-text-muted">
        <div className="flex items-center gap-2">
          <span className="rounded border border-border-subtle bg-surface-input px-2 py-1">{beats.length} beats</span>
          <span className="rounded border border-border-subtle bg-surface-input px-2 py-1">{subtitleCues.length} subtitles</span>
          <button type="button" onClick={() => onUploadMedia?.("IMAGE")} className="flex h-7 items-center gap-1 rounded-md border border-border-subtle bg-surface-input px-2 hover:bg-surface-2"><Upload size={11} /> Image</button>
          <button type="button" onClick={() => onUploadMedia?.("VIDEO")} className="flex h-7 items-center gap-1 rounded-md border border-border-subtle bg-surface-input px-2 hover:bg-surface-2"><Film size={11} /> Video</button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setZoomLevel((value) => Math.max(1, value - 0.25))} className="nx-icon-button size-6"><ZoomOut size={12} /></button>
          <input type="range" min={1} max={3} step={0.25} value={zoomLevel} onChange={(event) => setZoomLevel(Number(event.target.value))} className="w-20 accent-primary" aria-label="Timeline zoom" />
          <button type="button" onClick={() => setZoomLevel((value) => Math.min(3, value + 0.25))} className="nx-icon-button size-6"><ZoomIn size={12} /></button>
        </div>
      </div>
    </div>
  );
}

function TrackRow({ height, children }: Readonly<{ height: string; children: React.ReactNode }>) {
  return <div className={`relative border-b border-border-subtle/50 px-1 py-1 ${height}`}>{children}</div>;
}

function TrackHeader({ index, label, height, icon }: Readonly<{ index: string; label: string; height: string; icon?: React.ReactNode }>) {
  return (
    <div className={`flex items-center justify-between border-b border-border-subtle px-3 ${height}`}>
      <div className="flex items-center gap-2"><span className="font-mono text-[9px] text-text-dim">{index}</span>{icon}<span className="text-[10px] font-medium text-text-secondary">{label}</span></div>
      <div className="flex items-center gap-1 text-text-dim"><Lock size={10} /><Eye size={10} /></div>
    </div>
  );
}

function EmptyTrackLabel({ label }: Readonly<{ label: string }>) {
  return <div className="absolute inset-y-1 left-2 flex items-center text-[9px] text-text-dim">{label}</div>;
}

function percent(value: number, total: number): number {
  return Math.max(0, Math.min(100, (value / Math.max(1, total)) * 100));
}

function spanStyle(startMs: number, endMs: number, totalMs: number): React.CSSProperties {
  const left = percent(startMs, totalMs);
  const width = Math.max(0.7, percent(Math.max(0, endMs - startMs), totalMs));
  return { left: `${left}%`, width: `${width}%` };
}

function formatRulerTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDurationSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}
