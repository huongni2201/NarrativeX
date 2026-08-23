import type { ApiChapterLanguageStatus } from "@/types/api";

interface TranslationConfirmationDialogProps {
  languageStatus: ApiChapterLanguageStatus;
  confirmingTranslation: boolean;
  onClose: () => void;
  onAnalyzeOriginal: () => void;
  onConfirm: () => void;
}

export function TranslationConfirmationDialog({
  languageStatus,
  confirmingTranslation,
  onClose,
  onAnalyzeOriginal,
  onConfirm,
}: Readonly<TranslationConfirmationDialogProps>) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="translation-prompt-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-card p-5 shadow-2xl">
        <h2 id="translation-prompt-title" className="text-base font-semibold text-slate-100">
          Nội dung có vẻ là {languageStatus.detectedLanguage?.toUpperCase()}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Ngôn ngữ của dự án là {languageStatus.projectLanguage.toUpperCase()}. Bạn có muốn tạo bản
          dịch trước khi phân tích không? Bản gốc vẫn được giữ nguyên.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-sm text-slate-300 hover:bg-surface-panel">
            Để sau
          </button>
          <button type="button" onClick={onAnalyzeOriginal} className="rounded-lg border border-border px-3 py-2 text-sm text-slate-200 hover:bg-surface-panel">
            Tiếp tục bản gốc
          </button>
          <button type="button" onClick={onConfirm} disabled={confirmingTranslation} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
            {confirmingTranslation ? "Đang xếp hàng…" : `Dịch sang ${languageStatus.projectLanguage.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
