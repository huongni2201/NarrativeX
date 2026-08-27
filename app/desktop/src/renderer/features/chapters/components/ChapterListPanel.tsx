import type { DesktopChapterDetails, DesktopChapterWorkspace } from "@narrativex/client-contracts";
import { ChevronLeft, ChevronRight, Filter, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../../workspace/components/FeaturePage";
import {
  chapterAudioListClass,
  chapterAudioListLabel,
  chapterStatus,
  chapterStatusClass,
  chapterStatusLabel,
  type ChapterFilter,
  type ChapterSort,
  wordCount,
} from "../model/chapter-ui";

type Props = Readonly<{
  chapters: DesktopChapterDetails[];
  allChaptersCount: number;
  editingId: string | null;
  isCreating: boolean;
  busy: boolean;
  query: string;
  statusFilter: ChapterFilter;
  sortBy: ChapterSort;
  page: number;
  pageSize: number;
  totalPages: number;
  filteredCount: number;
  workspacesByChapterId: ReadonlyMap<string, DesktopChapterWorkspace>;
  workspaceErrorsByChapterId: ReadonlySet<string>;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: ChapterFilter) => void;
  onSortChange: (value: ChapterSort) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onSelectChapter: (chapterId: string) => void;
  onDeleteChapter: (chapter: DesktopChapterDetails) => void;
}>;

export function ChapterListPanel({
  chapters,
  allChaptersCount,
  editingId,
  isCreating,
  busy,
  query,
  statusFilter,
  sortBy,
  page,
  pageSize,
  totalPages,
  filteredCount,
  workspacesByChapterId,
  workspaceErrorsByChapterId,
  onQueryChange,
  onStatusFilterChange,
  onSortChange,
  onResetFilters,
  onPageChange,
  onSelectChapter,
  onDeleteChapter,
}: Props) {
  const from = filteredCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, filteredCount);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-panel shadow-[var(--shadow-panel)]">
      <div className="space-y-3 border-b border-border p-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">Chapter List</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Quản lý và điều hướng các chapter trong project.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Tìm chapter</span>
            <input
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Tìm kiếm chapter..."
              className="h-8 w-full rounded-md border border-border bg-surface-input px-3 pr-8 text-xs text-foreground placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Search
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              size={13}
            />
          </label>
          <Button
            variant="outline"
            size="icon"
            onClick={onResetFilters}
            title="Đặt lại bộ lọc"
            aria-label="Đặt lại bộ lọc"
            className="size-8 border-border bg-surface-input text-text-muted hover:border-border-dark hover:text-foreground"
          >
            <Filter size={13} />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[10px] text-text-muted">
            <span>Trạng thái phân tích</span>
            <select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as ChapterFilter)}
              className="h-8 rounded-md border border-border bg-surface-input px-2 text-xs text-text-secondary focus:border-primary focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="completed">Đã phân tích</option>
              <option value="in_progress">Đang xử lý</option>
              <option value="draft">Nháp</option>
            </select>
          </label>

          <label className="grid gap-1 text-[10px] text-text-muted">
            <span>Sắp xếp</span>
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as ChapterSort)}
              className="h-8 rounded-md border border-border bg-surface-input px-2 text-xs text-text-secondary focus:border-primary focus:outline-none"
            >
              <option value="recent">Cập nhật mới nhất</option>
              <option value="order">Theo thứ tự</option>
              <option value="title">Theo tên A–Z</option>
              <option value="words">Nhiều từ nhất</option>
            </select>
          </label>
        </div>

        {statusFilter !== "all" && (
          <p className="text-[10px] leading-4 text-text-muted">
            Bộ lọc trạng thái tải workspace của toàn bộ chapter theo yêu cầu; polling nền vẫn chỉ
            chạy cho chapter đang chọn.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {chapters.map((chapter) => {
          const isSelected = !isCreating && editingId === chapter.id;
          const workspace = workspacesByChapterId.get(chapter.id);
          const status = workspaceErrorsByChapterId.has(chapter.id)
            ? "error"
            : chapterStatus(workspace);
          const audioListLabel = workspace
            ? chapterAudioListLabel(
                workspace.pipeline.audio.status,
                workspace.pipeline.audio.durationMs,
              )
            : null;

          return (
            <article
              key={chapter.id}
              className={`group flex items-stretch gap-1 rounded-md border transition-colors ${
                isSelected
                  ? "border-primary/65 border-l-2 border-l-primary bg-primary-muted/55"
                  : "border-border-subtle bg-surface hover:border-border hover:bg-surface-2"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectChapter(chapter.id)}
                className="min-w-0 flex-1 p-2.5 text-left focus-visible:outline-none"
              >
                <strong
                  className={`block truncate text-xs font-semibold ${
                    isSelected ? "text-primary-hover" : "text-foreground"
                  }`}
                >
                  {chapter.title}
                </strong>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted">
                  <span>{wordCount(chapter.sourceText).toLocaleString("vi-VN")} từ</span>
                  <span>v{chapter.rowVersion}</span>
                  {audioListLabel && (
                    <span className={chapterAudioListClass(workspace?.pipeline.audio.status)}>
                      {audioListLabel}
                    </span>
                  )}
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-1 pr-2">
                <span
                  className={`rounded px-2 py-0.5 text-[9px] font-medium ${chapterStatusClass(status)}`}
                >
                  {chapterStatusLabel(status)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteChapter(chapter)}
                  disabled={busy}
                  className="size-7 text-text-dim opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-danger"
                  title={`Xóa chapter ${chapter.title}`}
                  aria-label={`Xóa chapter ${chapter.title}`}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </article>
          );
        })}

        {!filteredCount && (
          <EmptyState
            title="Chưa có chapter phù hợp"
            description={
              allChaptersCount
                ? "Thử đổi bộ lọc hoặc tạo chapter mới."
                : "Tạo chapter đầu tiên để bắt đầu story flow."
            }
          />
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-border px-3 py-2.5 text-xs text-text-muted">
        <span>
          Hiển thị {from} – {to} của {filteredCount} chapter
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded p-1 text-text-muted hover:bg-surface-3 disabled:opacity-40"
            aria-label="Trang trước"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="min-w-14 rounded bg-surface-3 px-2 py-0.5 text-center text-xs font-semibold text-primary-hover">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded p-1 text-text-muted hover:bg-surface-3 disabled:opacity-40"
            aria-label="Trang sau"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </footer>
    </section>
  );
}
