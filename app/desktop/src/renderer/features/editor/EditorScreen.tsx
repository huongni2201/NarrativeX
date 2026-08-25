import { useEffect, useMemo, useState } from "react";
import { Pause, Play, Search, SkipBack, SkipForward, Volume2, ZoomIn, ZoomOut } from "lucide-react";
import type { DesktopTimeline, DesktopTimelineBeat } from "@narrativex/client-contracts";
import { Button } from "@/components/ui/button";
import type { DesktopWorkspaceState } from "../workspace/queries/useProjectWorkspace";
import {
  buildEditorHierarchy,
  resolveEditorScopeWindow,
  type EditorChapterGroup,
  type EditorScope,
  type EditorSceneGroup,
} from "./editor-timeline";

export function EditorScreen({
  workspace,
}: Readonly<{
  workspace: DesktopWorkspaceState;
}>) {
  const timeline = workspace.timeline;
  const beats = timeline?.beats ?? [];
  const chapters = timeline?.chapters ?? [];
  const [selectedId, setSelectedId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<EditorScope>("chapter");

  useEffect(() => {
    if (!beats.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!beats.some((beat) => beat.visualBeatId === selectedId)) {
      setSelectedId(beats[0].visualBeatId);
      setPlayheadMs(beats[0].startMs);
    }
  }, [beats, selectedId]);

  const totalMs = timeline?.totalDurationMs ?? 0;
  const selected = beats.find((beat) => beat.visualBeatId === selectedId) ?? null;
  const hierarchy = useMemo(
    () => buildEditorHierarchy(chapters, beats),
    [beats, chapters],
  );
  const filteredHierarchy = useMemo(
    () => filterHierarchy(hierarchy, query),
    [hierarchy, query],
  );
  const selectedChapter = selected
    ? chapters.find((chapter) => chapter.chapterId === selected.chapterId) ?? null
    : null;
  const scopeWindow = useMemo(
    () =>
      resolveEditorScopeWindow({
        chapters,
        beats,
        selected,
        scope,
        totalMs,
      }),
    [beats, chapters, scope, selected, totalMs],
  );
  const scopeDurationMs = Math.max(0, scopeWindow.endMs - scopeWindow.startMs);

  useEffect(() => {
    if (scopeWindow.endMs <= scopeWindow.startMs) return;
    if (playheadMs < scopeWindow.startMs || playheadMs > scopeWindow.endMs) {
      setPlayheadMs(scopeWindow.startMs);
    }
  }, [playheadMs, scopeWindow.endMs, scopeWindow.startMs]);

  useEffect(() => {
    if (!playing || scopeDurationMs <= 0) return;
    const timer = window.setInterval(() => {
      setPlayheadMs((current) =>
        current >= scopeWindow.endMs
          ? scopeWindow.startMs
          : Math.min(scopeWindow.endMs, current + 250),
      );
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, scopeDurationMs, scopeWindow.endMs, scopeWindow.startMs]);

  const selectBeat = (beat: DesktopTimelineBeat) => {
    setSelectedId(beat.visualBeatId);
    setPlayheadMs(beat.startMs);
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[250px_minmax(0,1fr)_300px]">
      <aside className="min-h-0 overflow-hidden border-r border-border bg-card">
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                Structure
              </span>
              <h1 className="text-sm font-semibold">Project Explorer</h1>
            </div>
            <span className="text-[9px] text-muted-foreground">
              {chapters.length} chapters
            </span>
          </div>
          <label className="mt-2 flex items-center gap-2 rounded-md border border-input bg-popover px-2 text-muted-foreground">
            <Search size={13} />
            <input
              className="h-8 min-w-0 flex-1 bg-transparent text-[10px] text-foreground outline-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm chapter, scene hoặc visual beat…"
            />
          </label>
        </div>
        <div className="h-[calc(100%-86px)] overflow-auto p-2">
          {filteredHierarchy.map((group) => (
            <ExplorerChapter
              key={group.chapter.chapterId}
              group={group}
              selectedId={selectedId}
              onSelect={selectBeat}
            />
          ))}
          {!filteredHierarchy.length && (
            <p className="p-4 text-center text-[10px] text-muted-foreground">
              Không tìm thấy chapter, scene hoặc visual beat.
            </p>
          )}
        </div>
      </aside>

      <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_270px] bg-surface-dark">
        <div className="grid min-h-0 grid-rows-[52px_minmax(0,1fr)_44px]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4">
            <div className="min-w-0">
              <span className="block truncate text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                {selected
                  ? `${selectedChapter?.title ?? "Chapter"} / Scene ${selected.sceneIndex + 1} / Visual Beat ${selected.beatIndex + 1}`
                  : "Editor"}
              </span>
              <strong className="block truncate text-xs">
                {selected?.title ?? "Chọn visual beat để bắt đầu chỉnh sửa"}
              </strong>
            </div>
            <ScopeSelector scope={scope} onChange={setScope} />
          </div>

          <div className="m-3 grid min-h-0 place-items-center overflow-hidden rounded-lg border border-border bg-card p-6 text-center">
            {selected ? (
              <div className="grid max-w-xl gap-3">
                <div className="mx-auto flex items-center gap-2 rounded-full border border-border bg-popover px-3 py-1 text-[9px] text-muted-foreground">
                  <span>Chapter {(selectedChapter?.orderIndex ?? 0) + 1}</span>
                  <span>·</span>
                  <span>Scene {selected.sceneIndex + 1}</span>
                  <span>·</span>
                  <span>Beat {selected.beatIndex + 1}</span>
                </div>
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <p className="text-xs leading-5 text-muted-foreground">{selected.visualIntent}</p>
                <div className="mx-auto flex flex-wrap items-center justify-center gap-2 text-[10px] text-muted-foreground">
                  <span className="rounded border border-border bg-popover px-2 py-1">
                    {selected.assetReady ? "Asset ready" : "Asset pending"}
                  </span>
                  <span className="rounded border border-border bg-popover px-2 py-1">
                    {selected.cameraMovement}
                  </span>
                  <span className="rounded border border-primary/40 bg-primary-muted px-2 py-1 text-primary-hover">
                    Narration {(selected.durationMs / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">Chưa có visual beat để preview.</span>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border px-3">
            <span className="w-[78px] font-mono text-[11px] text-primary-hover">
              {formatTime(Math.max(0, playheadMs - scopeWindow.startMs))}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setPlayheadMs((value) => Math.max(scopeWindow.startMs, value - 500))
              }
              disabled={!scopeDurationMs}
              aria-label="Lùi 0.5 giây"
            >
              <SkipBack size={15} />
            </Button>
            <Button
              size="icon"
              onClick={() => setPlaying((value) => !value)}
              disabled={!scopeDurationMs}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setPlayheadMs((value) => Math.min(scopeWindow.endMs, value + 500))
              }
              disabled={!scopeDurationMs}
              aria-label="Tiến 0.5 giây"
            >
              <SkipForward size={15} />
            </Button>
            <span className="ml-auto text-[9px] uppercase tracking-[.1em] text-muted-foreground">
              {scopeName(scope)}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatTime(scopeDurationMs)}
            </span>
          </div>
        </div>

        <div className="grid min-h-0 grid-rows-[42px_minmax(0,1fr)] border-t border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3">
            <div>
              <strong className="text-xs">Timeline</strong>
              <span className="ml-2 text-[9px] text-muted-foreground">
                Narration defines Visual Beat timing
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}
                aria-label="Thu nhỏ timeline"
              >
                <ZoomOut size={14} />
              </Button>
              <span className="w-10 text-center text-[10px] text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
                aria-label="Phóng to timeline"
              >
                <ZoomIn size={14} />
              </Button>
            </div>
          </div>
          <Timeline
            beats={scopeWindow.beats}
            chapters={chapters}
            windowStartMs={scopeWindow.startMs}
            windowEndMs={scopeWindow.endMs}
            playheadMs={playheadMs}
            zoom={zoom}
            selectedId={selectedId}
            onSelect={selectBeat}
          />
        </div>
      </section>

      <aside className="min-h-0 overflow-auto border-l border-border bg-card p-4">
        <div className="border-b border-border pb-3">
          <span className="text-[9px] uppercase tracking-[.13em] text-muted-foreground">
            Inspector
          </span>
          <h2 className="mt-1 text-sm font-semibold">Visual Beat</h2>
        </div>
        {selected ? (
          <div className="mt-3 grid gap-4 text-xs">
            <div className="rounded-md border border-primary/40 bg-primary-muted p-3">
              <div className="flex items-center gap-2 text-primary-hover">
                <Volume2 size={14} />
                <strong className="text-[10px]">Timing source: Narration</strong>
              </div>
              <p className="mt-2 text-[9px] leading-4 text-muted-foreground">
                Visual Beat giữ cùng audio span. Ảnh được animate theo span này; video source sẽ được trim/fill theo cùng timing khi media replacement được nối API.
              </p>
            </div>

            <InspectorSection title="Hierarchy">
              <InspectorRow label="Chapter" value={selectedChapter?.title ?? selected.chapterId} />
              <InspectorRow label="Scene" value={`Scene ${selected.sceneIndex + 1}`} />
              <InspectorRow label="Visual Beat" value={`Beat ${selected.beatIndex + 1}`} />
            </InspectorSection>

            <InspectorSection title="Timing">
              <InspectorRow label="Start" value={formatTime(selected.startMs)} />
              <InspectorRow label="End" value={formatTime(selected.endMs)} />
              <InspectorRow
                label="Duration"
                value={`${(selected.durationMs / 1000).toFixed(2)}s · audio locked`}
              />
            </InspectorSection>

            <InspectorSection title="Media">
              <InspectorRow label="Strategy" value={selected.assetStrategy} />
              <InspectorRow label="Camera" value={selected.cameraMovement} />
              <InspectorRow
                label="Asset status"
                value={selected.assetReady ? "Ready" : "Pending"}
              />
              <InspectorRow label="Asset ID" value={selected.mediaAssetId ?? "Pending"} />
            </InspectorSection>
          </div>
        ) : (
          <p className="mt-3 text-[10px] text-muted-foreground">Chưa chọn visual beat.</p>
        )}
      </aside>
    </div>
  );
}

function ScopeSelector({
  scope,
  onChange,
}: Readonly<{
  scope: EditorScope;
  onChange: (scope: EditorScope) => void;
}>) {
  const scopes: EditorScope[] = ["beat", "scene", "chapter", "project"];
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-popover p-1">
      {scopes.map((candidate) => (
        <Button
          key={candidate}
          variant={scope === candidate ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(candidate)}
          aria-pressed={scope === candidate}
        >
          {scopeName(candidate)}
        </Button>
      ))}
    </div>
  );
}

