import { Clapperboard, Film, Sparkles } from "lucide-react";
import type { DesktopChapterStory, DesktopStoryBeat } from "../../../../shared/api-types";
import { StoryBeatCard } from "../components/StoryBeatCard";

export interface StoryStageViewProps {
  story: DesktopChapterStory | null;
  isLoading: boolean;
  selectedBeatId: string | null;
  onSelectBeat: (beat: DesktopStoryBeat) => void;
  onNavigateToSource?: () => void;
}

export function StoryStageView({
  story,
  isLoading,
  selectedBeatId,
  onSelectBeat,
  onNavigateToSource,
}: StoryStageViewProps) {
  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-text-muted">
        <Sparkles size={36} className="animate-spin text-primary mb-3" />
        <span className="text-[15px] font-medium text-foreground">Đang tải cấu trúc Story & Beats...</span>
      </div>
    );
  }

  if (!story || story.scenes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-text-muted">
        <Clapperboard size={48} className="mb-3 text-text-dim" />
        <h3 className="text-[15px] font-semibold text-foreground">Chưa có kịch bản phân cảnh (StoryBeats)</h3>
        <p className="mt-1.5 max-w-md text-body leading-relaxed text-text-secondary">
          Chương này chưa được phân tích cấu trúc kịch bản. Hãy chuyển sang giai đoạn <strong>Source</strong> và bấm <strong>Analyze Chapter</strong> để Gemini Story Director kiến tạo phân cảnh và StoryBeats.
        </p>
        {onNavigateToSource && (
          <button
            type="button"
            onClick={onNavigateToSource}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-body font-medium text-primary-foreground transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:bg-primary-hover shadow-md"
          >
            Chuyển sang Source để Analyze
          </button>
        )}
      </div>
    );
  }

  const totalBeats = story.scenes.reduce((acc, s) => acc + s.storyBeats.length, 0);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-4 space-y-6">
      {/* Scenes Container */}
      {story.scenes.map((scene) => (
        <div key={scene.id} className="nx-story-scene space-y-3">
          {/* Scene Header */}
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <div className="flex items-center gap-2.5">
              <Film size={16} className="text-primary" />
              <span className="font-mono text-label font-bold text-text-muted">
                SCENE {scene.orderIndex + 1}
              </span>
              <span className="text-[16px] font-semibold text-foreground">
                {scene.title}
              </span>
            </div>

            <div className="flex items-center gap-2 text-caption text-text-muted">
              <span>{scene.storyBeats.length} Beats</span>
            </div>
          </div>

          {/* StoryBeat Cards Grid/List */}
          <div className="nx-story-beat-grid">
            {scene.storyBeats.map((beat) => (
              <StoryBeatCard
                key={beat.id}
                beat={beat}
                selected={selectedBeatId === beat.id}
                onSelect={() => onSelectBeat(beat)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
