import { useState, useEffect } from "react";
import {
  FileText,
  Compass,
  Clapperboard,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";
import type {
  DesktopChapterDetails,
  DesktopStoryBeat,
  DesktopTimeline,
} from "@narrativex/client-contracts";
import { useChapterStoryQuery } from "../../story/queries/story.queries";
import { useCreateChapter, useUpdateChapter } from "../queries/chapters.queries";
import { useAnalyzeChapter } from "../../generation/queries/generation.queries";
import { ChapterRail } from "../components/ChapterRail";
import { ChapterSourceStage } from "../components/stages/ChapterSourceStage";
import { ChapterCanonStage } from "../components/stages/ChapterCanonStage";
import { ChapterProductionStage } from "../components/stages/ChapterProductionStage";
import { StoryStageView } from "../../story/screens/StoryStageView";
import { StoryBeatInspector } from "../../story/components/StoryBeatInspector";

export type ChapterStage = "source" | "canon" | "story" | "production";

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
  const [currentStage, setCurrentStage] = useState<ChapterStage>(initialStage);
  const [selectedBeat, setSelectedBeat] = useState<DesktopStoryBeat | null>(null);

  const createChapter = useCreateChapter(projectId);
  const updateChapter = useUpdateChapter(projectId);
  const analyzeChapter = useAnalyzeChapter();

  // Load authoritative Chapter Story
  const { data: story, isLoading: storyLoading, refetch: refetchStory } = useChapterStoryQuery(
    projectId,
    selectedChapterId
  );

  const activeChapter = chapters.find((c) => c.id === selectedChapterId) ?? null;

  // Auto-select first beat if available and none selected
  useEffect(() => {
    if (story && story.scenes.length > 0) {
      const firstBeat = story.scenes[0].storyBeats[0];
      if (firstBeat && !selectedBeat) {
        setSelectedBeat(firstBeat);
      }
    }
  }, [story, selectedBeat]);

  const handleSelectBeat = (beat: DesktopStoryBeat) => {
    setSelectedBeat(beat);
    if (currentStage !== "story" && currentStage !== "production") {
      setCurrentStage("story");
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
    if (!activeChapter) return;
    await analyzeChapter.mutateAsync({
      projectId,
      chapterId: activeChapter.id,
      request: {
        visualGenerationMode: "IMAGE",
        imageProvider: "API",
      },
      idempotencyKey: `analyze-${activeChapter.id}-${Date.now()}`,
    });
    // Switch to Canon stage to view results
    setCurrentStage("canon");
    void refetchStory();
  };

  const handleCreateNewChapter = async () => {
    const nextOrder = chapters.length;
    const res = await createChapter.mutateAsync({
      title: `Chương ${nextOrder + 1}`,
      sourceText: "",
    });
    setSelectedChapterId(res.id);
    setCurrentStage("source");
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
          setSelectedBeat(null);
        }}
        onSelectBeat={(beatId) => {
          const beat = story?.scenes.flatMap((s) => s.storyBeats).find((b) => b.id === beatId);
          if (beat) handleSelectBeat(beat);
        }}
        onCreateChapter={handleCreateNewChapter}
      />

      {/* PANE 2 (CENTER): Main Stage Workspace */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Stage Header Navigation */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-dark px-4">
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-lg text-[13px]">
            <button
              type="button"
              onClick={() => setCurrentStage("source")}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1 font-medium transition-all ${
                currentStage === "source"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              <FileText size={14} />
              <span>Source (Văn bản)</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStage("canon")}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1 font-medium transition-all ${
                currentStage === "canon"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              <Compass size={14} />
              <span>Canon (Bối cảnh)</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStage("story")}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1 font-medium transition-all ${
                currentStage === "story"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              <Clapperboard size={14} />
              <span>Story (StoryBeats)</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStage("production")}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1 font-medium transition-all ${
                currentStage === "production"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              <Sparkles size={14} />
              <span>Production (Sản xuất)</span>
            </button>
          </div>

          <div className="text-[12px] font-mono text-text-muted">
            {activeChapter?.title || "Chưa chọn chương"}
          </div>
        </div>

        {/* Stage Content Canvas */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {currentStage === "source" && (
            <ChapterSourceStage
              chapter={activeChapter}
              onSave={handleSaveSource}
              onAnalyze={handleAnalyze}
              isAnalyzing={analyzeChapter.isPending}
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
              chapter={activeChapter}
              story={story ?? null}
              onGenerateMissing={() => {
                // Trigger missing generations
                void refetchStory();
              }}
              isGenerating={false}
            />
          )}
        </div>
      </div>

      {/* PANE 3 (RIGHT): Contextual Inspector */}
      <div className="w-[340px] shrink-0 overflow-hidden">
        {selectedBeat ? (
          <StoryBeatInspector
            beat={selectedBeat}
            onUpdateReviewStatus={(newStatus) => {
              setSelectedBeat({ ...selectedBeat, reviewStatus: newStatus });
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted border-l border-border-subtle bg-surface-dark">
            <Layers size={36} className="mb-2 text-text-dim" />
            <h4 className="text-[14px] font-semibold text-foreground">Inspector</h4>
            <p className="mt-1 text-[12px] text-text-secondary">
              Chọn một StoryBeat để chỉnh sửa chi tiết kịch bản, lời thoại, góc nhìn thị giác và tham số kỹ thuật.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
