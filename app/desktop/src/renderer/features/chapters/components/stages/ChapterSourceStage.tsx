import { useState, useEffect } from "react";
import { Sparkles, Save, FileText, CheckCircle, AlertCircle } from "lucide-react";
import type { DesktopChapterDetails } from "@narrativex/client-contracts";

export interface ChapterSourceStageProps {
  chapter: DesktopChapterDetails | null;
  onSave: (title: string, sourceText: string) => Promise<void>;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export function ChapterSourceStage({
  chapter,
  onSave,
  onAnalyze,
  isAnalyzing,
}: ChapterSourceStageProps) {
  const [title, setTitle] = useState(chapter?.title ?? "");
  const [sourceText, setSourceText] = useState(chapter?.sourceText ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setTitle(chapter?.title ?? "");
    setSourceText(chapter?.sourceText ?? "");
  }, [chapter]);

  const isDirty =
    chapter && (title !== chapter.title || sourceText !== chapter.sourceText);

  const words = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(title, sourceText);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!chapter) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-text-muted p-8">
        <FileText size={44} className="mb-2 text-text-dim" />
        <span className="text-[14px]">Chọn hoặc tạo một chương để bắt đầu soạn thảo.</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Source Action Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-dark px-4">
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-text-muted">
            Số từ: <strong className="text-foreground font-mono">{words}</strong>
          </span>
          {isDirty && (
            <span className="inline-flex items-center gap-1 rounded bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning border border-warning/20">
              <AlertCircle size={12} />
              Chưa lưu thay đổi
            </span>
          )}
          {savedSuccess && (
            <span className="inline-flex items-center gap-1 rounded bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success border border-success/20">
              <CheckCircle size={12} />
              Đã lưu
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all ${
              isDirty
                ? "bg-surface-3 text-foreground hover:bg-surface-2 border border-border"
                : "bg-surface-dark text-text-dim cursor-not-allowed border border-border-subtle"
            }`}
          >
            <Save size={14} />
            <span>{isSaving ? "Đang lưu..." : "Lưu văn bản"}</span>
          </button>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground transition-all hover:bg-primary-hover shadow-sm disabled:opacity-50"
            title="Sử dụng Gemini 3.8 Flash Story Director để phân tích cấu trúc, nhân vật, bối cảnh và StoryBeats"
          >
            <Sparkles size={15} className={isAnalyzing ? "animate-spin" : ""} />
            <span>{isAnalyzing ? "Đang phân tích..." : "Analyze Chapter"}</span>
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4 max-w-4xl mx-auto w-full">
        <div>
          <label className="block text-[12px] font-medium text-text-muted uppercase tracking-wider mb-1.5">
            Tiêu đề chương
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Chương 1 - Lời sấm truyền khởi đầu..."
            className="w-full rounded-lg border border-border-subtle bg-surface-input px-3.5 py-2 text-[15px] font-medium text-foreground placeholder:text-text-dim focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex-1 flex flex-col min-h-[400px]">
          <label className="block text-[12px] font-medium text-text-muted uppercase tracking-wider mb-1.5">
            Văn bản nguồn chương (Source Text)
          </label>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Dán hoặc soạn thảo nội dung văn bản kịch bản/tiểu thuyết của chương vào đây..."
            rows={18}
            className="w-full flex-1 rounded-lg border border-border-subtle bg-surface-input p-4 font-serif text-[15px] leading-relaxed text-foreground placeholder:text-text-dim focus:border-primary focus:outline-none resize-y"
          />
        </div>
      </div>
    </div>
  );
}
