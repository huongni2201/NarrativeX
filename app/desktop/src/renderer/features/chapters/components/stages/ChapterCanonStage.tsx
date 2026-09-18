import { Users, MapPin, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import type { DesktopChapterDetails, DesktopChapterStory } from "@narrativex/client-contracts";

export interface ChapterCanonStageProps {
  chapter: DesktopChapterDetails | null;
  story: DesktopChapterStory | null;
  onProceedToStory: () => void;
}

export function ChapterCanonStage({
  chapter,
  story,
  onProceedToStory,
}: ChapterCanonStageProps) {
  if (!chapter) {
    return null;
  }

  const hasScenes = story && story.scenes.length > 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Canon Stage Action Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-dark px-4">
        <div className="flex items-center gap-2 text-[13px] text-text-secondary">
          <span>Xem xét các thực thể cốt truyện & tính liên tục được phát hiện</span>
        </div>

        <button
          type="button"
          onClick={onProceedToStory}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover transition-all"
        >
          <span>Tiếp tục sang Story Stage</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Canon Content Canvas */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full">
        {!hasScenes ? (
          <div className="flex h-64 flex-col items-center justify-center text-center text-text-muted">
            <Users size={40} className="mb-2 text-text-dim" />
            <h4 className="text-[15px] font-semibold text-foreground">Chưa có thông tin Canon cho chương này</h4>
            <p className="mt-1 text-[13px] text-text-secondary">
              Hãy bấm Analyze Chapter tại mục Source để phân tích nhân vật và bối cảnh xuất hiện trong chương.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Characters in Chapter */}
            <div className="rounded-lg border border-border-subtle bg-surface p-4 space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-[14px]">
                <Users size={16} className="text-primary" />
                <span>Nhân vật xuất hiện ({story.scenes.length} phân cảnh)</span>
              </div>
              <p className="text-[12px] text-text-muted">
                Các nhân vật được nhận diện tự động từ văn bản chương và liên kết với Project Character Canon.
              </p>
              <div className="space-y-1.5 pt-2">
                {story.scenes.map((sc) => (
                  <div
                    key={sc.id}
                    className="flex items-center justify-between rounded bg-surface-dark p-2.5 text-[12px]"
                  >
                    <span className="font-medium text-foreground">{sc.title}</span>
                    <span className="text-text-muted">{sc.storyBeats.length} StoryBeats</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Locations and Continuity */}
            <div className="rounded-lg border border-border-subtle bg-surface p-4 space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-[14px]">
                <MapPin size={16} className="text-info" />
                <span>Địa điểm & Bối cảnh phân cảnh</span>
              </div>
              <p className="text-[12px] text-text-muted">
                Địa điểm diễn ra các cảnh quay được đảm bảo tính nhất quán liên tục.
              </p>
              <div className="space-y-1.5 pt-2">
                {story.scenes.map((sc) => (
                  <div
                    key={sc.id}
                    className="flex items-center justify-between rounded bg-surface-dark p-2.5 text-[12px]"
                  >
                    <span className="text-text-secondary">{sc.locationText || "Không gian diễn biến cốt truyện"}</span>
                    <span className="text-success font-mono text-[11px]">Đã đối chiếu</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
