import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  BeatMediaFitMode,
  DesktopTimelineBeat,
} from "@narrativex/client-contracts";
import { assetsApi } from "../assets/api/assets.api";
import { productionApi } from "../production/api/production.api";
import type { DesktopWorkspaceState } from "../workspace/queries/useProjectWorkspace";
import {
  buildEditorHierarchy,
  resolveEditorScopeWindow,
  type EditorChapterGroup,
  type EditorScope,
} from "./editor-timeline";
import { EditorExplorerPanel } from "./components/EditorExplorerPanel";
import { EditorPreviewViewport } from "./components/EditorPreviewViewport";
import { EditorInspectorPanel } from "./components/EditorInspectorPanel";
import { EditorMultiTrackTimeline } from "./components/EditorMultiTrackTimeline";

export function EditorScreen({
  workspace,
}: Readonly<{
  workspace: DesktopWorkspaceState;
}>) {
  const queryClient = useQueryClient();
  const timeline = workspace.timeline;
  const projectId = timeline?.projectId ?? null;
  const beats = timeline?.beats ?? [];
  const chapters = timeline?.chapters ?? [];
  const selectableAssets = workspace.assets.filter(
    (asset) => asset.type === "IMAGE" || asset.type === "VIDEO",
  );
  const [selectedId, setSelectedId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [query, setQuery] = useState("");
  const [scope] = useState<EditorScope>("chapter");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);

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

  useEffect(() => {
    setMediaNotice(null);
  }, [selectedId]);

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

  const handlePrevBeat = () => {
    const currentIndex = beats.findIndex((b) => b.visualBeatId === selectedId);
    if (currentIndex > 0) {
      selectBeat(beats[currentIndex - 1]);
    }
  };

  const handleNextBeat = () => {
    const currentIndex = beats.findIndex((b) => b.visualBeatId === selectedId);
    if (currentIndex >= 0 && currentIndex < beats.length - 1) {
      selectBeat(beats[currentIndex + 1]);
    }
  };

  const handleStepMs = (deltaMs: number) => {
    setPlayheadMs((current) =>
      Math.max(0, Math.min(scopeWindow.endMs, current + deltaMs)),
    );
  };

  const handleSeek = (targetMs: number) => {
    setPlayheadMs(targetMs);
    const beatAtTime = beats.find(
      (b) => targetMs >= b.startMs && targetMs <= b.endMs,
    );
    if (beatAtTime && beatAtTime.visualBeatId !== selectedId) {
      setSelectedId(beatAtTime.visualBeatId);
    }
  };

  async function refreshEditorData() {
    if (!projectId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
      queryClient.invalidateQueries({ queryKey: ["assets", "library"] }),
    ]);
  }

  async function withMediaMutation(action: () => Promise<void>, successMessage: string) {
    setMediaBusy(true);
    setMediaNotice(null);
    try {
      await action();
      await refreshEditorData();
      setMediaNotice(successMessage);
    } catch (error) {
      setMediaNotice(error instanceof Error ? error.message : "Không thể cập nhật media cho beat.");
    } finally {
      setMediaBusy(false);
    }
  }

  async function uploadBeatMedia(expectedType: "IMAGE" | "VIDEO") {
    if (!projectId || !selected) return;
    await withMediaMutation(async () => {
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return;
      if (selection.kind !== expectedType) {
        throw new Error(
          expectedType === "VIDEO"
            ? "Hãy chọn một file video."
            : "Hãy chọn một file ảnh.",
        );
      }

      const asset = await assetsApi.registerLocal({
        projectId,
        type: selection.kind,
        originalFilename: selection.originalFilename,
        contentType: selection.contentType,
        sizeBytes: selection.sizeBytes,
        checksumSha256: selection.checksumSha256,
      });
      await window.narrativex.localStorage.commitSelectedAsset({
        projectId,
        assetId: asset.id,
        kind: selection.kind,
        selectionToken: selection.selectionToken,
      });
      await productionApi.updateBeatMedia(projectId, selected.visualBeatId, {
        mediaAssetId: asset.id,
        fitMode: selection.kind === "VIDEO" ? "FREEZE_END" : "TRIM",
        trimStartMs: 0,
      });
    }, expectedType === "VIDEO" ? "Video đã được gắn vào Visual Beat." : "Ảnh đã được gắn vào Visual Beat.");
  }

  async function chooseExistingAsset(assetId: string) {
    if (!projectId || !selected) return;
    const asset = selectableAssets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    await withMediaMutation(
      () =>
        productionApi.updateBeatMedia(projectId, selected.visualBeatId, {
          mediaAssetId: asset.id,
          fitMode: asset.type === "VIDEO" ? "FREEZE_END" : "TRIM",
          trimStartMs: 0,
        }),
      `${asset.originalFilename} đã được gắn vào Visual Beat.`,
    );
  }

  async function updateFitMode(fitMode: BeatMediaFitMode) {
    if (!projectId || !selected?.mediaAssetId) return;
    await withMediaMutation(
      () =>
        productionApi.updateBeatMedia(projectId, selected.visualBeatId, {
          mediaAssetId: selected.mediaAssetId as string,
          fitMode,
          trimStartMs: selected.trimStartMs,
        }),
      `Fit mode đã chuyển sang ${fitMode}.`,
    );
  }

  async function resetToGeneratedSource() {
    if (!projectId || !selected) return;
    await withMediaMutation(
      () => productionApi.resetBeatMedia(projectId, selected.visualBeatId),
      "Visual Beat đã quay về generated source.",
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)_320px] bg-[#070a0f] text-foreground select-none">
      {/* Left Column: Chapters & Visual Beats */}
      <EditorExplorerPanel
        hierarchy={filteredHierarchy}
        selectedBeatId={selectedId}
        onSelectBeat={selectBeat}
        query={query}
        onQueryChange={setQuery}
      />

      {/* Center Column: Video Preview on Top + Multi-track Timeline Below */}
      <div className="flex min-h-0 flex-col overflow-hidden border-r border-border/50">
        {/* Top: Video Preview & Transport Controls */}
        <div className="flex-1 min-h-0">
          <EditorPreviewViewport
            selectedBeat={selected}
            playheadMs={playheadMs}
            scopeWindowStartMs={scopeWindow.startMs}
            scopeWindowEndMs={scopeWindow.endMs}
            playing={playing}
            onTogglePlay={() => setPlaying(!playing)}
            onPrevBeat={handlePrevBeat}
            onNextBeat={handleNextBeat}
            onStepMs={handleStepMs}
          />
        </div>

        {/* Bottom: Professional Multi-track Timeline */}
        <div className="h-[250px] shrink-0 border-t border-border/50">
          <EditorMultiTrackTimeline
            beats={beats}
            chapters={chapters}
            playheadMs={playheadMs}
            totalDurationMs={totalMs}
            selectedBeatId={selectedId}
            onSelectBeat={selectBeat}
            onSeek={handleSeek}
          />
        </div>
      </div>

      {/* Right Column: Inspector Details & AI Assistant */}
      <EditorInspectorPanel
        selectedBeat={selected}
        selectableAssets={selectableAssets}
        mediaBusy={mediaBusy}
        mediaNotice={mediaNotice}
        onUploadMedia={uploadBeatMedia}
        onChooseAsset={chooseExistingAsset}
        onUpdateFitMode={updateFitMode}
        onResetSource={resetToGeneratedSource}
      />
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
            `${beat.title} ${beat.visualIntent} ${beat.cameraMovement} ${beat.mediaType ?? ""} visual beat ${beat.beatIndex + 1}`
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
