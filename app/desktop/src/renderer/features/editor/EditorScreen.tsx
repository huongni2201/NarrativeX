import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  BeatMediaFitMode,
  DesktopTimelineBeat,
} from "@narrativex/client-contracts";
import { localAssetPreviewUrl } from "../../../shared/local-asset-preview-url";
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
  sortEditorBeats,
  type EditorChapterGroup,
  type EditorScope,
} from "./editor-timeline";
import { EditorExplorerPanel } from "./components/EditorExplorerPanel";
import { EditorInspectorPanel } from "./components/EditorInspectorPanel";
import { EditorPlaybackSurface } from "./components/EditorPlaybackSurface";

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
  const orderedBeats = useMemo(() => sortEditorBeats(beats), [beats]);
  const selectableAssets = useMemo(
    () => workspace.assets.filter((asset) => asset.type === "IMAGE" || asset.type === "VIDEO"),
    [workspace.assets],
  );
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  // Review should naturally continue across chapter boundaries. Beat/scene/chapter
  // scopes remain modelled in editor-timeline for future explicit focus controls.
  const [scope] = useState<EditorScope>("project");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [previewSources, setPreviewSources] = useState<PreviewSources>(EMPTY_PREVIEW);

  useEffect(() => {
    if (!orderedBeats.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!orderedBeats.some((beat) => beat.visualBeatId === selectedId)) {
      setSelectedId(orderedBeats[0].visualBeatId);
    }
  }, [orderedBeats, selectedId]);

  useEffect(() => {
    setMediaNotice(null);
  }, [selectedId]);

  const totalMs = timeline?.totalDurationMs ?? 0;
  const selected = useMemo(
    () => orderedBeats.find((beat) => beat.visualBeatId === selectedId) ?? null,
    [orderedBeats, selectedId],
  );
  const selectedChapter = useMemo(
    () =>
      selected
        ? chapters.find((chapter) => chapter.chapterId === selected.chapterId) ?? null
        : null,
    [chapters, selected],
  );
  const narrationAsset = useMemo(
    () =>
      selectedChapter?.narrationAssetId
        ? workspace.assets.find((asset) => asset.id === selectedChapter.narrationAssetId) ?? null
        : null,
    [selectedChapter?.narrationAssetId, workspace.assets],
  );
  const autoDecision = useMemo(
    () => (selected ? createBeatDecision(selected, "AUTO") : null),
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
    () => buildEditorHierarchy(chapters, orderedBeats),
    [chapters, orderedBeats],
  );
  const filteredHierarchy = useMemo(
    () => filterHierarchy(hierarchy, query),
    [hierarchy, query],
  );
  const scopeWindow = useMemo(
    () =>
      resolveEditorScopeWindow({
        chapters,
        beats: orderedBeats,
        selected,
        scope,
        totalMs,
      }),
    [chapters, orderedBeats, scope, selected, totalMs],
  );

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
    const localMediaUrl =
      mediaIsLocalOnly && selected.mediaAssetId
        ? localAssetPreviewUrl(projectId, selected.mediaAssetId)
        : null;
    const localNarrationUrl =
      narrationIsLocalOnly && selectedChapter?.narrationAssetId
        ? localAssetPreviewUrl(projectId, selectedChapter.narrationAssetId)
        : null;
    const needsRemoteMediaUrl = Boolean(selected.mediaAssetId && !mediaIsLocalOnly);
    const needsRemoteNarrationUrl = Boolean(
      selectedChapter?.narrationAssetId && !narrationIsLocalOnly,
    );

    setPreviewSources({
      mediaUrl: localMediaUrl,
      narrationUrl: localNarrationUrl,
      loading: needsRemoteMediaUrl || needsRemoteNarrationUrl,
      message: null,
    });

    void Promise.allSettled([
      needsRemoteMediaUrl && selected.mediaAssetId
        ? assetsApi.downloadUrl(selected.mediaAssetId)
        : Promise.resolve(null),
      needsRemoteNarrationUrl && selectedChapter?.narrationAssetId
        ? assetsApi.downloadUrl(selectedChapter.narrationAssetId)
        : Promise.resolve(null),
    ]).then(([mediaResult, narrationResult]) => {
      if (!active) return;
      const remoteMediaUrl =
        mediaResult.status === "fulfilled" ? mediaResult.value?.url ?? null : null;
      const remoteNarrationUrl =
        narrationResult.status === "fulfilled" ? narrationResult.value?.url ?? null : null;
      const mediaUrl = localMediaUrl ?? remoteMediaUrl;
      const narrationUrl = localNarrationUrl ?? remoteNarrationUrl;
      const messages: string[] = [];
      if (selected.mediaAssetId && !mediaUrl) {
        messages.push("Không lấy được media preview URL.");
      }
      if (selectedChapter?.narrationAssetId && !narrationUrl) {
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
        durationMs: selection.durationMs,
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

      <EditorPlaybackSurface
        beats={orderedBeats}
        chapters={chapters}
        selectedBeatId={selectedId}
        previewBeat={previewBeat}
        mediaUrl={previewSources.mediaUrl}
        narrationUrl={previewSources.narrationUrl}
        narrationStartMs={selectedChapter?.startMs ?? null}
        narrationEndMs={selectedChapter?.endMs ?? null}
        previewLoading={previewSources.loading}
        previewMessage={previewSources.message}
        totalDurationMs={totalMs}
        scopeWindowStartMs={scopeWindow.startMs}
        scopeWindowEndMs={scopeWindow.endMs}
        onSelectBeat={selectBeat}
        onUploadMedia={(type) => void uploadBeatMedia(type)}
      />

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
