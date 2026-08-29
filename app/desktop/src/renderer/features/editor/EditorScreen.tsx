import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BeatMediaFitMode,
  DesktopTimelineBeat,
} from "@narrativex/client-contracts";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBeatDecision } from "../production/auto-edit-planner";
import { RenderDialog } from "../production/components/RenderDialog";
import { useRenderController } from "../production/useRenderController";
import type { DesktopWorkspaceState } from "../workspace/queries/useProjectWorkspace";
import { EditorExplorerPanel } from "./components/EditorExplorerPanel";
import { EditorInspectorPanel } from "./components/EditorInspectorPanel";
import { EditorPlaybackSurface } from "./components/EditorPlaybackSurface";
import { isEditorMutationCurrent } from "./editor-mutation-state";
import {
  buildEditorHierarchy,
  resolveEditorScopeWindow,
  sortEditorBeats,
  type EditorChapterGroup,
  type EditorScope,
} from "./editor-timeline";
import { EditorMediaAttachError } from "./model/editor-media-workflow";
import { useEditorMediaMutations } from "./queries/editor-media.mutations";
import { useEditorPreviewSources } from "./queries/editor-preview.queries";
import { useEditorSubtitles } from "./queries/editor-subtitles.queries";

export interface MediaMutationNotice {
  beatId: string;
  tone: "success" | "error";
  message: string;
  retry?: () => void;
}

