import { useEffect, useState } from "react";
import type { ImageGenerationProvider, VisualGenerationMode } from "@narrativex/client-contracts";
import { PencilLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaneHeader, WorkspacePane } from "../../workspace/components/WorkstationPrimitives";
import { AnalyzeChapterDialog } from "./AnalyzeChapterDialog";
import { ChapterAudioPanel } from "./ChapterAudioPanel";
import { ChapterNextActions } from "./ChapterNextActions";
import { ChapterWritingForm } from "./ChapterWritingForm";
import type { ChapterEditorPanelProps } from "./chapter-editor.types";

export function ChapterEditorPanel({
  selected,
  workspace,
  canAnalyze,
  title,
  sourceText,
  busy,
  saveBusy,
  analyzeBusy,
  isDirty,
  notice,
  audio,
  onTitleChange,
  onSourceTextChange,
  onBeginCreate,
  onCancel,
  onSave,
  onAnalyze,
  onOpenEditor,
}: ChapterEditorPanelProps) {
  const [analyzeModalOpen, setAnalyzeModalOpen] = useState(false);
  const [visualGenerationMode, setVisualGenerationMode] =
    useState<VisualGenerationMode>("IMAGE");
  const [imageProvider, setImageProvider] =
    useState<ImageGenerationProvider>("GEMINI_WEB");
  const generationBlockedByUnsavedChanges = Boolean(selected && isDirty);

  useEffect(() => {
    if (!selected) return;
    const analysis = workspace?.pipeline.analysis;
    if (analysis?.visualGenerationMode) {
      setVisualGenerationMode(analysis.visualGenerationMode);
    }
    if (analysis?.imageProvider) {
      setImageProvider(analysis.imageProvider);
    }
  }, [
    selected,
    workspace?.pipeline.analysis.imageProvider,
    workspace?.pipeline.analysis.visualGenerationMode,
  ]);

  function submitAnalysis() {
    onAnalyze({
      visualGenerationMode,
      imageProvider: visualGenerationMode === "IMAGE" ? imageProvider : null,
    });
    setAnalyzeModalOpen(false);
  }

  return (
    <>
      <WorkspacePane className="flex flex-col border-r border-border-subtle bg-surface-panel">
        <PaneHeader
          title={selected ? "Chỉnh sửa chapter" : "Tạo chapter mới"}
          meta={
            selected
              ? "Lưu thay đổi trước khi phân tích hoặc tạo narration."
              : "Nhập và lưu chapter trước khi tiếp tục production pipeline."
          }
          actions={
            selected ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBeginCreate}
                disabled={busy}
              >
                <Plus size={12} /> Chapter mới
              </Button>
            ) : undefined
          }
        />

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          <ChapterWritingForm
            title={title}
            sourceText={sourceText}
            onTitleChange={onTitleChange}
            onSourceTextChange={onSourceTextChange}
          />

          <ChapterAudioPanel
            selected={selected}
            generationBlockedByUnsavedChanges={generationBlockedByUnsavedChanges}
            audio={audio}
          />

          <ChapterNextActions
            selected={selected}
            busy={busy}
            analyzeBusy={analyzeBusy}
            canAnalyze={canAnalyze}
            generationBlockedByUnsavedChanges={generationBlockedByUnsavedChanges}
            onAnalyze={() => setAnalyzeModalOpen(true)}
            onOpenEditor={onOpenEditor}
          />
        </div>

        <footer className="shrink-0 border-t border-border-subtle bg-surface-panel px-3 py-2.5">
          {notice && (
            <p className="mb-2 text-[10px] leading-4 text-text-secondary" role="status">
              {notice}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={busy}
              className="min-w-24"
            >
              Hủy
            </Button>
            <Button
              onClick={onSave}
              disabled={!title.trim() || !sourceText.trim() || busy || !isDirty}
              className="min-w-36 gap-1.5"
            >
              <PencilLine size={13} />
              <span>{saveBusy ? "Đang lưu…" : selected ? "Lưu thay đổi" : "Tạo chapter"}</span>
            </Button>
          </div>
        </footer>
      </WorkspacePane>

      {analyzeModalOpen && selected && (
        <AnalyzeChapterDialog
          visualGenerationMode={visualGenerationMode}
          imageProvider={imageProvider}
          onVisualGenerationModeChange={setVisualGenerationMode}
          onImageProviderChange={setImageProvider}
          onCancel={() => setAnalyzeModalOpen(false)}
          onSubmit={submitAnalysis}
        />
      )}
    </>
  );
}
