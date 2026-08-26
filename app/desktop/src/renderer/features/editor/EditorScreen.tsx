import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  BeatMediaFitMode,
  DesktopTimelineBeat,
} from "@narrativex/client-contracts";
import { assetsApi } from "../assets/api/assets.api";
import { productionApi } from "../production/api/production.api";
import {
  chooseMediaFit,
  createBeatDecision,
} from "../production/auto-edit-planner";
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

interface PreviewSources {
  mediaUrl: string | null;
  narrationUrl: string | null;
  loading: boolean;
  message: string | null;
}

const EMPTY_PREVIEW: PreviewSources = {
  mediaUrl: null,
  narrationUrl: null,
  loading: false,
  message: null,
};

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
  const [previewSources, setPreviewSources] = useState<PreviewSources>(EMPTY_PREVIEW);

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
  const selectedChapter = selected
    ? chapters.find((chapter) => chapter.chapterId === selected.chapterId) ?? null
    : null;
  const narrationAsset = selectedChapter?.narrationAssetId
    ? workspace.assets.find((asset) => asset.id === selectedChapter.narrationAssetId) ?? null
    : null;
  const autoDecision = useMemo(
    () => (selected ? createBeatDecision(selected, "CINEMATIC") : null),
    [selected],
  );
  const previewBeat = useMemo<DesktopTimelineBeat | null>(
    () =>
      selected && autoDecision
        ? {
            ...selected,
            cameraMovement: autoDecision.cameraMovement,
            fitMode: autoDecision.fitMode,
            trimStartMs: autoDecision.trimStartMs,
          }
        : selected,
    [autoDecision, selected],
  );
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

  useEffect(() => {
    if (!beats.length) return;
    const beatAtTime = beats.find((beat, index) => {
      const isLast = index === beats.length - 1;
      return playheadMs >= beat.startMs && (playheadMs < beat.endMs || (isLast && playheadMs <= beat.endMs));
    });
    if (beatAtTime && beatAtTime.visualBeatId !== selectedId) {
      setSelectedId(beatAtTime.visualBeatId);
    }
  }, [beats, playheadMs, selectedId]);

  useEffect(() => {
    let active = true;
    if (!projectId || !selected) {
      setPreviewSources(EMPTY_PREVIEW);
      return () => {
        active = false;
      };
    }

    const mediaIsLocalOnly = selected.storageMode === "LOCAL_ONLY";
    const narrationIsLocalOnly = narrationAsset?.storageMode === "LOCAL_ONLY";
    const needsMediaUrl = Boolean(selected.mediaAssetId && !mediaIsLocalOnly);
    const needsNarrationUrl = Boolean(selectedChapter?.narrationAssetId && !narrationIsLocalOnly);

    setPreviewSources({
      mediaUrl: null,
      narrationUrl: null,
      loading: needsMediaUrl || needsNarrationUrl,
      message: mediaIsLocalOnly
        ? "Media này chỉ có trên local. Auto Edit vẫn render bằng local FFmpeg; live preview remote chưa áp dụng cho asset này."
        : null,
    });

    void Promise.allSettled([
      needsMediaUrl && selected.mediaAssetId
        ? assetsApi.downloadUrl(selected.mediaAssetId)
        : Promise.resolve(null),
      needsNarrationUrl && selectedChapter?.narrationAssetId
        ? assetsApi.downloadUrl(selectedChapter.narrationAssetId)
        : Promise.resolve(null),
    ]).then(([mediaResult, narrationResult]) => {
      if (!active) return;
      const mediaUrl = mediaResult.status === "fulfilled" ? mediaResult.value?.url ?? null : null;
      const narrationUrl =
        narrationResult.status === "fulfilled" ? narrationResult.value?.url ?? null : null;
      const messages: string[] = [];
      if (mediaIsLocalOnly) {
        messages.push("Local-only media sẽ được FFmpeg đọc trực tiếp khi render.");
      } else if (selected.mediaAssetId && !mediaUrl) {
        messages.push("Không lấy được media preview URL.");
      }
      if (narrationIsLocalOnly) {
        messages.push("Narration local-only chưa phát trong viewport nhưng vẫn được dùng khi render.");
      } else if (selectedChapter?.narrationAssetId && !narrationUrl) {
        messages.push("Không lấy được narration preview URL.");
      }
      setPreviewSources({
        mediaUrl,
        narrationUrl,
        loading: false,
        message: messages.length ? messages.join(" ") : null,
      });
    });

    return () => {
      active = false;
    };
  }, [
    narrationAsset?.storageMode,
    projectId,
    selected,
    selectedChapter?.narrationAssetId,
  ]);

  const selectBeat = (beat: DesktopTimelineBeat) => {
    setSelectedId(beat.visualBeatId);
    setPlayheadMs(beat.startMs);
  };

  const handlePrevBeat = () => {
    const currentIndex = beats.findIndex((beat) => beat.visualBeatId === selectedId);
    if (currentIndex > 0) selectBeat(beats[currentIndex - 1]);
  };

  const handleNextBeat = () => {
    const currentIndex = beats.findIndex((beat) => beat.visualBeatId === selectedId);
    if (currentIndex >= 0 && currentIndex < beats.length - 1) {
      selectBeat(beats[currentIndex + 1]);
    }
  };

  const handleStepMs = (deltaMs: number) => {
    setPlayheadMs((current) =>
      Math.max(scopeWindow.startMs, Math.min(scopeWindow.endMs, current + deltaMs)),
    );
  };

  const handleSeek = (targetMs: number) => {
    setPlayheadMs(targetMs);
    const beatAtTime = beats.find(
      (beat) => targetMs >= beat.startMs && targetMs < beat.endMs,
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
      const autoFit = chooseMediaFit({
        mediaType: selection.kind === "VIDEO" ? "VIDEO" : "IMAGE",
        sourceDurationMs: asset.durationMs,
        durationMs: selected.durationMs,
      });
      await productionApi.updateBeatMedia(projectId, selected.visualBeatId, {
        mediaAssetId: asset.id,
        fitMode: autoFit.fitMode,
        trimStartMs: autoFit.trimStartMs,
      });
    }, expectedType === "VIDEO" ? "Video đã được gắn và Auto Edit sẽ tự fit theo narration." : "Ảnh đã được gắn vào Visual Beat.");
  }

  async function chooseExistingAsset(assetId: string) {
    if (!projectId || !selected) return;
    const asset = selectableAssets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    const autoFit = chooseMediaFit({
      mediaType: asset.type === "VIDEO" ? "VIDEO" : "IMAGE",
      sourceDurationMs: asset.durationMs,
      durationMs: selected.durationMs,
    });
    await withMediaMutation(
      () =>
        productionApi.updateBeatMedia(projectId, selected.visualBeatId, {
          mediaAssetId: asset.id,
          fitMode: autoFit.fitMode,
          trimStartMs: autoFit.trimStartMs,
        }),
      `${asset.originalFilename} đã được gắn; Auto Edit chọn ${autoFit.fitMode}.`,
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
      `Manual override đã chuyển fit mode sang ${fitMode}.`,
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
    <div className="grid h-full min-h-0 grid-cols-[var(--editor-explorer-width)_minmax(0,1fr)_var(--editor-inspector-width)] overflow-hidden bg-background text-foreground select-none">
      <EditorExplorerPanel
        hierarchy={filteredHierarchy}
        selectedBeatId={selectedId}
        onSelectBeat={selectBeat}
        query={query}
        onQueryChange={setQuery}
      />

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border-subtle bg-background">
        <div className="nx-editor-preview-panel min-h-[400px] shrink-0">
          <EditorPreviewViewport
            selectedBeat={previewBeat}
            mediaUrl={previewSources.mediaUrl}
            narrationUrl={previewSources.narrationUrl}
            narrationStartMs={selectedChapter?.startMs ?? null}
            narrationEndMs={selectedChapter?.endMs ?? null}
            previewLoading={previewSources.loading}
            previewMessage={previewSources.message}
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

        <div className="nx-editor-timeline-panel min-h-[220px] border-t border-border-subtle">
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

      <EditorInspectorPanel
        selectedBeat={selected}
        autoDecision={autoDecision}
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
