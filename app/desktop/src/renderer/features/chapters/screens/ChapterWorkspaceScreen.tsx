import { useState, useMemo, useEffect } from "react";
import {
  Clapperboard,
  Compass,
  FileText,
  Layers,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type {
  DesktopChapterDetails,
  DesktopStoryBeat,
  DesktopTimeline,
  StoryBeatReviewStatus,
} from "../../../../shared/api-types";
import { useChapterStoryQuery, useUpdateStoryBeatReviewStatus } from "../../story/queries/story.queries";
import {
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
  useChapterWorkspacesQuery,
} from "../queries/chapters.queries";
import { useChapterAnalysis } from "../queries/chapter-analysis.queries";
import {
  useCreateMediaJob,
  useCurrentMediaJob,
  useGenerationJob,
} from "../../generation/queries/generation.queries";
import { isActiveGenerationJobStatus } from "../../generation/generation-status";
import { useChapterProductionStatus } from "../../production/queries/video-production.queries";
import { canCreateInitialChapter, isAnalysisProcessingStatus } from "../model/chapter-ui";
import { AnalysisProgress } from "../components/AnalysisProgress";
import { ChapterRail } from "../components/ChapterRail";
import { DeleteChapterDialog } from "../components/DeleteChapterDialog";
import { ChapterSourceStage } from "../components/stages/ChapterSourceStage";
import { ChapterCanonStage } from "../components/stages/ChapterCanonStage";
import { ChapterProductionStage } from "../components/stages/ChapterProductionStage";
import { StoryStageView } from "../../story/screens/StoryStageView";
import { StoryBeatInspector } from "../../story/components/StoryBeatInspector";

export type ChapterStage = "source" | "canon" | "story" | "production";

const stageTabs: ReadonlyArray<{
  id: ChapterStage;
  label: string;
  icon: LucideIcon;
  requiresChapter: boolean;
}> = [
  { id: "source", label: "Nội dung gốc", icon: FileText, requiresChapter: false },
  { id: "canon", label: "Hồ sơ", icon: Compass, requiresChapter: true },
  { id: "story", label: "Kịch bản", icon: Clapperboard, requiresChapter: true },
  { id: "production", label: "Sản xuất", icon: Sparkles, requiresChapter: true },
];

export interface ChapterWorkspaceScreenProps {
  projectId: string;
  projectName: string;
  chapters: DesktopChapterDetails[];
  timeline: DesktopTimeline | null;
  initialStage?: ChapterStage;
}

export function ChapterWorkspaceScreen({
  projectId,
  projectName,
  chapters,
  timeline,
  initialStage = "source",
}: ChapterWorkspaceScreenProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    chapters[0]?.id ?? null
  );

  useEffect(() => {
    if (chapters.length > 0) {
      if (!selectedChapterId || !chapters.some((c) => c.id === selectedChapterId)) {
        setSelectedChapterId(chapters[0].id);
      }
    } else if (selectedChapterId) {
      setSelectedChapterId(null);
    }
  }, [chapters, selectedChapterId]);
  const [currentStage, setCurrentStage] = useState<ChapterStage>(initialStage);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);

  useEffect(() => {
    if (initialStage) {
      setCurrentStage(initialStage);
    }
  }, [initialStage]);

  const createChapter = useCreateChapter(projectId);
  const updateChapter = useUpdateChapter(projectId);
  const deleteChapter = useDeleteChapter(projectId);
  const [chapterPendingDelete, setChapterPendingDelete] = useState<DesktopChapterDetails | null>(null);
  const chapterWorkspaces = useChapterWorkspacesQuery(projectId, chapters, selectedChapterId);
  const serverAnalysis = chapterWorkspaces.find(item => item.data?.chapter.id === selectedChapterId)?.data?.pipeline.analysis;
  const analysis = useChapterAnalysis(projectId, selectedChapterId,
    serverAnalysis && isAnalysisProcessingStatus(serverAnalysis.status) ? serverAnalysis.latestJobId : null);
  const analysisHasError = Boolean(analysis.error || analysis.job?.status === "FAILED");
  const createMediaJob = useCreateMediaJob();
  const updateBeatStatus = useUpdateStoryBeatReviewStatus(projectId, selectedChapterId ?? "");

  // Authoritative media job and generation status
  const currentMediaJob = useCurrentMediaJob(projectId, selectedChapterId);
  const activeJobId =
    createMediaJob.data?.jobId ??
    currentMediaJob.data?.jobId ??
    null;
  const generationJob = useGenerationJob(activeJobId);
  const productionStatus = useChapterProductionStatus(projectId, selectedChapterId);

  const isGenerating =
    createMediaJob.isPending ||
    (generationJob.data ? isActiveGenerationJobStatus(generationJob.data.status) : false);

  // Load authoritative Chapter Story
  const { data: story, isLoading: storyLoading, refetch: refetchStory } = useChapterStoryQuery(
    projectId,
    selectedChapterId
  );

  const activeChapter = chapters.find((c) => c.id === selectedChapterId) ?? null;

  useEffect(() => {
    if (analysis.job?.status === "COMPLETED") void refetchStory();
  }, [analysis.job?.status, refetchStory]);

  // Derive selected beat from server query state as single source of truth
  const selectedBeat = useMemo(() => {
    if (!story || !story.scenes) return null;
    const allBeats = story.scenes.flatMap((s) => s.storyBeats);
    if (allBeats.length === 0) return null;
    if (!selectedBeatId) return allBeats[0];
    return allBeats.find((b) => b.id === selectedBeatId) ?? allBeats[0];
  }, [story, selectedBeatId]);

  const handleSelectBeat = (beat: DesktopStoryBeat) => {
    setSelectedBeatId(beat.id);
    if (currentStage !== "story" && currentStage !== "production") {
      setCurrentStage("story");
    }
  };

  const handleUpdateReviewStatus = async (newStatus: StoryBeatReviewStatus) => {
    if (!selectedBeat || !selectedChapterId) return;
    if (selectedBeat.persistenceState === "SYNTHETIC") return;
    try {
      await updateBeatStatus.mutateAsync({
        storyBeatId: selectedBeat.id,
        status: newStatus,
        rowVersion: selectedBeat.rowVersion,
      });
    } catch {
      void refetchStory();
    }
  };

  const handleSaveSource = async (title: string, sourceText: string) => {
    if (!activeChapter) return;
    await updateChapter.mutateAsync({
      chapterId: activeChapter.id,
      title,
      sourceText,
      rowVersion: activeChapter.rowVersion,
    });
  };

  const handleAnalyze = async () => {
    if (!activeChapter || !analysis.canAnalyze) return;
    try {
      await analysis.analyze({ visualGenerationMode: "VIDEO" });
    } catch {
      return; // The mutation error is rendered below; preserve its idempotency key.
    }
    // Switch to Canon stage to view results
    setCurrentStage("canon");
    void refetchStory();
  };

  const handleGenerateVideoShots = async () => {
    if (!activeChapter) return;
    const idempotencyKey = `media-${activeChapter.id}-${crypto.randomUUID()}`;
    await createMediaJob.mutateAsync({
      projectId,
      chapterId: activeChapter.id,
      request: {
        productionMode: "VIDEO_FIRST",
        visualGenerationMode: "VIDEO",
      },
      idempotencyKey,
    });
  };

  const handleCreateNewChapter = async (title?: unknown, sourceText?: unknown) => {
    // Rail buttons can call this with no arguments; only accept real strings.
    const titleText = typeof title === "string" ? title.trim() : "";
    const bodyText = typeof sourceText === "string" ? sourceText : "";
    if (createChapter.isPending) return;

    const nextOrder = chapters.length;
    if (nextOrder === 0 && !canCreateInitialChapter(titleText, bodyText)) {
      setCurrentStage("source");
      // No chapter yet: move focus to the empty form's title field.
      setTimeout(() => document.getElementById("initial-chapter-title")?.focus(), 0);
      return;
    }
    const res = await createChapter.mutateAsync({
      title: titleText || `Chương ${nextOrder + 1}`,
      sourceText: bodyText,
    });
    setSelectedChapterId(res.id);
    setCurrentStage("source");
  };

  const handleRequestDeleteChapter = (chapterId: string) => {
    deleteChapter.reset();
    setChapterPendingDelete(chapters.find((c) => c.id === chapterId) ?? null);
  };

  const handleCloseDeleteChapter = () => {
    if (deleteChapter.isPending) return;
    deleteChapter.reset();
    setChapterPendingDelete(null);
  };

  const handleConfirmDeleteChapter = async () => {
    const target = chapterPendingDelete;
    if (!target || deleteChapter.isPending) return;
    const index = chapters.findIndex((c) => c.id === target.id);
    try {
      await deleteChapter.mutateAsync(target.id);
    } catch {
      return; // The error is rendered inside the dialog so the user can retry or cancel.
    }
    if (selectedChapterId === target.id) {
      const next = chapters[index + 1] ?? chapters[index - 1] ?? null;
      setSelectedChapterId(next?.id ?? null);
      setSelectedBeatId(null);
      if (!next) setCurrentStage("source");
    }
    setChapterPendingDelete(null);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* PANE 1 (LEFT): Chapter & StoryBeat Navigation Rail */}
      <ChapterRail
        chapters={chapters}
        selectedChapterId={selectedChapterId}
        story={story ?? null}
        selectedBeatId={selectedBeat?.id ?? null}
        onSelectChapter={(id) => {
          setSelectedChapterId(id);
          setSelectedBeatId(null);
        }}
        onSelectBeat={(beatId) => {
          const beat = story?.scenes.flatMap((s) => s.storyBeats).find((b) => b.id === beatId);
          if (beat) handleSelectBeat(beat);
        }}
        onCreateChapter={handleCreateNewChapter}
        onDeleteChapter={handleRequestDeleteChapter}
      />

      <DeleteChapterDialog
        chapter={chapterPendingDelete}
        isPending={deleteChapter.isPending}
        error={deleteChapter.error}
        onClose={handleCloseDeleteChapter}
        onConfirm={() => void handleConfirmDeleteChapter()}
      />

      {/* PANE 2 (CENTER): Main Stage Workspace */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Stage Header Navigation */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-dark px-4">
          <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1 text-body">
            {stageTabs.map(({ id, label, icon: Icon, requiresChapter }) => {
              const isActive = currentStage === id;
              const isLocked = requiresChapter && !activeChapter;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCurrentStage(id)}
                  disabled={isLocked}
                  aria-pressed={isActive}
                  title={isLocked ? "Tạo chương trước để mở bước này" : undefined}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-[color,background-color,border-color,box-shadow,transform,opacity] disabled:cursor-not-allowed disabled:opacity-40 ${
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-text-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-label text-text-muted">
              {activeChapter ? activeChapter.title || `Chương ${activeChapter.orderIndex + 1}` : "Chưa chọn chương"}
            </span>
          </div>
        </div>

        {(analysis.message || analysis.error) && <div role={analysisHasError ? "alert" : "status"}
          className={`border-b border-border-subtle bg-surface-panel px-4 py-3 text-label ${analysisHasError ? "text-danger" : "text-text-secondary"}`}>
          <p>{analysis.error instanceof Error ? analysis.error.message : analysis.message}</p>
          {analysis.isAnalyzing && analysis.job?.status === "RUNNING" && !analysisHasError &&
            <AnalysisProgress percent={analysis.job.progress} />}
        </div>}
        {/* Stage Content Canvas */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {currentStage === "source" && (
            <ChapterSourceStage
              chapter={activeChapter}
              onSave={handleSaveSource}
              onAnalyze={handleAnalyze}
              onCreateChapter={handleCreateNewChapter}
              defaultChapterTitle={`Chương ${chapters.length + 1}`}
              isCreating={createChapter.isPending}
              isAnalyzing={analysis.isAnalyzing}
              canAnalyze={analysis.canAnalyze}
            />
          )}

          {currentStage === "canon" && (
            <ChapterCanonStage
              chapter={activeChapter}
              story={story ?? null}
              onProceedToStory={() => setCurrentStage("story")}
            />
          )}

          {currentStage === "story" && (
            <StoryStageView
              story={story ?? null}
              isLoading={storyLoading}
              selectedBeatId={selectedBeat?.id ?? null}
              onSelectBeat={handleSelectBeat}
              onNavigateToSource={() => setCurrentStage("source")}
            />
          )}

          {currentStage === "production" && (
            <ChapterProductionStage
              projectId={projectId}
              chapter={activeChapter}
              story={story ?? null}
              timeline={timeline}
              productionStatus={productionStatus.data ?? null}
              activeGenerationJob={generationJob.data ?? null}
              onGenerateVideoShots={handleGenerateVideoShots}
              isGenerating={isGenerating}
            />
          )}
        </div>
      </div>

      {/* PANE 3 (RIGHT): Contextual Inspector, hidden until a chapter exists so an empty pane does not take width */}
      {(activeChapter || selectedBeat) && (
        <div className="w-[340px] shrink-0 overflow-hidden">
          {selectedBeat ? (
            <StoryBeatInspector
              beat={selectedBeat}
              onUpdateReviewStatus={handleUpdateReviewStatus}
              isUpdatingStatus={updateBeatStatus.isPending}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted border-l border-border-subtle bg-surface-dark/50">
              <div className="flex size-12 items-center justify-center rounded-xl bg-surface-panel border border-border-subtle mb-3 text-text-dim shadow-sm">
                <Layers size={22} />
              </div>
              <h4 className="text-body font-semibold text-foreground">Thuộc tính</h4>
              <p className="mt-1.5 max-w-[260px] text-label leading-relaxed text-text-secondary">
                Chọn một nhịp truyện để chỉnh kịch bản, lời thoại, góc máy và thông số kỹ thuật.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
