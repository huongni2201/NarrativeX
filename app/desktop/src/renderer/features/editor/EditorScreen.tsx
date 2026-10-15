import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderDimensions } from "../../../shared/render-dimensions";
import type {
  BeatMediaFitMode,
  DesktopTimelineBeat,
} from "../../../shared/api-types";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RenderDialog } from "../production/components/RenderDialog";
import type { RenderController } from "../production/useRenderController";
import type { DesktopWorkspaceState } from "../workspace/queries/useProjectWorkspace";
import { EditorExplorerPanel } from "./components/EditorExplorerPanel";
import { EditorInspectorPanel } from "./components/EditorInspectorPanel";
import { EditorPlaybackSurface } from "./components/EditorPlaybackSurface";
import { isEditorMutationCurrent } from "./editor-mutation-state";
import {
  buildEditorHierarchy,
  editorBeatIdentity,
  groupStoryBeats,
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
  renderController,
}: Readonly<{
  workspace: DesktopWorkspaceState;
  renderController: RenderController;
}>) {
  const timeline = workspace.timeline;
  const projectId = timeline?.projectId ?? null;
  const [renderOpen, setRenderOpen] = useState(false);
  const [subtitleEditing, setSubtitleEditing] = useState(false);
  const [openSubtitleSignal, setOpenSubtitleSignal] = useState(0);
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
    if (!orderedBeats.some((beat) => editorBeatIdentity(beat) === selectedId)) {
      changeSelectedId(editorBeatIdentity(orderedBeats[0]));
      return;
    }
    selectedIdRef.current = selectedId;
  }, [changeSelectedId, orderedBeats, selectedId]);

  const totalMs = timeline?.totalDurationMs ?? 0;
  const selected = useMemo(
    () => orderedBeats.find((beat) => editorBeatIdentity(beat) === selectedId) ?? null,
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
    narrationChapterId: selectedChapter?.chapterId ?? null,
    narrationAssetId: selectedChapter?.narrationAssetId ?? null,
    narrationSizeBytes: selectedChapter?.audioSizeBytes ?? null,
    narrationChecksum: selectedChapter?.audioChecksum ?? null,
  });
  const autoDecision = useMemo(
    () =>
      selected
        ? renderController.autoEditPlan?.decisions.find(
            (decision) => decision.visualBeatId === selected.visualBeatId,
          ) ?? null
        : null,
    [renderController.autoEditPlan, selected],
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
    changeSelectedId(editorBeatIdentity(beat));
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
        isCurrent: () => selectedIdRef.current === editorBeatIdentity(beat),
      });
      if (!result || !isCurrentMediaMutation(requestId, editorBeatIdentity(beat))) return;
      setMediaNotice({
        beatId,
        tone: "success",
        message:
          result.mediaType === "VIDEO"
            ? "Video đã được gắn và Auto Edit sẽ tự fit theo narration."
            : "Ảnh đã được gắn vào Visual Beat.",
      });
    } catch (error) {
      if (!isCurrentMediaMutation(requestId, editorBeatIdentity(beat))) return;
      if (error instanceof EditorMediaAttachError) {
        const retryAttach = () => {
          void withMediaMutation(
            editorBeatIdentity(beat),
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
      if (isCurrentMediaMutation(requestId, editorBeatIdentity(beat))) setMediaBusy(false);
    }
  }

  async function chooseExistingAsset(assetId: string) {
    if (!projectId || !selected) return;
    const beat = selected;
    const selectionKey = editorBeatIdentity(beat);
    const asset = selectableAssets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    const action = () => mediaMutations.chooseExistingAsset.mutateAsync({ beat, asset });
    const successMessage = (result: Awaited<ReturnType<typeof action>>) =>
      `${result.originalFilename} đã được gắn; Auto Edit chọn ${result.fitMode}.`;
    const retry = () => void withMediaMutation(selectionKey, action, successMessage, retry);
    await withMediaMutation(selectionKey, action, successMessage, retry);
  }

  async function updateFitMode(fitMode: BeatMediaFitMode) {
    if (!projectId || !selected?.mediaAssetId) return;
    const beat = selected;
    const selectionKey = editorBeatIdentity(beat);
    const action = () => mediaMutations.updateFitMode.mutateAsync({ beat, fitMode });
    const retry = () =>
      void withMediaMutation(
        selectionKey,
        action,
        `Manual override đã chuyển fit mode sang ${fitMode}.`,
        retry,
      );
    await withMediaMutation(
      selectionKey,
      action,
      `Manual override đã chuyển fit mode sang ${fitMode}.`,
      retry,
    );
  }

  async function resetToGeneratedSource() {
    if (!projectId || !selected) return;
    const beat = selected;
    const beatId = beat.visualBeatId;
    const selectionKey = editorBeatIdentity(beat);
    const action = () => mediaMutations.resetMedia.mutateAsync({ beatId });
    const retry = () =>
      void withMediaMutation(selectionKey, action, "Visual Beat đã quay về generated source.", retry);
    await withMediaMutation(selectionKey, action, "Visual Beat đã quay về generated source.", retry);
  }

  return (
    <div className="nx-editor-layout relative grid h-full min-h-0 min-w-0 grid-cols-[var(--editor-explorer-width)_minmax(0,1fr)_var(--editor-inspector-width)] grid-rows-[minmax(0,2fr)_minmax(0,1fr)] overflow-hidden bg-background text-foreground select-none">
      <div className="absolute right-[calc(var(--editor-inspector-width)+14px)] top-2.5 z-40">
        <Button
          size="sm"
          onClick={() => setRenderOpen(true)}
          disabled={!projectId || !timeline}
          className="border border-primary/30 bg-primary font-medium text-primary-foreground shadow-sm transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:bg-primary-hover active:scale-[0.98]"
        >
          <Film size={13} /> Render
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
        subtitleStyle={renderController.subtitleStyle}
        subtitlesEnabled={renderController.subtitlesEnabled}
        subtitleEditing={subtitleEditing}
        aspectRatio={timeline?.aspectRatio ?? "16:9"}
        subtitleReferenceHeight={renderDimensions(renderController.resolution, timeline?.aspectRatio ?? "16:9").height}
        selectedBeatId={selectedId}
        previewBeat={previewBeat}
        frameRate={renderController.frameRate}
        mediaUrl={previewSources.mediaUrl}
        narrationUrl={selected?.shotId ? null : previewSources.narrationUrl}
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
        subtitleController={renderController}
        onSubtitleEditingChange={setSubtitleEditing}
        openSubtitleSignal={openSubtitleSignal}
      />

      <RenderDialog
        open={renderOpen}
        onClose={() => setRenderOpen(false)}
        controller={renderController}
        onEditSubtitles={() => {
          setRenderOpen(false);
          setOpenSubtitleSignal((signal) => signal + 1);
        }}
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
            `${beat.title} ${beat.visualIntent} ${beat.cameraMovement} ${beat.mediaType ?? ""} visual beat ${beat.beatIndex + 1} ${beat.storyBeatId ?? ""}`
              .toLocaleLowerCase()
              .includes(needle),
          );
      return sceneBeats.length
        ? [
            {
              ...scene,
              beats: sceneBeats,
              storyBeats: groupStoryBeats(sceneBeats),
            },
          ]
        : [];
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
