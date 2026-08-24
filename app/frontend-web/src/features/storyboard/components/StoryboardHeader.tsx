import { Plus, Search } from "lucide-react";
import type { ChapterId } from "@/types/api";
import type { ApiChapterStoryboard, ApiStoryboardScene } from "../api/storyboard.api";
import type { StatusFilter, StoryboardChapterItem } from "../hooks/useStoryboardState";

interface StoryboardHeaderProps {
  hideChapterSelector: boolean;
  orderedChapters: StoryboardChapterItem[];
  chapterId: ChapterId | null;
  sceneId: string | null;
  status: StatusFilter;
  search: string;
  storyboard: ApiChapterStoryboard | undefined;
  onChapterChange: (chapterId: ChapterId) => void;
  onSceneChange: (sceneId: string | null) => void;
  onStatusChange: (status: StatusFilter) => void;
  onSearchChange: (search: string) => void;
  onAddVisualBeat: () => void;
}

export function StoryboardHeader({
  hideChapterSelector,
  orderedChapters,
  chapterId,
  sceneId,
  status,
  search,
  storyboard,
  onChapterChange,
  onSceneChange,
  onStatusChange,
  onSearchChange,
  onAddVisualBeat,
}: Readonly<StoryboardHeaderProps>) {
  return (
    <div className="border-b border-border-dark px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        {!hideChapterSelector && (
          <select
            aria-label="Chọn Chapter"
            value={chapterId?.toString() ?? ""}
            onChange={(event) => onChapterChange(event.target.value)}
            className="h-9 min-w-[230px] rounded-md border border-border-darker bg-surface-input px-2.5 text-xs text-slate-300 outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          >
            {orderedChapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                Chapter {String(chapter.orderIndex + 1).padStart(2, "0")} — {chapter.title}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="Lọc theo Scene"
          value={sceneId?.toString() ?? "ALL"}
          onChange={(event) => onSceneChange(event.target.value === "ALL" ? null : event.target.value)}
          className="h-9 rounded-md border border-border-darker bg-surface-input px-2.5 text-xs text-slate-300 outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        >
          <option value="ALL">All Scenes</option>
          {(storyboard?.scenes ?? []).map((scene: ApiStoryboardScene) => (
            <option key={scene.id} value={scene.id}>
              Scene {String(scene.orderIndex + 1).padStart(2, "0")}
            </option>
          ))}
        </select>

        <select
          aria-label="Lọc theo trạng thái"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
          className="h-9 rounded-md border border-border-darker bg-surface-input px-2.5 text-xs text-slate-300 outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        >
          <option value="ALL">All Status</option>
          <option value="APPROVED">Approved</option>
          <option value="NEEDS_REVIEW">Needs Review</option>
        </select>

        <label className="relative min-w-[190px] flex-1 sm:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm kiếm scene/visual beat…"
            className="h-9 w-full rounded-md border border-border-darker bg-surface-input pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </label>

        <button
          type="button"
          onClick={onAddVisualBeat}
          disabled={!storyboard?.scenes.length}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-orange-600 px-3 text-xs font-semibold text-white shadow-lg shadow-orange-950/30 transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm Visual Beat
        </button>
      </div>
    </div>
  );
}
