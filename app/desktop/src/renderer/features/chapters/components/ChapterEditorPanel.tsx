import { useEffect, useState } from "react";
import type { ImageGenerationProvider, VisualGenerationMode } from "@narrativex/client-contracts";
import { PencilLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-panel shadow-[var(--shadow-panel)]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <div className="flex items-center gap-2">
              <PencilLine className="text-text-secondary" size={18} />
              <h2 className="text-base font-bold text-foreground">
                {selected ? "Chỉnh sửa chapter" : "Tạo chapter mới"}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-text-muted">
              {selected
                ? "Lưu thay đổi trước khi chạy các bước phân tích hoặc tạo audio."
                : "Nhập nội dung chapter rồi lưu để tiếp tục pipeline."}
            </p>
          </div>

          {selected && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBeginCreate}
              disabled={busy}
              className="h-8 shrink-0 gap-1.5 text-xs"
            >
              <Plus size={13} />
              Chapter mới
            </Button>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
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

        <footer className="shrink-0 border-t border-border bg-surface-panel px-5 py-3">
          {notice && (
            <p className="mb-2 text-xs text-text-secondary" role="status">
              {notice}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={busy}
              className="h-9 flex-1 border-border bg-surface-input text-xs font-semibold text-text-secondary"
            >
              Hủy
            </Button>
            <Button
              onClick={onSave}
              disabled={!title.trim() || !sourceText.trim() || busy || !isDirty}
              className="h-9 flex-1 gap-1.5 text-xs font-bold"
            >
              <PencilLine size={13} />
              <span>{saveBusy ? "Đang lưu…" : selected ? "Lưu thay đổi" : "Tạo chapter"}</span>
            </Button>
          </div>
        </footer>
      </section>

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
