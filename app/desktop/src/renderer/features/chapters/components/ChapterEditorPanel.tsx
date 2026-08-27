import { useState } from "react";
import type {
  DesktopChapterDetails,
  DesktopChapterWorkspace,
  DesktopVoice,
  ImageGenerationProvider,
  VisualGenerationMode,
} from "@narrativex/client-contracts";
import {
  AudioLines,
  Clapperboard,
  Info,
  Loader2,
  PencilLine,
  Plus,
  WandSparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { setAnalyzeChapterPreferences } from "../../generation/api/generation.api";
import {
  audioButtonLabel,
  audioStatusBadgeClass,
  audioStatusLabel,
  formatDurationMs,
  wordCount,
} from "../model/chapter-ui";

type AudioState = Readonly<{
  voices: DesktopVoice[];
  voiceId: string;
  speakingRate: string;
  workspace: DesktopChapterWorkspace | undefined;
  workspaceError: boolean;
  status: string | null;
  busy: boolean;
  ready: boolean;
  processing: boolean;
  controlsDisabled: boolean;
  trackedForSelected: boolean;
  blockedByAnotherChapter: boolean;
  generatePending: boolean;
  blockMessage: string | null;
  requestError: string | null;
  onVoiceChange: (voiceId: string) => void;
  onSpeakingRateChange: (value: string) => void;
  onCreate: () => void;
  onRefetchWorkspace: () => void;
}>;

type Props = Readonly<{
  selected: DesktopChapterDetails | null;
  title: string;
  sourceText: string;
  busy: boolean;
  saveBusy: boolean;
  analyzeBusy: boolean;
  isDirty: boolean;
  notice: string | null;
  audio: AudioState;
  onTitleChange: (value: string) => void;
  onSourceTextChange: (value: string) => void;
  onBeginCreate: () => void;
  onCancel: () => void;
  onSave: () => void;
  onAnalyze: () => void;
  onOpenEditor: () => void;
}>;

export function ChapterEditorPanel({
  selected,
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
}: Props) {
  const [analyzeModalOpen, setAnalyzeModalOpen] = useState(false);
  const [visualGenerationMode, setVisualGenerationMode] =
    useState<VisualGenerationMode>("IMAGE");
  const [imageProvider, setImageProvider] =
    useState<ImageGenerationProvider>("GEMINI_WEB");
  const generationBlockedByUnsavedChanges = Boolean(selected && isDirty);
  const selectedVoiceName = audio.voices.find((voice) => voice.id === audio.voiceId)?.name;

  function submitAnalysis() {
    setAnalyzeChapterPreferences({
      visualGenerationMode,
      imageProvider: visualGenerationMode === "IMAGE" ? imageProvider : null,
    });
    setAnalyzeModalOpen(false);
    onAnalyze();
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
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary" htmlFor="chapter-title">
              Tên chapter <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <Input
                id="chapter-title"
                name="chapter-title"
                autoComplete="off"
                maxLength={120}
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Nhập tên chapter"
                className="h-9 border-border bg-surface-input pr-16 text-xs"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-dim">
                {title.length} / 120
              </span>
            </div>
          </div>

          <div className="flex min-h-[140px] flex-col space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary" htmlFor="chapter-source">
              Nội dung chapter <span className="text-danger">*</span>
            </label>
            <div className="relative flex flex-1 flex-col overflow-hidden rounded-md border border-border bg-surface-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <Textarea
                id="chapter-source"
                name="chapter-source"
                value={sourceText}
                onChange={(event) => onSourceTextChange(event.target.value)}
                placeholder="Nhập nội dung chapter..."
                className="min-h-[100px] flex-1 resize-none border-0 bg-transparent p-3 text-xs leading-relaxed focus-visible:ring-0"
              />
              <div className="flex items-center justify-between border-t border-border-subtle bg-surface-2 px-3 py-1.5 text-[10px] text-text-dim">
                <span>{wordCount(sourceText).toLocaleString("vi-VN")} từ</span>
                <span>{sourceText.length.toLocaleString("vi-VN")} ký tự</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-info/20 bg-info-bg p-3 text-xs leading-relaxed text-text-secondary">
            <Info className="mt-0.5 shrink-0 text-info" size={15} />
            <span>
              Phân tích và tạo audio luôn dùng bản chapter đã lưu trên backend, không dùng nội dung
              nháp chưa lưu trong form.
            </span>
          </div>

          <AudioChapterCard
            selected={selected}
            generationBlockedByUnsavedChanges={generationBlockedByUnsavedChanges}
            selectedVoiceName={selectedVoiceName}
            audio={audio}
          />

          <div className="space-y-2.5 border-t border-border pt-4">
            <span className="block text-[11px] font-semibold text-text-muted">
              Các hành động tiếp theo
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="outline"
                disabled={!selected || busy || generationBlockedByUnsavedChanges}
                onClick={() => setAnalyzeModalOpen(true)}
                aria-busy={analyzeBusy}
                className="h-auto items-start justify-start rounded-md border-border bg-surface p-3 text-left hover:border-border-dark hover:bg-surface-2"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-hover">
                    {analyzeBusy ? (
                      <Loader2 className="animate-spin" size={13} />
                    ) : (
                      <WandSparkles size={13} />
                    )}
                    <span>{analyzeBusy ? "Đang phân tích…" : "Phân tích chapter"}</span>
                  </div>
                  <p className="mt-1 text-[10px] font-normal leading-4 text-text-muted">
                    {analyzeBusy
                      ? "AI đang phân tích nội dung. Nút được khóa để tránh gửi trùng request."
                      : "Chọn IMAGE/VIDEO và provider trước khi tạo scene/beat."}
                  </p>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={!selected || busy}
                onClick={onOpenEditor}
                className="h-auto items-start justify-start rounded-md border-border bg-surface p-3 text-left hover:border-border-dark hover:bg-surface-2"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <Clapperboard size={13} />
                    <span>Mở Editor</span>
                  </div>
                  <p className="mt-1 text-[10px] font-normal leading-4 text-text-muted">
                    Chỉnh scene, visual beat và media trên timeline.
                  </p>
                </div>
              </Button>
            </div>
          </div>
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
        <AnalyzeChapterModal
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

function AnalyzeChapterModal({
  visualGenerationMode,
  imageProvider,
  onVisualGenerationModeChange,
  onImageProviderChange,
  onCancel,
  onSubmit,
}: Readonly<{
  visualGenerationMode: VisualGenerationMode;
  imageProvider: ImageGenerationProvider;
  onVisualGenerationModeChange: (value: VisualGenerationMode) => void;
  onImageProviderChange: (value: ImageGenerationProvider) => void;
  onCancel: () => void;
  onSubmit: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="analyze-chapter-title"
        className="w-full max-w-md rounded-xl border border-border bg-surface-panel shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <h2 id="analyze-chapter-title" className="text-sm font-bold text-foreground">
              Analyze Chapter
            </h2>
            <p className="mt-1 text-[11px] leading-4 text-text-muted">
              Chọn loại visual và provider để AI chuẩn bị scene/visual beat phù hợp cho bước generation.
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onCancel}
            className="grid size-7 shrink-0 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X size={14} />
          </button>
        </header>

        <div className="space-y-4 p-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
              Step 1 · Visual generation mode
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["IMAGE", "VIDEO"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onVisualGenerationModeChange(mode)}
                  className={`rounded-md border px-3 py-3 text-left transition ${
                    visualGenerationMode === mode
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-2"
                  }`}
                >
                  <div className="text-xs font-bold">{mode === "IMAGE" ? "Image" : "Video"}</div>
                  <p className="mt-1 text-[10px] leading-4 text-text-muted">
                    {mode === "IMAGE"
                      ? "Tạo storyboard still-image theo từng visual beat."
                      : "Chuẩn bị storyboard cho video generation."}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {visualGenerationMode === "IMAGE" && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                Step 2 · Image provider
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["GEMINI_WEB", "API"] as const).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => onImageProviderChange(provider)}
                    className={`rounded-md border px-3 py-3 text-left transition ${
                      imageProvider === provider
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border bg-surface text-text-secondary hover:bg-surface-2"
                    }`}
                  >
                    <div className="text-xs font-bold">
                      {provider === "GEMINI_WEB" ? "Gemini Web" : "API"}
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-text-muted">
                      {provider === "GEMINI_WEB"
                        ? "Manual generate/import trong Storyboard."
                        : "Generation job tự động qua backend provider."}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {visualGenerationMode === "IMAGE" && imageProvider === "GEMINI_WEB" && (
            <div className="rounded-md border border-info/25 bg-info-bg px-3 py-2 text-[10px] leading-4 text-text-secondary">
              Web image generation always creates a new image for each visual beat. Reuse và reframe không được dùng với Gemini Web.
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onSubmit}>
            <WandSparkles size={13} /> Analyze
          </Button>
        </footer>
      </div>
    </div>
  );
}

function AudioChapterCard({
  selected,
  generationBlockedByUnsavedChanges,
  selectedVoiceName,
  audio,
}: Readonly<{
  selected: DesktopChapterDetails | null;
  generationBlockedByUnsavedChanges: boolean;
  selectedVoiceName: string | undefined;
  audio: AudioState;
}>) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <AudioLines className="mt-0.5 shrink-0 text-text-secondary" size={16} />
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-foreground">Audio chapter</h3>
            <p className="mt-1 text-[10px] leading-4 text-text-secondary">
              Chọn giọng, tốc độ và tạo narration từ bản chapter đã lưu.
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-1 text-[9px] font-semibold ${audioStatusBadgeClass(
            audio.busy ? "PROCESSING" : audio.status,
          )}`}
          aria-live="polite"
        >
          {audio.busy
            ? "Đang xử lý"
            : audio.workspace
              ? audioStatusLabel(audio.workspace.pipeline.audio.status)
              : audio.workspaceError
                ? "Không tải được"
                : selected
                  ? "Đang tải…"
                  : "Chưa có chapter"}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_88px_140px] items-end gap-2">
        <label className="grid min-w-0 gap-1 text-[10px] text-text-secondary">
          <span>Giọng đọc</span>
          <select
            aria-label="Voice đọc chapter"
            value={audio.voiceId}
            onChange={(event) => audio.onVoiceChange(event.target.value)}
            disabled={audio.controlsDisabled || !audio.voices.length}
            className="h-8 min-w-0 rounded-md border border-border bg-surface-input px-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!audio.voices.length && <option value="">Chưa có voice</option>}
            {audio.voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} · {voice.language}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-[10px] text-text-secondary">
          <span>Tốc độ</span>
          <Input
            aria-label="Tốc độ đọc"
            type="number"
            min="0.25"
            max="2"
            step="0.05"
            value={audio.speakingRate}
            onChange={(event) => audio.onSpeakingRateChange(event.target.value)}
            disabled={audio.controlsDisabled}
            className="h-8 border-border bg-surface-input text-xs disabled:cursor-not-allowed"
          />
        </label>

        <div className="grid gap-1">
          <span className="text-[10px] text-text-secondary">Tạo audio</span>
          <Button
            type="button"
            onClick={audio.onCreate}
            disabled={
              !selected ||
              !audio.voiceId ||
              audio.controlsDisabled ||
              generationBlockedByUnsavedChanges
            }
            className="h-8 w-full gap-1.5 whitespace-nowrap px-3 text-xs font-bold"
          >
            {audio.busy ? (
              <Loader2 className="animate-spin" size={13} />
            ) : (
              <AudioLines size={13} />
            )}
            <span>
              {audioButtonLabel({
                generatePending: audio.generatePending,
                trackedForSelected: audio.trackedForSelected,
                processing: audio.processing,
                blockedByAnotherChapter: audio.blockedByAnotherChapter,
                ready: audio.ready,
              })}
            </span>
          </Button>
        </div>
      </div>

      {generationBlockedByUnsavedChanges && (
        <p className="text-[10px] leading-4 text-warning">
          Hãy lưu thay đổi trước khi tạo audio hoặc phân tích chapter.
        </p>
      )}

      {audio.blockedByAnotherChapter && (
        <p className="text-[10px] leading-4 text-info">
          Một chapter khác đang tạo audio. Chờ job hiện tại hoàn tất trước khi gửi job mới.
        </p>
      )}

      {audio.blockMessage && (
        <p
          className="rounded-md border border-warning/20 bg-warning-bg px-3 py-2 text-[10px] leading-4 text-warning"
          role="alert"
        >
          {audio.blockMessage}
        </p>
      )}

      {audio.requestError && (
        <p
          className="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-[10px] leading-4 text-danger"
          role="alert"
        >
          {audio.requestError}
        </p>
      )}

      <div className="border-t border-border-subtle pt-3">
        {audio.busy && (
          <div className="flex items-center gap-2 rounded-md border border-info/20 bg-info-bg px-3 py-2 text-[10px] text-text-secondary">
            <Loader2 className="shrink-0 animate-spin text-info" size={13} />
            <span>
              {audio.generatePending
                ? "Đang gửi yêu cầu tạo audio…"
                : "Narration worker đang xử lý. Nút tạo audio đã được khóa để tránh gửi trùng job."}
            </span>
          </div>
        )}

        {!audio.busy && audio.ready && audio.workspace?.pipeline.audio.audioUrl && (
          <div className="space-y-2 rounded-md border border-border-subtle bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <div className="min-w-0">
                <strong className="block truncate text-xs text-foreground">
                  Narration · {selectedVoiceName ?? "Audio chapter"}
                </strong>
                <span className="text-text-muted">
                  {formatDurationMs(audio.workspace.pipeline.audio.durationMs)}
                </span>
              </div>
              <span className="shrink-0 rounded bg-success-bg px-2 py-1 font-semibold text-success">
                Sẵn sàng
              </span>
            </div>
            <audio
              className="h-9 w-full"
              controls
              preload="metadata"
              src={audio.workspace.pipeline.audio.audioUrl}
              onError={audio.onRefetchWorkspace}
            />
          </div>
        )}

        {!audio.busy && audio.ready && !audio.workspace?.pipeline.audio.audioUrl && (
          <p className="rounded-md border border-warning/20 bg-warning-bg px-3 py-2 text-[10px] leading-4 text-warning">
            Audio đã sẵn sàng nhưng chưa lấy được URL nghe thử. Hãy tải lại workspace hoặc kiểm tra
            media storage.
          </p>
        )}

        {!audio.busy && audio.status === "FAILED" && (
          <p className="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-[10px] leading-4 text-danger">
            Tạo audio thất bại. Bạn có thể giữ nguyên giọng/tốc độ và bấm Tạo audio để thử lại.
          </p>
        )}

        {!audio.busy && !audio.ready && audio.status !== "FAILED" && (
          <p className="text-[10px] text-text-muted">
            Chưa có audio để nghe. Sau khi job hoàn tất, player sẽ xuất hiện ngay tại đây.
          </p>
        )}
      </div>
    </div>
  );
}
