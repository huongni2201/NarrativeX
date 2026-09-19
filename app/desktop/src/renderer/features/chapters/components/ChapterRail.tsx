import { useState } from "react";
import { Plus, Search, BookOpen, ChevronRight, ChevronDown, Film, Disc } from "lucide-react";
import type { DesktopChapterDetails, DesktopChapterStory } from "@narrativex/client-contracts";
import { Button } from "@/components/ui/button";

export interface ChapterRailProps {
  chapters: DesktopChapterDetails[];
  selectedChapterId: string | null;
  story: DesktopChapterStory | null;
  selectedBeatId: string | null;
  onSelectChapter: (chapterId: string) => void;
  onSelectBeat?: (beatId: string) => void;
  onCreateChapter: () => void;
}

export function ChapterRail({
  chapters,
  selectedChapterId,
  story,
  selectedBeatId,
  onSelectChapter,
  onSelectBeat,
  onCreateChapter,
}: ChapterRailProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({});

  const filteredChapters = chapters.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleScene = (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedScenes((prev) => ({ ...prev, [sceneId]: !prev[sceneId] }));
  };

  return (
    <div className="flex h-full w-[260px] shrink-0 flex-col border-r border-border-subtle bg-surface-dark select-none">
      {/* Rail Header with Title and Add Button */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface-panel/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-primary" />
          <span className="text-[13px] font-semibold text-foreground">Chapters</span>
          <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-text-dim">
            {chapters.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onCreateChapter}
          className="flex size-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95"
          title="Tạo chapter mới"
          aria-label="Tạo chapter mới"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Search Input */}
      <div className="border-b border-border-subtle p-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Tìm chương..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border-subtle bg-surface-input pl-8 pr-2.5 py-1 text-[12px] text-foreground placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Chapters & Hierarchy List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-1 text-[13px]">
        {filteredChapters.length === 0 && (
          <div className="flex min-h-36 flex-col items-center justify-center p-4 text-center text-text-muted">
            <BookOpen size={24} className="mb-2 text-text-dim opacity-40" />
            <p className="text-[12px] font-medium text-text-secondary">Chưa có chapter</p>
            <p className="mt-0.5 text-[11px] text-text-dim">Tạo chapter từ vùng làm việc bên phải</p>
          </div>
        )}
        {filteredChapters.map((chapter) => {
          const isChapterSelected = selectedChapterId === chapter.id;

          return (
            <div key={chapter.id} className="space-y-0.5">
              {/* Chapter Item Button */}
              <button
                type="button"
                onClick={() => onSelectChapter(chapter.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-all ${
                  isChapterSelected
                    ? "bg-surface-3 text-primary font-semibold shadow-sm"
                    : "text-text-secondary hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <BookOpen size={14} className={isChapterSelected ? "text-primary" : "text-text-muted"} />
                <span className="font-mono text-[11px] text-text-muted">#{chapter.orderIndex + 1}</span>
                <span className="truncate flex-1 text-[13px]">{chapter.title || `Chương ${chapter.orderIndex + 1}`}</span>
              </button>

              {/* Sub-tree: Scenes & StoryBeats (Only when this chapter is selected and has story) */}
              {isChapterSelected && story && story.scenes.length > 0 && (
                <div className="ml-3 pl-2 border-l border-border-subtle/80 space-y-0.5 py-1">
                  {story.scenes.map((scene) => {
                    const isExpanded = expandedScenes[scene.id] ?? true;

                    return (
                      <div key={scene.id} className="space-y-0.5">
                        <div
                          onClick={(e) => toggleScene(scene.id, e)}
                          className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer"
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <Film size={12} className="text-text-dim" />
                          <span className="truncate flex-1 font-medium">{scene.title}</span>
                          <span className="text-[10px] text-text-dim">{scene.storyBeats.length}</span>
                        </div>

                        {isExpanded && (
                          <div className="ml-3 pl-2 border-l border-border-subtle/60 space-y-0.5">
                            {scene.storyBeats.map((beat) => {
                              const isBeatSelected = selectedBeatId === beat.id;
                              return (
                                <button
                                  key={beat.id}
                                  type="button"
                                  onClick={() => onSelectBeat?.(beat.id)}
                                  className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[12px] transition-all ${
                                    isBeatSelected
                                      ? "bg-primary-muted text-primary font-medium"
                                      : "text-text-muted hover:bg-surface-2 hover:text-text-secondary"
                                  }`}
                                >
                                  <Disc size={10} className={isBeatSelected ? "text-primary" : "text-text-dim"} />
                                  <span className="truncate flex-1">
                                    Beat #{beat.orderIndex + 1}: {beat.title || beat.purpose}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filteredChapters.length > 0 && (
          <button
            type="button"
            onClick={onCreateChapter}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-subtle py-2 text-[12px] font-medium text-text-muted transition-all hover:border-primary hover:bg-surface-2 hover:text-primary"
          >
            <Plus size={14} /> Thêm chapter mới
          </button>
        )}
      </div>
    </div>
  );
}
