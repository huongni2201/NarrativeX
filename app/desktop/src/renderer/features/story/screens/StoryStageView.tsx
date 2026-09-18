import { Clapperboard, Film, Sparkles } from "lucide-react";
import type { DesktopChapterStory, DesktopStoryBeat } from "@narrativex/client-contracts";
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
        <span className="text-[14px] font-medium text-foreground">Đang tải cấu trúc Story & Beats...</span>
      </div>
    );
  }

  if (!story || story.scenes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-text-muted">
        <Clapperboard size={48} className="mb-3 text-text-dim" />
        <h3 className="text-[16px] font-semibold text-foreground">Chưa có kịch bản phân cảnh (StoryBeats)</h3>
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-text-secondary">
          Chương này chưa được phân tích cấu trúc kịch bản. Hãy chuyển sang giai đoạn <strong>Source</strong> và bấm <strong>Analyze Chapter</strong> để Gemini Story Director kiến tạo phân cảnh và StoryBeats.
        </p>
        {onNavigateToSource && (
          <button
            type="button"
            onClick={onNavigateToSource}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-all hover:bg-primary-hover shadow-md"
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
        <div key={scene.id} className="space-y-3">
          {/* Scene Header */}
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <div className="flex items-center gap-2.5">
              <Film size={16} className="text-primary" />
              <span className="font-mono text-[12px] font-bold text-text-muted">
                SCENE {scene.orderIndex + 1}
              </span>
              <span className="text-[15px] font-semibold text-foreground">
                {scene.title}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              {scene.mood && (
                <span className="rounded bg-surface-2 px-2 py-0.5 font-medium text-text-secondary">
                  {scene.mood}
                </span>
              )}
              <span>{scene.storyBeats.length} Beats</span>
            </div>
          </div>

          {/* Scene Summary if present */}
          {scene.summary && (
            <p className="text-[12px] text-text-muted italic px-1">
              {scene.summary}
            </p>
          )}

          {/* StoryBeat Cards Grid/List */}
          <div className="grid grid-cols-1 gap-2.5">
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
