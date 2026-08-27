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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const totalDurationMs = useMemo(
    () => hierarchy.reduce((total, group) => total + Math.max(0, group.chapter.endMs - group.chapter.startMs), 0),
    [hierarchy],
  );

  // Flatten all chapters/scenes/beats or format chapter items for the list
  const chaptersList = useMemo(() => {
    if (hierarchy.length > 0) {
      return hierarchy.map((group, index) => {
        const chapterNumber = String(group.chapter.orderIndex + 1 || index + 1).padStart(2, "0");
        const startSecs = formatTimeSecs(group.chapter.startMs);
        const endSecs = formatTimeSecs(group.chapter.endMs);
        const hasSelectedBeat = group.beats.some((b) => b.visualBeatId === selectedBeatId);
        const firstBeat = group.beats[0] ?? null;

        return {
          id: group.chapter.chapterId,
          number: chapterNumber,
          title: group.chapter.title || `Chapter ${chapterNumber}`,
          timeRange: `${startSecs} - ${endSecs}`,
          isActive: hasSelectedBeat,
          firstBeat,
          beats: group.beats,
          group,
        };
      });
    }

    // Default placeholder chapters if hierarchy is empty for visual consistency
    return [
      { id: "1", number: "01", title: "Visual Beat", timeRange: "00:00 - 00:10", isActive: true, firstBeat: null, beats: [] },
      { id: "2", number: "02", title: "Introduction", timeRange: "00:10 - 00:25", isActive: false, firstBeat: null, beats: [] },
      { id: "3", number: "03", title: "The Turning Point", timeRange: "00:25 - 00:45", isActive: false, firstBeat: null, beats: [] },
      { id: "4", number: "04", title: "Climax", timeRange: "00:45 - 01:05", isActive: false, firstBeat: null, beats: [] },
      { id: "5", number: "05", title: "Resolution", timeRange: "01:05 - 01:30", isActive: false, firstBeat: null, beats: [] },
    ];
  }, [hierarchy, selectedBeatId]);

  return (
    <aside className="nx-editor-explorer relative flex h-full min-h-0 flex-col border-r border-border-subtle bg-surface-panel text-foreground">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-5">
        <h3 className="text-[14px] font-bold tracking-tight text-foreground">Project Explorer</h3>
        <button
          type="button"
          onClick={onClose}
          className="nx-icon-button size-7 text-text-muted hover:text-foreground"
          aria-label="Collapse Explorer"
        >
          <ChevronsLeft size={16} />
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle p-3">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search size={14} className="pointer-events-none absolute left-3 text-text-muted" />
          <input
            type="text"
            className="h-8 w-full rounded-md border border-border-subtle bg-surface-input pl-9 pr-3 text-[11px] text-text-secondary placeholder:text-text-dim focus:border-primary/60 focus:outline-none"
            placeholder="Search chapters or media..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-input text-text-muted hover:border-border hover:bg-surface-2 hover:text-foreground"
          title="Filter"
          aria-label="Filter"
        >
          <Filter size={13} />
        </button>
        <button
          type="button"
          onClick={() => setViewMode((m) => (m === "list" ? "grid" : "list"))}
          className="grid size-8 shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-input text-text-muted hover:border-border hover:bg-surface-2 hover:text-foreground"
          title="Toggle view mode"
          aria-label="Toggle view mode"
        >
          <LayoutGrid size={13} />
        </button>
      </div>

      {/* Chapters List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2.5 pb-28">
        <div className="space-y-2">
          {chaptersList.map((chapter) => {
            const isActive = chapter.isActive;

            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => {
                  if (chapter.firstBeat) {
                    onSelectBeat(chapter.firstBeat);
                  }
                }}
                className={`group flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-all ${
                  isActive
                    ? "border-primary bg-[#131926] shadow-[0_0_14px_rgba(255,138,0,0.12)] ring-1 ring-primary/40"
                    : "border-border-subtle bg-surface hover:border-border hover:bg-surface-2"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-6 shrink-0 place-items-center">
                    {isActive ? (
                      <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white shadow-[0_0_8px_rgba(255,138,0,0.4)]">
                        <Play size={9} className="ml-0.5 fill-white" />
                      </span>
                    ) : (
                      <span className="grid size-5 place-items-center rounded-full border border-border-subtle text-[10px] text-text-dim group-hover:border-border">
                        <Info size={10} />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[12px] font-bold ${isActive ? "text-primary" : "text-text-muted"}`}>
                        {chapter.number}
                      </span>
                      <span className={`truncate text-[12px] font-medium ${isActive ? "text-white" : "text-text-secondary"}`}>
                        {chapter.title}
                      </span>
                    </div>
                    <span className="mt-0.5 block font-mono text-[10px] text-text-dim">
                      {chapter.timeRange}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onAddChapter}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle bg-surface/50 text-[11px] font-medium text-text-muted transition hover:border-primary/50 hover:bg-primary-muted hover:text-primary"
          >
            <Plus size={14} />
            <span>Add Chapter</span>
          </button>
        </div>
      </div>

      {/* Project Info Card */}
      <div className="nx-project-info absolute inset-x-0 bottom-0 z-10 border-t border-border-subtle bg-surface-panel p-2">
        <div className="rounded-lg border border-border-subtle bg-surface p-2">
          <h4 className="text-[12px] font-bold text-foreground">Project Info</h4>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="text-text-dim">Resolution</span>
              <span className="truncate text-right font-medium text-text-secondary">1920 × 1080</span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="text-text-dim">Frame Rate</span>
              <span className="truncate text-right font-medium text-text-secondary">24 fps</span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="text-text-dim">Duration</span>
              <span className="truncate text-right font-mono font-medium text-text-secondary">
                {totalDurationMs > 0 ? formatDurationTimecode(totalDurationMs) : "01:30.00"}
              </span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="text-text-dim">Aspect Ratio</span>
              <span className="truncate text-right font-medium text-text-secondary">16:9</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
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
