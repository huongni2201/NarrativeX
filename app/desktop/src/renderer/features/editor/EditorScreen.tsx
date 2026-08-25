import { useEffect, useMemo, useState } from "react";
import { Pause, Play, Search, SkipBack, SkipForward, ZoomIn, ZoomOut } from "lucide-react";
import type { DesktopTimelineBeat } from "@narrativex/client-contracts";
import { Button } from "@/components/ui/button";
import type { DesktopWorkspaceState } from "../workspace/queries/useProjectWorkspace";

export function EditorScreen({
  workspace,
}: Readonly<{
  workspace: DesktopWorkspaceState;
}>) {
  const timeline = workspace.timeline;
  const beats = timeline?.beats ?? [];
  const [selectedId, setSelectedId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!selectedId && beats[0]) setSelectedId(beats[0].visualBeatId);
  }, [beats, selectedId]);

  const totalMs = timeline?.totalDurationMs ?? 0;
  const selected = beats.find((beat) => beat.visualBeatId === selectedId) ?? null;
  const filteredBeats = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return beats;
    return beats.filter((beat) =>
      `${beat.title} ${beat.visualIntent} ${beat.cameraMovement}`
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [beats, query]);

  useEffect(() => {
    if (!playing || totalMs <= 0) return;
    const timer = window.setInterval(() => {
      setPlayheadMs((current) => (current >= totalMs ? 0 : Math.min(totalMs, current + 250)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, totalMs]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[230px_minmax(0,1fr)_280px]">
      <aside className="min-h-0 overflow-hidden border-r border-border bg-card">
        <div className="border-b border-border p-3">
          <h1 className="text-sm font-semibold">Project Explorer</h1>
          <label className="mt-2 flex items-center gap-2 rounded-md border border-input bg-popover px-2 text-muted-foreground">
            <Search size={13} />
            <input
              className="h-8 min-w-0 flex-1 bg-transparent text-[10px] text-foreground outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm visual beat…"
            />
          </label>
        </div>
        <div className="h-[calc(100%-76px)] overflow-auto p-2">
          {filteredBeats.map((beat) => (
            <BeatListItem
              key={beat.visualBeatId}
              beat={beat}
              selected={beat.visualBeatId === selectedId}
              onSelect={() => {
                setSelectedId(beat.visualBeatId);
                setPlayheadMs(beat.startMs);
              }}
            />
          ))}
          {!filteredBeats.length && (
            <p className="p-4 text-center text-[10px] text-muted-foreground">Chưa có visual beat.</p>
          )}
        </div>
      </aside>

      <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_220px] bg-surface-dark">
        <div className="grid min-h-0 grid-rows-[44px_minmax(0,1fr)_44px]">
          <div className="flex items-center justify-between border-b border-border px-4">
            <div>
              <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Canvas</span>
              <strong className="ml-2 text-xs">Preview</strong>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {timeline?.aspectRatio ?? "16:9"} · {beats.length} beats
            </span>
          </div>
          <div className="m-3 grid min-h-0 place-items-center overflow-hidden rounded-lg border border-border bg-card p-6 text-center">
            {selected ? (
              <div className="grid max-w-lg gap-2">
                <span className="text-[9px] uppercase tracking-[.13em] text-primary-hover">
                  Scene {selected.sceneIndex + 1} · Beat {selected.beatIndex + 1}
                </span>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <p className="text-xs leading-5 text-muted-foreground">{selected.visualIntent}</p>
                <span className="text-[10px] text-muted-foreground">
                  {selected.assetReady ? "Asset ready" : "Asset pending"} · {selected.cameraMovement}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Chọn visual beat để preview.</span>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-border px-3">
            <span className="w-[78px] font-mono text-[11px] text-primary-hover">
              {formatTime(playheadMs)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPlayheadMs((value) => Math.max(0, value - 500))}
            >
              <SkipBack size={15} />
            </Button>
            <Button
              size="icon"
              onClick={() => setPlaying((value) => !value)}
              disabled={!totalMs}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPlayheadMs((value) => Math.min(totalMs, value + 500))}
            >
              <SkipForward size={15} />
            </Button>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {formatTime(totalMs)}
            </span>
          </div>
        </div>

        <div className="grid min-h-0 grid-rows-[40px_minmax(0,1fr)] border-t border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3">
            <strong className="text-xs">Timeline</strong>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}>
                <ZoomOut size={14} />
              </Button>
              <span className="w-10 text-center text-[10px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" onClick={() => setZoom((value) => Math.min(2, value + 0.25))}>
                <ZoomIn size={14} />
              </Button>
            </div>
          </div>
          <Timeline beats={beats} totalMs={totalMs} zoom={zoom} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </section>

      <aside className="min-h-0 overflow-auto border-l border-border bg-card p-4">
        <span className="text-[9px] uppercase tracking-[.13em] text-muted-foreground">Inspector</span>
        {selected ? (
          <div className="mt-3 grid gap-3 text-xs">
            <InspectorRow label="Title" value={selected.title} />
            <InspectorRow label="Scene" value={`${selected.sceneIndex + 1}`} />
            <InspectorRow label="Duration" value={`${(selected.durationMs / 1000).toFixed(1)}s`} />
            <InspectorRow label="Camera" value={selected.cameraMovement} />
            <InspectorRow label="Strategy" value={selected.assetStrategy} />
            <InspectorRow label="Asset" value={selected.mediaAssetId ?? "Pending"} />
          </div>
        ) : (
          <p className="mt-3 text-[10px] text-muted-foreground">Chưa chọn visual beat.</p>
        )}
      </aside>
    </div>
  );
}

function BeatListItem({ beat, selected, onSelect }: Readonly<{ beat: DesktopTimelineBeat; selected: boolean; onSelect: () => void }>) {
  return (
    <button
      type="button"
      className={`mb-1 grid w-full gap-1 rounded-md border p-2 text-left ${
        selected
          ? "border-primary bg-primary-muted"
          : "border-border-subtle bg-popover hover:border-border"
      }`}
      onClick={onSelect}
    >
      <strong className="truncate text-[10px]">{beat.title}</strong>
      <span className="text-[9px] text-muted-foreground">
        Scene {beat.sceneIndex + 1} · {formatTime(beat.startMs)}
      </span>
    </button>
  );
}

function Timeline({ beats, totalMs, zoom, selectedId, onSelect }: Readonly<{ beats: DesktopTimelineBeat[]; totalMs: number; zoom: number; selectedId: string; onSelect: (id: string) => void }>) {
  if (!totalMs) {
    return <div className="grid place-items-center text-[10px] text-muted-foreground">Timeline chưa có dữ liệu.</div>;
  }

  return (
    <div className="min-h-0 overflow-auto p-3">
      <div className="relative h-24 min-w-full rounded-md border border-border bg-surface-dark" style={{ width: `${zoom * 100}%` }}>
        {beats.map((beat) => {
          const left = (beat.startMs / totalMs) * 100;
          const width = Math.max(1.2, ((beat.endMs - beat.startMs) / totalMs) * 100);
          return (
            <button
              type="button"
              key={beat.visualBeatId}
              className={`absolute bottom-3 top-3 overflow-hidden rounded border px-2 text-left text-[9px] ${
                selectedId === beat.visualBeatId
                  ? "z-10 border-primary bg-primary-muted text-foreground"
                  : beat.assetReady
                    ? "border-info/40 bg-info-bg text-foreground"
                    : "border-warning/40 bg-warning-bg text-warning"
              }`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={() => onSelect(beat.visualBeatId)}
              title={beat.title}
            >
              <span className="block truncate">{beat.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InspectorRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="grid gap-1 border-b border-border-subtle pb-2">
      <span className="text-[9px] uppercase tracking-[.1em] text-muted-foreground">{label}</span>
      <span className="break-words text-[10px] text-foreground">{value}</span>
    </div>
  );
}

function formatTime(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
