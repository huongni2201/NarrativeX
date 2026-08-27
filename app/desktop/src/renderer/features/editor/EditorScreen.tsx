import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { isEditorMutationCurrent } from "./editor-mutation-state";
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

export interface MediaMutationNotice {
  beatId: string;
  tone: "success" | "error";
  message: string;
  retry?: () => void;
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
  const selectedIdRef = useRef("");
  const mediaMutationRequestRef = useRef(0);
  const [query, setQuery] = useState("");
  // Review should naturally continue across chapter boundaries. Beat/scene/chapter
  // scopes remain modelled in editor-timeline for future explicit focus controls.
  const [scope] = useState<EditorScope>("project");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<MediaMutationNotice | null>(null);
  const [previewSources, setPreviewSources] = useState<PreviewSources>(EMPTY_PREVIEW);

  const changeSelectedId = useCallback((nextId: string) => {
    selectedIdRef.current = nextId;
    mediaMutationRequestRef.current += 1;
    setMediaBusy(false);
    setMediaNotice(null);
    setSelectedId(nextId);
  }, []);

  useEffect(() => {
    if (!orderedBeats.length) {
      if (selectedId) changeSelectedId("");
      return;
    }
    if (!orderedBeats.some((beat) => beat.visualBeatId === selectedId)) {
      changeSelectedId(orderedBeats[0].visualBeatId);
      return;
    }
    selectedIdRef.current = selectedId;
  }, [changeSelectedId, orderedBeats, selectedId]);

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
    changeSelectedId(beat.visualBeatId);
  };

  async function refreshEditorData() {
    if (!projectId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
      queryClient.invalidateQueries({ queryKey: ["assets", "library"] }),
    ]);
  }

  function isCurrentMediaMutation(requestId: number, beatId: string) {
    return isEditorMutationCurrent(
      {
        requestId: mediaMutationRequestRef.current,
        beatId: selectedIdRef.current,
      },
      { requestId, beatId },
    );
  }

  async function withMediaMutation(
    beatId: string,
    action: () => Promise<void>,
    successMessage: string,
    retry?: () => void,
  ) {
    const requestId = ++mediaMutationRequestRef.current;
    setMediaBusy(true);
    setMediaNotice(null);
    try {
      await action();
      await refreshEditorData();
      if (!isCurrentMediaMutation(requestId, beatId)) return;
      setMediaNotice({ beatId, tone: "success", message: successMessage });
    } catch (error) {
      if (!isCurrentMediaMutation(requestId, beatId)) return;
      setMediaNotice({
        beatId,
        tone: "error",
        message: error instanceof Error ? error.message : "Không thể cập nhật media cho beat.",
        retry,
      });
    } finally {
      if (isCurrentMediaMutation(requestId, beatId)) {
        setMediaBusy(false);
      }
    }
  }

  async function uploadBeatMedia(expectedType?: "IMAGE" | "VIDEO") {
    if (!projectId || !selected) return;
    const beat = selected;
    const beatId = beat.visualBeatId;
    setMediaNotice(null);
    const selection = await window.narrativex.localStorage.selectAsset();
    if (!selection || selectedIdRef.current !== beatId) return;
    if (selection.kind !== "IMAGE" && selection.kind !== "VIDEO") {
      setMediaNotice({
        beatId,
        tone: "error",
        message: "Hãy chọn một file ảnh hoặc video.",
      });
      return;
    }
    if (expectedType && selection.kind !== expectedType) {
      setMediaNotice({
        beatId,
        tone: "error",
        message: expectedType === "VIDEO" ? "Hãy chọn một file video." : "Hãy chọn một file ảnh.",
      });
      return;
    }

    const requestId = ++mediaMutationRequestRef.current;
    setMediaBusy(true);
    try {
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
        durationMs: beat.durationMs,
      });
      const attachAsset = () =>
        productionApi.updateBeatMedia(projectId, beatId, {
          mediaAssetId: asset.id,
          fitMode: autoFit.fitMode,
          trimStartMs: autoFit.trimStartMs,
        });
      const retryAttach = () => {
        void withMediaMutation(
          beatId,
          attachAsset,
          "Asset đã được gắn lại vào Visual Beat.",
          retryAttach,
        );
      };

      try {
        await attachAsset();
        await refreshEditorData();
        if (!isCurrentMediaMutation(requestId, beatId)) return;
        setMediaNotice({
          beatId,
          tone: "success",
          message:
            selection.kind === "VIDEO"
              ? "Video đã được gắn và Auto Edit sẽ tự fit theo narration."
              : "Ảnh đã được gắn vào Visual Beat.",
        });
      } catch (error) {
        if (!isCurrentMediaMutation(requestId, beatId)) return;
        setMediaNotice({
          beatId,
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Asset đã được lưu cục bộ nhưng chưa thể gắn vào Visual Beat.",
          retry: retryAttach,
        });
      }
    } catch (error) {
      if (!isCurrentMediaMutation(requestId, beatId)) return;
      setMediaNotice({
        beatId,
        tone: "error",
        message: error instanceof Error ? error.message : "Không thể nhập media vào project.",
      });
    } finally {
      if (isCurrentMediaMutation(requestId, beatId)) {
        setMediaBusy(false);
      }
    }
  }

  async function chooseExistingAsset(assetId: string) {
    if (!projectId || !selected) return;
    const beat = selected;
    const beatId = beat.visualBeatId;
    const asset = selectableAssets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    const autoFit = chooseMediaFit({
      mediaType: asset.type === "VIDEO" ? "VIDEO" : "IMAGE",
      sourceDurationMs: asset.durationMs,
      durationMs: beat.durationMs,
    });
    const action = () =>
      productionApi.updateBeatMedia(projectId, beatId, {
        mediaAssetId: asset.id,
        fitMode: autoFit.fitMode,
        trimStartMs: autoFit.trimStartMs,
      });
    const retry = () => {
      void withMediaMutation(
        beatId,
        action,
        `${asset.originalFilename} đã được gắn; Auto Edit chọn ${autoFit.fitMode}.`,
        retry,
      );
    };
    await withMediaMutation(
      beatId,
      action,
      `${asset.originalFilename} đã được gắn; Auto Edit chọn ${autoFit.fitMode}.`,
      retry,
    );
  }

  async function updateFitMode(fitMode: BeatMediaFitMode) {
    if (!projectId || !selected?.mediaAssetId) return;
    const beat = selected;
    const beatId = beat.visualBeatId;
    const action = () =>
      productionApi.updateBeatMedia(projectId, beatId, {
        mediaAssetId: beat.mediaAssetId as string,
        fitMode,
        trimStartMs: beat.trimStartMs,
      });
    const retry = () => {
      void withMediaMutation(
        beatId,
        action,
        `Manual override đã chuyển fit mode sang ${fitMode}.`,
        retry,
      );
    };
    await withMediaMutation(
      beatId,
      action,
      `Manual override đã chuyển fit mode sang ${fitMode}.`,
      retry,
    );
  }

  async function resetToGeneratedSource() {
    if (!projectId || !selected) return;
    const beatId = selected.visualBeatId;
    const action = () => productionApi.resetBeatMedia(projectId, beatId);
    const retry = () => {
      void withMediaMutation(beatId, action, "Visual Beat đã quay về generated source.", retry);
    };
    await withMediaMutation(beatId, action, "Visual Beat đã quay về generated source.", retry);
  }

  return (
    <div className="nx-editor-layout grid h-full min-h-0 min-w-0 grid-cols-[var(--editor-explorer-width)_minmax(0,1fr)_var(--editor-inspector-width)] grid-rows-[minmax(0,1fr)_var(--editor-timeline-height)] overflow-hidden bg-background text-foreground select-none">
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
