import { useState } from "react";
import { ChapterAnalysisCard } from "./ChapterAnalysisCard";
import { ChapterLanguageCard } from "./ChapterLanguageCard";
import { ChapterPipelineSummary } from "./ChapterPipelineSummary";
import { ChapterSceneGrid } from "./ChapterSceneGrid";
import { GenerateNarrationModal } from "@/features/generation/components/GenerateNarrationModal";
import type { ApiChapterWorkspace, ApiChapterLanguageStatus, JobStatus, ProjectId } from "@/types/api";

interface ChapterOverviewTabProps {
  projectId: ProjectId;
  workspace: ApiChapterWorkspace;
  analysisJobStatus: JobStatus | null;
  analysisJobProgress: number | null;
  analysisMessage: string | null;
  analyzeDisabled: boolean;
  analysisActive: boolean;
  onAnalyze: () => void;
  onAnalyzeOriginal: () => void;
  onConfirmTranslation: () => void;
  confirmingTranslation: boolean;
  languageStatus: ApiChapterLanguageStatus | null;
  translationPromptOpen: boolean;
  onCloseTranslationPrompt: () => void;
  onEdit: () => void;
  onOpenStoryboard: () => void;
}

export function ChapterOverviewTab({
  projectId,
  workspace,
  analysisJobStatus,
  analysisJobProgress,
  analysisMessage,
  analyzeDisabled,
  analysisActive,
  onAnalyze,
  onAnalyzeOriginal,
  onConfirmTranslation,
  confirmingTranslation,
  languageStatus,
  translationPromptOpen,
  onCloseTranslationPrompt,
  onEdit,
  onOpenStoryboard,
}: Readonly<ChapterOverviewTabProps>) {
  const [isNarrationOpen, setIsNarrationOpen] = useState(false);

  return (
    <>
      <ChapterLanguageCard
        languageStatus={languageStatus}
        translationPromptOpen={translationPromptOpen}
        confirmingTranslation={confirmingTranslation}
        onCloseTranslationPrompt={onCloseTranslationPrompt}
        onAnalyzeOriginal={onAnalyzeOriginal}
        onConfirmTranslation={onConfirmTranslation}
      />
      <div className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)]">
        <ChapterPipelineSummary
          workspace={workspace}
          analysisJobStatus={analysisJobStatus}
          analysisJobProgress={analysisJobProgress}
          analysisMessage={analysisMessage}
          analyzeDisabled={analyzeDisabled}
          analysisActive={analysisActive}
          onAnalyze={onAnalyze}
          onOpenStoryboard={onOpenStoryboard}
          onOpenNarration={() => setIsNarrationOpen(true)}
        />
        <div className="min-w-0 space-y-4">
          <ChapterAnalysisCard workspace={workspace} onEdit={onEdit} />
          <section className="rounded-2xl border border-border bg-surface-card/90 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-100">Scenes ({workspace.summary.sceneCount})</h2>
              {workspace.summary.sceneCount > 0 && <button type="button" onClick={onOpenStoryboard} className="text-xs font-medium text-orange-300 transition-colors hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">Xem tất cả</button>}
            </div>
            <ChapterSceneGrid scenes={workspace.previewScenes} />
          </section>
        </div>
      </div>
      <GenerateNarrationModal
        isOpen={isNarrationOpen}
        onClose={() => setIsNarrationOpen(false)}
        projectId={projectId}
        chapterId={workspace.chapter.id}
        chapterTitle={workspace.chapter.title}
      />
    </>
  );
}