function ExplorerChapter({
  group,
  selectedId,
  onSelect,
}: Readonly<{
  group: EditorChapterGroup;
  selectedId: string;
  onSelect: (beat: DesktopTimelineBeat) => void;
}>) {
  const durationMs = Math.max(0, group.chapter.endMs - group.chapter.startMs);
  return (
    <section className="mb-3 overflow-hidden rounded-md border border-border-subtle bg-popover">
      <div className="flex items-start justify-between gap-2 border-b border-border-subtle px-2 py-2">
        <div className="min-w-0">
          <span className="text-[8px] font-semibold uppercase tracking-[.12em] text-primary-hover">
            Chapter {group.chapter.orderIndex + 1}
          </span>
          <strong className="block truncate text-[10px]">{group.chapter.title}</strong>
        </div>
        <div className="shrink-0 text-right text-[8px] text-muted-foreground">
          <span className="block">{group.scenes.length} scenes</span>
          <span className="font-mono">{formatTime(durationMs)}</span>
        </div>
      </div>
      <div className="p-1.5">
        {group.scenes.map((scene) => (
          <ExplorerScene
            key={`${scene.chapterId}:${scene.sceneIndex}`}
            scene={scene}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
        {!group.scenes.length && (
          <p className="px-2 py-3 text-center text-[9px] text-muted-foreground">
            Chapter này chưa có scene/visual beat.
          </p>
        )}
      </div>
    </section>
  );
}

function ExplorerScene({
  scene,
  selectedId,
  onSelect,
}: Readonly<{
  scene: EditorSceneGroup;
  selectedId: string;
  onSelect: (beat: DesktopTimelineBeat) => void;
}>) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between gap-2 px-1.5 py-1 text-[9px] text-muted-foreground">
        <strong className="text-foreground">Scene {scene.sceneIndex + 1}</strong>
        <span>
          {scene.readyBeatCount}/{scene.beats.length} ready · {formatTime(scene.durationMs)}
        </span>
      </div>
      <div className="grid gap-1 border-l border-border pl-2">
        {scene.beats.map((beat) => (
          <BeatListItem
            key={beat.visualBeatId}
            beat={beat}
            selected={beat.visualBeatId === selectedId}
            onSelect={() => onSelect(beat)}
          />
        ))}
      </div>
    </div>
  );
}

function BeatListItem({
  beat,
  selected,
  onSelect,
}: Readonly<{
  beat: DesktopTimelineBeat;
  selected: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border p-2 text-left ${
        selected
          ? "border-primary bg-primary-muted"
          : "border-border-subtle bg-card hover:border-border"
      }`}
      onClick={onSelect}
    >
      <div className="min-w-0">
        <span className="block text-[8px] uppercase tracking-[.1em] text-muted-foreground">
          Visual Beat {beat.beatIndex + 1}
        </span>
        <strong className="block truncate text-[10px]">{beat.title}</strong>
      </div>
      <div className="shrink-0 text-right">
        <span className="block font-mono text-[9px] text-muted-foreground">
          {formatTime(beat.durationMs)}
        </span>
        <span className={`text-[8px] ${beat.assetReady ? "text-info" : "text-warning"}`}>
          {beat.assetReady ? "ready" : "pending"}
        </span>
      </div>
    </button>
  );
}

function Timeline({
  beats,
  chapters,
  windowStartMs,
  windowEndMs,
  playheadMs,
  zoom,
  selectedId,
  onSelect,
}: Readonly<{
  beats: DesktopTimelineBeat[];
  chapters: DesktopTimeline["chapters"];
  windowStartMs: number;
  windowEndMs: number;
  playheadMs: number;
  zoom: number;
  selectedId: string;
  onSelect: (beat: DesktopTimelineBeat) => void;
}>) {
  const durationMs = Math.max(0, windowEndMs - windowStartMs);
  const sceneBands = useMemo(() => timelineSceneBands(beats), [beats]);
  const chapterNumberById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.chapterId, chapter.orderIndex + 1])),
    [chapters],
  );

  if (!durationMs) {
    return (
      <div className="grid place-items-center text-[10px] text-muted-foreground">
        Timeline chưa có dữ liệu.
      </div>
    );
  }

  const playheadPercent = positionPercent(playheadMs, windowStartMs, durationMs);
  const visibleChapters = chapters.filter(
    (chapter) => chapter.endMs > windowStartMs && chapter.startMs < windowEndMs,
  );

  return (
    <div className="min-h-0 overflow-auto p-3">
      <div
        className="grid min-w-[760px] grid-cols-[92px_minmax(0,1fr)] gap-x-2 gap-y-1"
        style={{ width: `${Math.max(100, zoom * 100)}%` }}
      >
        <div />
        <div className="flex justify-between px-1 font-mono text-[8px] text-muted-foreground">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <span key={ratio}>{formatTime(windowStartMs + durationMs * ratio)}</span>
          ))}
        </div>

        <TimelineRowLabel label="Scenes" />
        <div className="relative h-7 overflow-hidden rounded border border-border bg-surface-dark">
          {sceneBands.map((scene) => {
            const left = positionPercent(scene.startMs, windowStartMs, durationMs);
            const width = spanPercent(scene.startMs, scene.endMs, windowStartMs, durationMs);
            const chapterNumber = chapterNumberById.get(scene.chapterId) ?? "?";
            return (
              <div
                key={`${scene.chapterId}:${scene.sceneIndex}`}
                className="absolute inset-y-1 overflow-hidden rounded-sm border border-border bg-popover px-2 text-[8px] leading-5 text-muted-foreground"
                style={{ left: `${left}%`, width: `${Math.max(1, width)}%` }}
                title={`Chapter ${chapterNumber} · Scene ${scene.sceneIndex + 1}`}
              >
                <span className="block truncate">
                  C{chapterNumber} · Scene {scene.sceneIndex + 1}
                </span>
              </div>
            );
          })}
          <Playhead percent={playheadPercent} />
        </div>

        <TimelineRowLabel label="Narration" subtitle="timing source" />
        <div className="relative h-9 overflow-hidden rounded border border-border bg-surface-dark">
          {visibleChapters.map((chapter) => {
            const clippedStart = Math.max(chapter.startMs, windowStartMs);
            const clippedEnd = Math.min(chapter.endMs, windowEndMs);
            const left = positionPercent(clippedStart, windowStartMs, durationMs);
            const width = spanPercent(clippedStart, clippedEnd, windowStartMs, durationMs);
            return (
              <div
                key={chapter.chapterId}
                className={`absolute inset-y-1 overflow-hidden rounded-sm border px-2 text-[8px] leading-6 ${
                  chapter.audioReady
                    ? "border-info/40 bg-info-bg text-foreground"
                    : "border-warning/40 bg-warning-bg text-warning"
                }`}
                style={{ left: `${left}%`, width: `${Math.max(1, width)}%` }}
                title={`${chapter.title} · ${chapter.audioReady ? "Narration ready" : "Narration missing"}`}
              >
                <span className="block truncate">
                  C{chapter.orderIndex + 1} · {chapter.audioReady ? "Narration" : "Missing audio"}
                </span>
              </div>
            );
          })}
          <Playhead percent={playheadPercent} />
        </div>

        <TimelineRowLabel label="Visual Beats" subtitle={`${beats.length} clips`} />
        <div className="relative h-16 overflow-hidden rounded border border-border bg-surface-dark">
          {beats.map((beat) => {
            const clippedStart = Math.max(beat.startMs, windowStartMs);
            const clippedEnd = Math.min(beat.endMs, windowEndMs);
            const left = positionPercent(clippedStart, windowStartMs, durationMs);
            const width = spanPercent(clippedStart, clippedEnd, windowStartMs, durationMs);
            return (
              <button
                type="button"
                key={beat.visualBeatId}
                className={`absolute inset-y-2 overflow-hidden rounded border px-2 text-left text-[8px] ${
                  selectedId === beat.visualBeatId
                    ? "z-10 border-primary bg-primary-muted text-foreground"
                    : beat.assetReady
                      ? "border-info/40 bg-info-bg text-foreground"
                      : "border-warning/40 bg-warning-bg text-warning"
                }`}
                style={{ left: `${left}%`, width: `${Math.max(1.4, width)}%` }}
                onClick={() => onSelect(beat)}
                title={`${beat.title} · ${(beat.durationMs / 1000).toFixed(1)}s`}
              >
                <span className="block truncate font-semibold">
                  S{beat.sceneIndex + 1} · B{beat.beatIndex + 1}
                </span>
                <span className="block truncate opacity-80">{beat.title}</span>
              </button>
            );
          })}
          <Playhead percent={playheadPercent} />
        </div>
      </div>
    </div>
  );
}

function TimelineRowLabel({
  label,
  subtitle,
}: Readonly<{
  label: string;
  subtitle?: string;
}>) {
  return (
    <div className="flex min-h-0 flex-col justify-center">
      <span className="text-[9px] font-semibold text-foreground">{label}</span>
      {subtitle && <span className="text-[8px] text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

function Playhead({ percent }: Readonly<{ percent: number }>) {
  return (
    <div
      className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-primary"
      style={{ left: `${percent}%` }}
    />
  );
}

function InspectorSection({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-md border border-border bg-popover p-3">
      <h3 className="mb-3 text-[9px] font-semibold uppercase tracking-[.11em] text-muted-foreground">
        {title}
      </h3>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function InspectorRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="grid gap-1 border-b border-border-subtle pb-2 last:border-b-0 last:pb-0">
      <span className="text-[9px] uppercase tracking-[.1em] text-muted-foreground">{label}</span>
      <span className="break-words text-[10px] text-foreground">{value}</span>
    </div>
  );
}

function filterHierarchy(hierarchy: EditorChapterGroup[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return hierarchy;

  return hierarchy.flatMap((group) => {
    const chapterMatches = `${group.chapter.title} chapter ${group.chapter.orderIndex + 1}`
      .toLocaleLowerCase()
      .includes(needle);
    const scenes = group.scenes.flatMap((scene) => {
      const sceneMatches = `scene ${scene.sceneIndex + 1}`.includes(needle);
      const sceneBeats = chapterMatches || sceneMatches
        ? scene.beats
        : scene.beats.filter((beat) =>
            `${beat.title} ${beat.visualIntent} ${beat.cameraMovement} visual beat ${beat.beatIndex + 1}`
              .toLocaleLowerCase()
              .includes(needle),
          );
      return sceneBeats.length ? [{ ...scene, beats: sceneBeats }] : [];
    });

    return scenes.length
      ? [
          {
            ...group,
            scenes,
            beats: scenes.flatMap((scene) => scene.beats),
          },
        ]
      : [];
  });
}

function timelineSceneBands(beats: readonly DesktopTimelineBeat[]) {
  const groups = new Map<
    string,
    { chapterId: string; sceneIndex: number; startMs: number; endMs: number }
  >();

  for (const beat of beats) {
    const key = `${beat.chapterId}:${beat.sceneIndex}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        chapterId: beat.chapterId,
        sceneIndex: beat.sceneIndex,
        startMs: beat.startMs,
        endMs: beat.endMs,
      });
      continue;
    }
    existing.startMs = Math.min(existing.startMs, beat.startMs);
    existing.endMs = Math.max(existing.endMs, beat.endMs);
  }

  return [...groups.values()].sort(
    (left, right) => left.startMs - right.startMs || left.sceneIndex - right.sceneIndex,
  );
}

function positionPercent(valueMs: number, startMs: number, durationMs: number) {
  if (durationMs <= 0) return 0;
  return Math.max(0, Math.min(100, ((valueMs - startMs) / durationMs) * 100));
}

function spanPercent(startMs: number, endMs: number, windowStartMs: number, durationMs: number) {
  if (durationMs <= 0) return 0;
  const clippedStart = Math.max(startMs, windowStartMs);
  return Math.max(0, ((endMs - clippedStart) / durationMs) * 100);
}

function scopeName(scope: EditorScope) {
  switch (scope) {
    case "beat":
      return "Beat";
    case "scene":
      return "Scene";
    case "chapter":
      return "Chapter";
    case "project":
      return "Project";
  }
}

function formatTime(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
