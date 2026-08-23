"use client";

import { AlertTriangle } from "lucide-react";
import { LoadingState } from "@/components/ui/LoadingState";
import { StoryboardScreen } from "@/features/storyboard/StoryboardScreen";
import { apiErrorMessage } from "@/shared/api/client";
import { useChapterWorkspaceState } from "../hooks/useChapterWorkspaceState";
import { ChapterBreadcrumb } from "./ChapterBreadcrumb";
import { ChapterContentEditor } from "./ChapterContentEditor";
import { ChapterHero } from "./ChapterHero";
import { ChapterOverviewTab } from "./ChapterOverviewTab";
import { ChapterWorkspaceTabs } from "./ChapterWorkspaceTabs";
import { ChapterVisualsTab } from "./ChapterVisualsTab";
import { ChapterRenderTab } from "./ChapterRenderTab";
import { ChapterAudioTab } from "./ChapterAudioTab";

interface ChapterEditorProps {
  projectId: string;
  chapterId: string;
}

export function ChapterEditor({ projectId, chapterId }: Readonly<ChapterEditorProps>) {
  const {
    numericProjectId,
    validIds,
    workspaceQuery,
    activeTab,
    setActiveTab,
    editing,
    title,
    setTitle,
    sourceText,
    setSourceText,
    dirty,
    markDirty,
    saveMessage,
    saving,
    saveChapter,
    analyzeChapter,
    analyzeOriginal,
    confirmTranslation,
    confirmingTranslation,
    languageStatus,
    translationPromptOpen,
    closeTranslationPrompt,
    analysisJob,
    analysisActive,
    analysisMessage,
    startEditing,
    cancelEditing,
    reloadWorkspace,
  } = useChapterWorkspaceState(projectId, chapterId);

  if (!validIds) return <WorkspaceMessage>Chapter route không hợp lệ.</WorkspaceMessage>;
  if (workspaceQuery.isPending)
    return (
      <LoadingState
        message="Đang tải Chapter Workspace từ backend…"
        className="rounded-xl border border-border bg-surface-panel p-8"
      />
    );
  if (workspaceQuery.isError) {
    return (
      <WorkspaceMessage>
        {apiErrorMessage(workspaceQuery.error, "Không tải được Chapter Workspace từ backend.")}
      </WorkspaceMessage>
    );
  }

  const workspace = workspaceQuery.data;
  const chapterNumber = String(workspace.chapter.orderIndex + 1).padStart(2, "0");
  const analyzeDisabled =
    dirty ||
    !sourceText.trim() ||
    saving ||
    analysisActive ||
    !workspace.capabilities.canAnalyze;

  return (
    <div className="space-y-4">
      <ChapterBreadcrumb workspace={workspace} chapterNumber={chapterNumber} />

      <ChapterHero
        workspace={workspace}
        chapterNumber={chapterNumber}
        analysisActive={analysisActive}
        onEdit={startEditing}
      />

      <ChapterWorkspaceTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        availableTabs={{
          visuals: workspace.capabilities.canGenerateVisuals,
          audio: Boolean(workspace.chapter.sourceText.trim()),
          render: workspace.capabilities.canRender,
        }}
      />

      {workspace.pipeline.sourceOutdated && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              Nội dung Chapter đã thay đổi kể từ lần tạo storyboard gần nhất.
            </p>
            <p className="mt-0.5 text-xs text-amber-200/80">
              Hãy phân tích lại để cập nhật storyboard. Storyboard hiện tại vẫn được giữ cho đến khi phiên bản mới hoàn tất.
            </p>
          </div>
        </div>
      )}

      {activeTab === "content" ? (
        <ChapterContentEditor
          editing={editing}
          title={title}
          sourceText={sourceText}
          dirty={dirty}
          saving={saving}
          saveMessage={saveMessage}
          onTitleChange={(value) => {
            setTitle(value);
            markDirty();
          }}
          onSourceChange={(value) => {
            setSourceText(value);
            markDirty();
          }}
          onStartEditing={startEditing}
          onCancel={() =>
            cancelEditing(
              workspace.chapter.title,
              workspace.chapter.sourceText,
              workspace.chapter.rowVersion,
            )
          }
          onSave={saveChapter}
          onReload={reloadWorkspace}
        />
      ) : activeTab === "storyboard" ? (
        <div className="space-y-4">
          <StoryboardScreen
            projectId={numericProjectId}
            chapters={[
              {
                id: workspace.chapter.id,
                orderIndex: workspace.chapter.orderIndex,
                title: workspace.chapter.title,
              },
            ]}
            initialChapterId={workspace.chapter.id}
            hideChapterSelector
          />
        </div>
      ) : activeTab === "visuals" ? (
        <ChapterVisualsTab projectId={numericProjectId} chapterId={workspace.chapter.id} visualBeatCount={workspace.summary.visualBeatCount} />
      ) : activeTab === "render" ? (
        <ChapterRenderTab projectId={numericProjectId} chapterId={workspace.chapter.id} />
      ) : activeTab === "audio" ? (
        <ChapterAudioTab workspace={workspace} />
      ) : (
        <ChapterOverviewTab
          projectId={numericProjectId}
          workspace={workspace}
          analysisJobStatus={analysisJob?.status ?? null}
          analysisJobProgress={analysisJob?.progress ?? null}
          analysisMessage={analysisMessage}
          analyzeDisabled={analyzeDisabled}
          analysisActive={analysisActive}
          onAnalyze={analyzeChapter}
          onAnalyzeOriginal={analyzeOriginal}
          onConfirmTranslation={confirmTranslation}
          confirmingTranslation={confirmingTranslation}
          languageStatus={languageStatus}
          translationPromptOpen={translationPromptOpen}
          onCloseTranslationPrompt={closeTranslationPrompt}
          onEdit={startEditing}
          onOpenStoryboard={() => setActiveTab("storyboard")}
        />
      )}
    </div>
  );
}

function WorkspaceMessage({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="rounded-xl border border-border bg-surface-panel p-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}
