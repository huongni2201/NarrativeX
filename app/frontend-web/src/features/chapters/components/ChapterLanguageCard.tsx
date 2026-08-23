import type { ApiChapterLanguageStatus } from "@/types/api";
import { TranslationConfirmationDialog } from "./TranslationConfirmationDialog";

interface ChapterLanguageCardProps {
  languageStatus: ApiChapterLanguageStatus | null;
  translationPromptOpen: boolean;
  confirmingTranslation: boolean;
  onCloseTranslationPrompt: () => void;
  onAnalyzeOriginal: () => void;
  onConfirmTranslation: () => void;
}

export function ChapterLanguageCard({
  languageStatus,
  translationPromptOpen,
  confirmingTranslation,
  onCloseTranslationPrompt,
  onAnalyzeOriginal,
  onConfirmTranslation,
}: Readonly<ChapterLanguageCardProps>) {
  if (!languageStatus) return null;

  return (
    <>
      <section className="rounded-2xl border border-border bg-surface-card/90 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-100">Ngôn ngữ Chapter</h2>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Phát hiện: <span className="font-medium text-slate-200">{languageStatus.detectedLanguage?.toUpperCase() ?? "Không xác định"}</span>
          <span className="mx-1.5 text-slate-600">·</span>
          Project: <span className="font-medium text-slate-200">{languageStatus.projectLanguage.toUpperCase()}</span>
        </p>
      </section>
      {translationPromptOpen && (
        <TranslationConfirmationDialog
          languageStatus={languageStatus}
          confirmingTranslation={confirmingTranslation}
          onClose={onCloseTranslationPrompt}
          onAnalyzeOriginal={onAnalyzeOriginal}
          onConfirm={onConfirmTranslation}
        />
      )}
    </>
  );
}
