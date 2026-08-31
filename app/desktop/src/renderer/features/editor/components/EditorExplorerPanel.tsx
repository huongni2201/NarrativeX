import { useMemo, useState } from "react";
import {
  ChevronsLeft,
  Filter,
  Info,
  LayoutGrid,
  Play,
  Plus,
  Search,
} from "lucide-react";
import type { DesktopTimelineBeat } from "@narrativex/client-contracts";
import { Input } from "@/components/ui/input";
import type { EditorChapterGroup } from "../editor-timeline";

interface EditorExplorerPanelProps {
  hierarchy: EditorChapterGroup[];
  selectedBeatId: string;
  onSelectBeat: (beat: DesktopTimelineBeat) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onAddChapter?: () => void;
  onClose?: () => void;
}

export function EditorExplorerPanel({
  hierarchy,
  selectedBeatId,
  onSelectBeat,
  query,
  onQueryChange,
  onAddChapter,
  onClose,
}: Readonly<EditorExplorerPanelProps>) {
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  const totalDurationMs = useMemo(
    () => hierarchy.reduce((total, group) => total + Math.max(0, group.chapter.endMs - group.chapter.startMs), 0),
    [hierarchy],
  );

  const chaptersList = useMemo(() => {
    if (hierarchy.length > 0) {
      return hierarchy.map((group, index) => {
        const chapterNumber = String(group.chapter.orderIndex + 1 || index + 1).padStart(2, "0");
        const startSecs = formatTimeSecs(group.chapter.startMs);
        const endSecs = formatTimeSecs(group.chapter.endMs);
        const hasSelectedBeat = group.beats.some((beat) => beat.visualBeatId === selectedBeatId);
        const firstBeat = group.beats[0] ?? null;

        return {
          id: group.chapter.chapterId,
          number: chapterNumber,
          title: group.chapter.title || `Chapter ${chapterNumber}`,
          timeRange: `${startSecs} - ${endSecs}`,
          isActive: hasSelectedBeat,
          firstBeat,
        };
      });
    }

    return [];
  }, [hierarchy, selectedBeatId]);

  return (
    <aside className="nx-editor-explorer relative flex h-full min-h-0 flex-col border-r border-border-subtle bg-surface-panel text-foreground">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold tracking-tight text-foreground">Project Explorer</h3>
          <p className="mt-0.5 text-[10px] text-text-dim">{chaptersList.length} chapters</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="nx-icon-button size-7 text-text-muted hover:text-foreground"
          aria-label="Collapse Explorer"
        >
          <ChevronsLeft size={15} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-b border-border-subtle px-3 py-2.5">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search size={13} className="pointer-events-none absolute left-2.5 text-text-muted" />
          <Input
            className="pl-8 pr-2.5 text-[11px]"
            placeholder="Search chapters or media..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="nx-icon-button size-8 border border-border-subtle bg-surface-input hover:border-border-dark hover:bg-surface-2"
          title="Filter"
          aria-label="Filter"
        >
          <Filter size={13} />
        </button>
        <button
          type="button"
          onClick={() => setViewMode((mode) => (mode === "list" ? "grid" : "list"))}
          className={`nx-icon-button size-8 border bg-surface-input hover:border-border-dark hover:bg-surface-2 ${
            viewMode === "grid" ? "border-border-dark text-text-secondary" : "border-border-subtle"
          }`}
          title="Toggle view mode"
          aria-label="Toggle view mode"
          aria-pressed={viewMode === "grid"}
        >
          <LayoutGrid size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2 pb-24">
        <div className={viewMode === "grid" ? "grid grid-cols-2 gap-1.5 max-[960px]:grid-cols-1" : "space-y-1"}>
          {chaptersList.map((chapter) => {
            const isActive = chapter.isActive;

            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => {
                  if (chapter.firstBeat) onSelectBeat(chapter.firstBeat);
                }}
                className={`group relative flex min-h-[54px] w-full items-center rounded-md border px-2.5 py-2 text-left transition-[background-color,border-color,color] duration-150 ${
                  isActive
                    ? "border-primary/20 bg-primary-muted text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                    : "border-transparent bg-transparent hover:border-border-subtle hover:bg-surface-2"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="grid size-5 shrink-0 place-items-center">
                    {isActive ? (
                      <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Play size={9} className="ml-0.5 fill-current" />
                      </span>
                    ) : (
                      <span className="grid size-5 place-items-center rounded-full border border-border-subtle text-text-dim transition-colors group-hover:border-border-dark group-hover:text-text-muted">
                        <Info size={10} />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-[10px] font-semibold ${isActive ? "text-primary" : "text-text-dim"}`}>
                        {chapter.number}
                      </span>
                      <span className={`truncate text-[11px] font-medium ${isActive ? "text-foreground" : "text-text-secondary"}`}>
                        {chapter.title}
                      </span>
                    </div>
                    <span className="mt-0.5 block font-mono text-[10px] text-text-dim">{chapter.timeRange}</span>
                  </div>
                </div>
              </button>
            );
          })}

          {chaptersList.length === 0 && (
            <div className="col-span-full border-y border-dashed border-border-subtle px-4 py-7 text-center" role="status">
              <p className="text-[11px] font-medium text-text-secondary">
                {query.trim() ? "Không tìm thấy chapter phù hợp." : "Chưa có chapter nào."}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-text-dim">
                {query.trim() ? "Thử thay đổi từ khóa tìm kiếm." : "Tạo chapter trong tab Chapters để bắt đầu biên tập."}
              </p>
            </div>
          )}

          {onAddChapter && (
            <button
              type="button"
              onClick={onAddChapter}
              className="col-span-full flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-subtle text-[11px] font-medium text-text-muted transition-[background-color,border-color,color] duration-150 hover:border-border-dark hover:bg-surface-2 hover:text-foreground"
            >
              <Plus size={13} aria-hidden="true" />
              <span>Add Chapter</span>
            </button>
          )}
        </div>
      </div>

      <div className="nx-project-info absolute inset-x-0 bottom-0 z-10 border-t border-border-subtle bg-surface-panel px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[11px] font-semibold text-foreground">Project Info</h4>
          <span className="font-mono text-[10px] text-text-dim">
            {totalDurationMs > 0 ? formatDurationTimecode(totalDurationMs) : "01:30.00"}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          <InfoPair label="Resolution" value="1920 × 1080" />
          <InfoPair label="Frame Rate" value="24 fps" />
          <InfoPair label="Aspect Ratio" value="16:9" />
          <InfoPair label="Chapters" value={String(chaptersList.length)} />
        </div>
      </div>
    </aside>
  );
}

function InfoPair({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="text-text-dim">{label}</span>
      <span className="truncate text-right font-medium text-text-secondary">{value}</span>
    </div>
  );
}

function formatTimeSecs(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDurationTimecode(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}
