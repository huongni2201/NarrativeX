import type { DesktopChapterDetails, DesktopChapterWorkspace } from "@narrativex/client-contracts";
import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Search,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "../../workspace/components/FeaturePage";
import { InlineNotice, PaneHeader, WorkspacePane } from "../../workspace/components/WorkstationPrimitives";
import {
  chapterAudioListClass,
  chapterAudioListLabel,
  chapterNumberLabel,
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
  deleteBusy: boolean;
  bulkAudioBusy: boolean;
  bulkAnalysisBusy: boolean;
  canBulkAudio: boolean;
  canBulkAnalysis: boolean;
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
  onGenerateAudioAll: () => void;
  onAnalyzeAll: () => void;
}>;

export function ChapterListPanel({
  chapters,
  allChaptersCount,
  editingId,
  isCreating,
  deleteBusy,
  bulkAudioBusy,
  bulkAnalysisBusy,
  canBulkAudio,
  canBulkAnalysis,
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
  onGenerateAudioAll,
  onAnalyzeAll,
}: Props) {
  const from = filteredCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, filteredCount);
  const selectionHidden = Boolean(
    editingId && !isCreating && !chapters.some((chapter) => chapter.id === editingId),
  );
  const statusFilterLoading =
    statusFilter !== "all" &&
    allChaptersCount > 0 &&
    workspacesByChapterId.size + workspaceErrorsByChapterId.size < allChaptersCount;

  return (
    <WorkspacePane className="flex flex-col border-r border-border-subtle bg-surface-panel">
      <PaneHeader
        title="Chapters"
        meta={`${filteredCount} visible · ${allChaptersCount} total`}
        actions={
          <Button variant="ghost" size="icon" onClick={onResetFilters} title="Đặt lại bộ lọc" aria-label="Đặt lại bộ lọc">
            <Filter size={12} />
          </Button>
        }
      />

      <div className="shrink-0 border-b border-border-subtle p-2.5">
        <label className="relative block">
          <span className="sr-only">Tìm chapter</span>
          <Input
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm chapter..."
            className="pr-8"
          />
          <Search className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim" size={12} />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as ChapterFilter)}>
            <SelectTrigger aria-label="Trạng thái phân tích"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="completed">Đã phân tích</SelectItem>
              <SelectItem value="in_progress">Đang xử lý</SelectItem>
              <SelectItem value="draft">Nháp</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => onSortChange(value as ChapterSort)}>
            <SelectTrigger aria-label="Sắp xếp chapter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="order">Theo thứ tự</SelectItem>
              <SelectItem value="recent">Mới cập nhật</SelectItem>
              <SelectItem value="title">Tên A–Z</SelectItem>
              <SelectItem value="words">Nhiều từ nhất</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAnalyzeAll}
            disabled={!canBulkAnalysis || bulkAnalysisBusy}
            className="min-w-0 flex-1"
          >
            {bulkAnalysisBusy ? <Loader2 className="animate-spin" size={12} /> : <WandSparkles size={12} />}
            Analyze all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGenerateAudioAll}
            disabled={!canBulkAudio || bulkAudioBusy}
            className="min-w-0 flex-1"
          >
            {bulkAudioBusy ? <Loader2 className="animate-spin" size={12} /> : <AudioLines size={12} />}
            Audio all
          </Button>
        </div>
      </div>

      {statusFilterLoading ? <InlineNotice tone="info">Đang tải trạng thái để hoàn tất bộ lọc…</InlineNotice> : null}
      {selectionHidden ? <InlineNotice tone="warning">Chapter đang chỉnh sửa nằm ngoài trang hoặc bộ lọc hiện tại.</InlineNotice> : null}

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {chapters.map((chapter) => {
          const isSelected = !isCreating && editingId === chapter.id;
          const workspace = workspacesByChapterId.get(chapter.id);
          const status = workspaceErrorsByChapterId.has(chapter.id) ? "error" : chapterStatus(workspace);
          const audioListLabel = workspace
            ? chapterAudioListLabel(workspace.pipeline.audio.status, workspace.pipeline.audio.durationMs)
            : null;

          return (
            <article
              key={chapter.id}
              className={`group flex min-h-[58px] items-stretch border-l-2 border-b border-b-border-subtle transition-colors ${
                isSelected
                  ? "border-l-primary bg-primary-muted/45"
                  : "border-l-transparent hover:bg-surface-hover"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectChapter(chapter.id)}
                className="min-w-0 flex-1 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-medium uppercase tracking-wide text-text-dim">
                    {chapterNumberLabel(chapter.orderIndex)}
                  </span>
                  <span className={`rounded-sm px-1 py-0.5 text-[8px] font-medium ${chapterStatusClass(status)}`}>
                    {chapterStatusLabel(status)}
                  </span>
                </div>
                <strong className={`mt-0.5 block truncate text-[11px] font-semibold ${isSelected ? "text-primary-hover" : "text-foreground"}`}>
                  {chapter.title}
                </strong>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-[9px] text-text-dim">
                  <span>{wordCount(chapter.sourceText).toLocaleString("vi-VN")} từ</span>
                  <span>v{chapter.rowVersion}</span>
                  {audioListLabel ? <span className={`truncate ${chapterAudioListClass(workspace?.pipeline.audio.status)}`}>{audioListLabel}</span> : null}
                </div>
              </button>
              <div className="flex shrink-0 items-center pr-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteChapter(chapter)}
                  disabled={deleteBusy}
                  className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-danger"
                  title={`Xóa chapter ${chapter.title}`}
                  aria-label={`Xóa chapter ${chapter.title}`}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </article>
          );
        })}

        {!filteredCount ? (
          <EmptyState
            title={statusFilterLoading ? "Đang tải trạng thái chapter…" : "Chưa có chapter phù hợp"}
            description={
              statusFilterLoading
                ? "Kết quả bộ lọc sẽ xuất hiện khi trạng thái các chapter tải xong."
                : allChaptersCount
                  ? "Thử đổi bộ lọc hoặc tạo chapter mới."
                  : "Tạo chapter đầu tiên để bắt đầu story flow."
            }
          />
        ) : null}
      </div>

      <footer className="flex min-h-9 shrink-0 items-center justify-between border-t border-border-subtle px-2.5 text-[9px] text-text-dim">
        <span>{from}–{to} / {filteredCount}</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Trang trước">
            <ChevronLeft size={12} />
          </Button>
          <span className="min-w-10 text-center tabular-nums text-text-secondary">{page}/{totalPages}</span>
          <Button variant="ghost" size="icon" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Trang sau">
            <ChevronRight size={12} />
          </Button>
        </div>
      </footer>
    </WorkspacePane>
  );
}