export function EditorScreen({
  workspace,
}: Readonly<{
  workspace: DesktopWorkspaceState;
}>) {
  const timeline = workspace.timeline;
  const projectId = timeline?.projectId ?? null;
  const projectName = workspace.projects.find((project) => project.id === projectId)?.name;
  const renderController = useRenderController({
    projectId: projectId ?? "",
    timeline,
    projectName,
  });
  const [renderOpen, setRenderOpen] = useState(false);
  const beats = timeline?.beats ?? [];
  const chapters = timeline?.chapters ?? [];
  const subtitles = useEditorSubtitles({
    projectId,
    storyVersionId: timeline?.storyVersionId ?? null,
    chapters,
  });
  const orderedBeats = useMemo(() => sortEditorBeats(beats), [beats]);
  const selectableAssets = useMemo(
    () => workspace.assets.filter((asset) => asset.type === "IMAGE" || asset.type === "VIDEO"),
    [workspace.assets],
  );
  const [selectedId, setSelectedId] = useState("");
  const selectedIdRef = useRef("");
  const mediaMutationRequestRef = useRef(0);
  const [query, setQuery] = useState("");
  const [scope] = useState<EditorScope>("project");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<MediaMutationNotice | null>(null);
  const mediaMutations = useEditorMediaMutations(projectId);

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
  const previewSources = useEditorPreviewSources({
    projectId,
    mediaAssetId: selected?.mediaAssetId ?? null,
    mediaStorageMode: selected?.storageMode,
    narrationChapterId: selectedChapter?.chapterId ?? null,
    narrationAssetId: selectedChapter?.narrationAssetId ?? null,
    narrationSizeBytes: selectedChapter?.audioSizeBytes ?? null,
    narrationChecksum: selectedChapter?.audioChecksum ?? null,
  });
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

  const selectBeat = (beat: DesktopTimelineBeat) => {
    changeSelectedId(beat.visualBeatId);
  };

  function isCurrentMediaMutation(requestId: number, beatId: string) {
    return isEditorMutationCurrent(
      {
        requestId: mediaMutationRequestRef.current,
        beatId: selectedIdRef.current,
      },
      { requestId, beatId },
    );
  }

  async function withMediaMutation<T>(
    beatId: string,
    action: () => Promise<T>,
    successMessage: string | ((result: T) => string),
    retry?: () => void,
  ) {
    const requestId = ++mediaMutationRequestRef.current;
    setMediaBusy(true);
    setMediaNotice(null);
    try {
      const result = await action();
      if (!isCurrentMediaMutation(requestId, beatId)) return;
      setMediaNotice({
        beatId,
        tone: "success",
        message: typeof successMessage === "function" ? successMessage(result) : successMessage,
      });
    } catch (error) {
      if (!isCurrentMediaMutation(requestId, beatId)) return;
      setMediaNotice({
        beatId,
        tone: "error",
        message: error instanceof Error ? error.message : "Không thể cập nhật media cho beat.",
        retry,
      });
    } finally {
      if (isCurrentMediaMutation(requestId, beatId)) setMediaBusy(false);
    }
  }

  async function uploadBeatMedia(expectedType?: "IMAGE" | "VIDEO") {
    if (!projectId || !selected) return;
    const beat = selected;
    const beatId = beat.visualBeatId;
    const requestId = ++mediaMutationRequestRef.current;
    setMediaBusy(true);
    setMediaNotice(null);

    try {
      const result = await mediaMutations.importMedia.mutateAsync({
        beat,
        expectedType,
        isCurrent: () => selectedIdRef.current === beatId,
      });
      if (!result || !isCurrentMediaMutation(requestId, beatId)) return;
      setMediaNotice({
        beatId,
        tone: "success",
        message:
          result.mediaType === "VIDEO"
            ? "Video đã được gắn và Auto Edit sẽ tự fit theo narration."
            : "Ảnh đã được gắn vào Visual Beat.",
      });
    } catch (error) {
      if (!isCurrentMediaMutation(requestId, beatId)) return;
      if (error instanceof EditorMediaAttachError) {
        const retryAttach = () => {
          void withMediaMutation(
            beatId,
            () => mediaMutations.attachMedia.mutateAsync(error.retryInput),
            "Asset đã được gắn lại vào Visual Beat.",
            retryAttach,
          );
        };
        setMediaNotice({ beatId, tone: "error", message: error.message, retry: retryAttach });
      } else {
        setMediaNotice({
          beatId,
          tone: "error",
          message: error instanceof Error ? error.message : "Không thể nhập media vào project.",
        });
      }
    } finally {
      if (isCurrentMediaMutation(requestId, beatId)) setMediaBusy(false);
    }
  }

  async function chooseExistingAsset(assetId: string) {
    if (!projectId || !selected) return;
    const beat = selected;
    const beatId = beat.visualBeatId;
    const asset = selectableAssets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    const action = () => mediaMutations.chooseExistingAsset.mutateAsync({ beat, asset });
    const successMessage = (result: Awaited<ReturnType<typeof action>>) =>
      `${result.originalFilename} đã được gắn; Auto Edit chọn ${result.fitMode}.`;
    const retry = () => void withMediaMutation(beatId, action, successMessage, retry);
    await withMediaMutation(beatId, action, successMessage, retry);
  }

  async function updateFitMode(fitMode: BeatMediaFitMode) {
    if (!projectId || !selected?.mediaAssetId) return;
    const beat = selected;
    const beatId = beat.visualBeatId;
    const action = () => mediaMutations.updateFitMode.mutateAsync({ beat, fitMode });
    const retry = () =>
      void withMediaMutation(
        beatId,
        action,
        `Manual override đã chuyển fit mode sang ${fitMode}.`,
        retry,
      );
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
    const action = () => mediaMutations.resetMedia.mutateAsync({ beatId });
    const retry = () =>
      void withMediaMutation(beatId, action, "Visual Beat đã quay về generated source.", retry);
    await withMediaMutation(beatId, action, "Visual Beat đã quay về generated source.", retry);
  }

  return (
    <div className="nx-editor-layout relative grid h-full min-h-0 min-w-0 grid-cols-[var(--editor-explorer-width)_minmax(0,1fr)_var(--editor-inspector-width)] grid-rows-[minmax(0,2fr)_minmax(0,1fr)] overflow-hidden bg-background text-foreground select-none">
      <div className="absolute right-[calc(var(--editor-inspector-width)+16px)] top-3 z-50">
        <Button
          size="sm"
          onClick={() => setRenderOpen(true)}
          disabled={!projectId || !timeline}
          className="shadow-lg"
        >
          <Film size={14} /> Render
        </Button>
      </div>

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
        subtitleCues={subtitles.cues}
        selectedBeatId={selectedId}
        previewBeat={previewBeat}
        mediaUrl={previewSources.mediaUrl}
        narrationUrl={previewSources.narrationUrl}
        narrationStartMs={selectedChapter?.startMs ?? null}
        narrationEndMs={selectedChapter?.endMs ?? null}
        previewLoading={previewSources.loading || subtitles.loading}
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

      <RenderDialog
        open={renderOpen}
        onClose={() => setRenderOpen(false)}
        controller={renderController}
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
