import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DesktopChapterDetails, DesktopChapterWorkspace } from "@narrativex/client-contracts";
import {
  ArrowDownAZ,
  AudioLines,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  ExternalLink,
  FileText,
  Filter,
  FolderKanban,
  Globe2,
  GripVertical,
  Lightbulb,
  MoreVertical,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "../../workspace/components/FeaturePage";
import { generationApi } from "../../generation/api/generation.api";
import {
  chapterQueryKeys,
  useCreateChapter,
  useDeleteChapter,
  useChapterWorkspaceQuery,
  useUpdateChapter,
} from "../queries/chapters.queries";

type ChapterFilter = "all" | "with-content" | "empty";
type ChapterSort = "order" | "title" | "words";

export function ChaptersScreen({
  projectId,
  projectName,
  storyVersionId,
  chapters,
  workspaceStatus,
  projectsCount,
  assetsCount,
  charactersCount,
}: Readonly<{
  projectId: string;
  projectName: string;
  storyVersionId: string | null;
  chapters: DesktopChapterDetails[];
  workspaceStatus: "loading" | "ready" | "partial" | "empty" | "error";
  projectsCount: number;
  assetsCount: number;
  charactersCount: number;
}>) {
  const createChapter = useCreateChapter(projectId);
  const updateChapter = useUpdateChapter(projectId);
  const deleteChapter = useDeleteChapter(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChapterFilter>("all");
  const [sortBy, setSortBy] = useState<ChapterSort>("order");
  const [notice, setNotice] = useState<string | null>(null);

  const selected = chapters.find((chapter) => chapter.id === editingId) ?? null;
  const chapterWorkspaceQuery = useChapterWorkspaceQuery(projectId, editingId);
  const analyzeChapter = useMutation({
    mutationFn: (chapterId: string) => generationApi.analyze(projectId, chapterId),
    onSuccess: async (_job, chapterId) => {
      await queryClient.invalidateQueries({ queryKey: chapterQueryKeys.workspace(projectId, chapterId) });
      if (editingId === chapterId) setNotice("Phân tích chapter đã được gửi.");
    },
    onError: (error) => setNotice(toMessage(error)),
  });
  const totalWords = useMemo(
    () => chapters.reduce((total, chapter) => total + wordCount(chapter.sourceText), 0),
    [chapters],
  );
  const chaptersWithContent = useMemo(
    () => chapters.filter(hasContent).length,
    [chapters],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = chapters.filter((chapter) => {
      const matchesQuery = !needle ||
        `${chapter.title} ${chapter.sourceText}`.toLocaleLowerCase().includes(needle);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "with-content" && hasContent(chapter)) ||
        (statusFilter === "empty" && !hasContent(chapter));
      return matchesQuery && matchesStatus;
    });

    return [...result].sort((left, right) => {
      if (sortBy === "title") return left.title.localeCompare(right.title, "vi");
      if (sortBy === "words") return wordCount(right.sourceText) - wordCount(left.sourceText);
      return left.orderIndex - right.orderIndex;
    });
  }, [chapters, query, sortBy, statusFilter]);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setSourceText(selected.sourceText);
  }, [selected]);

  const busy = createChapter.isPending || updateChapter.isPending || deleteChapter.isPending || analyzeChapter.isPending;
  const isDirty = selected
    ? title !== selected.title || sourceText !== selected.sourceText
    : Boolean(title.trim() || sourceText.trim());
  const apiLabel =
    workspaceStatus === "ready"
      ? "API status"
      : workspaceStatus === "loading"
        ? "Syncing workspace"
        : workspaceStatus === "partial"
          ? "Partially synced"
          : "Workspace offline";

  function startNew(clearNotice = true) {
    setEditingId(null);
    setTitle("");
    setSourceText("");
    if (clearNotice) setNotice(null);
  }

  function selectChapter(chapterId: string) {
    if (isDirty && !window.confirm("Bạn có thay đổi chưa lưu. Bỏ thay đổi để mở chapter khác?")) return;
    setNotice(null);
    setEditingId(chapterId);
  }

  function cancelEditing() {
    if (isDirty && !window.confirm("Bỏ các thay đổi chưa lưu?")) return;
    startNew();
  }

  function openEditor() {
    if (isDirty && !window.confirm("Bạn có thay đổi chưa lưu. Rời màn hình này?")) return;
    navigate(`/projects/${projectId}/editor`);
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setSortBy("order");
  }

  async function save() {
    if (!title.trim() || !sourceText.trim() || busy) return;
    setNotice(null);
    try {
      if (selected) {
        await updateChapter.mutateAsync({
          chapterId: selected.id,
          title: title.trim(),
          sourceText,
          rowVersion: selected.rowVersion,
        });
        setNotice("Chapter đã được cập nhật.");
      } else {
        await createChapter.mutateAsync({
          storyVersionId: storyVersionId ?? undefined,
          orderIndex: chapters.length,
          title: title.trim(),
          sourceText,
        });
        setNotice("Chapter mới đã được tạo.");
      }
      if (!selected) startNew(false);
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  async function remove(chapter: DesktopChapterDetails) {
    if (!window.confirm(`Xóa chapter “${chapter.title}”?`)) return;
    setNotice(null);
    try {
      await deleteChapter.mutateAsync(chapter.id);
      if (editingId === chapter.id) startNew(false);
      setNotice("Chapter đã được xóa.");
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-[radial-gradient(circle_at_48%_0%,var(--workspace-glow),transparent_42%)]">
      <header className="flex items-end justify-between gap-4 border-b border-border bg-[var(--workspace-header)] px-5 py-4">
        <div className="min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-[.22em] text-text-muted">Chapter workspace</span>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-.02em] text-foreground">Chapter Workspace</h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-text-secondary">Nội dung được lấy từ backend domain và hiển thị trong cùng một workspace.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-[10px] text-text-secondary">
            <span className={`size-1.5 rounded-full ${workspaceStatus === "error" ? "bg-warning" : "bg-cyan shadow-[0_0_10px_var(--cyan)]"}`} />
            {apiLabel}
          </span>
          <Button variant="outline" onClick={openEditor} className="h-8 border-primary/35 bg-primary-muted px-3 text-[10px] text-primary-hover hover:bg-primary-light">
            Open Editor <ChevronRight size={13} />
          </Button>
        </div>
      </header>

      <WorkflowRibbon />

      <div className="grid min-h-0 grid-cols-[minmax(292px,.9fr)_minmax(420px,1.35fr)_minmax(250px,.72fr)] gap-2.5 overflow-hidden p-3 pt-2">
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-border bg-[var(--workspace-panel)] shadow-[var(--shadow-panel)]">
          <div className="border-b border-border p-4">
            <div>
              <h2 className="text-base font-semibold">Chapter List</h2>
              <p className="mt-1 text-[10px] text-text-muted">Quản lý và điều hướng các chapter trong project.</p>
            </div>
            <div className="mt-4 flex items-center gap-1.5">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-surface-input px-2 text-text-muted">
                <Search size={13} />
                <input name="chapter-search" autoComplete="off" className="h-8 min-w-0 flex-1 bg-transparent text-[10px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70 placeholder:text-text-muted" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm chapter…" aria-label="Tìm kiếm chapter" />
              </label>
              <Button variant="outline" size="icon" aria-label="Đặt lại bộ lọc" onClick={resetFilters} className="size-9 border-border bg-surface-input">
                <Filter size={14} />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <label className="flex h-8 items-center gap-1 rounded-md border border-border bg-surface-input px-2 text-[9px] text-text-secondary">
                <span className="sr-only">Lọc trạng thái</span>
                <select name="chapter-status" className="min-w-0 flex-1 bg-transparent text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ChapterFilter)}>
                  <option value="all">Tất cả trạng thái</option>
                  <option value="with-content">Có nội dung</option>
                  <option value="empty">Bản nháp trống</option>
                </select>
              </label>
              <label className="flex h-8 items-center gap-1 rounded-md border border-border bg-surface-input px-2 text-[9px] text-text-secondary">
                <ArrowDownAZ size={13} />
                <span className="sr-only">Sắp xếp chapter</span>
                <select name="chapter-sort" className="min-w-0 flex-1 bg-transparent text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70" value={sortBy} onChange={(event) => setSortBy(event.target.value as ChapterSort)}>
                  <option value="order">Theo thứ tự</option>
                  <option value="title">Theo tên A–Z</option>
                  <option value="words">Nhiều từ nhất</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-text-secondary">
              <span>{filtered.length} chapter</span>
              <span className="text-text-muted">{chaptersWithContent} có nội dung</span>
            </div>
            <Button size="sm" onClick={cancelEditing} className="mt-3 h-8 w-full bg-primary text-[10px] text-primary-foreground hover:bg-primary-hover"><Plus size={13} /> Tạo chapter mới</Button>
          </div>
          <div className="min-h-0 overflow-auto p-2">
            {filtered.map((chapter, index) => (
              <ChapterListItem
                key={chapter.id}
                chapter={chapter}
                index={index}
                selected={editingId === chapter.id}
                onSelect={() => selectChapter(chapter.id)}
                onRemove={() => void remove(chapter)}
                disabled={busy}
              />
            ))}
            {!filtered.length && <EmptyState title="Chưa có chapter phù hợp" description={chapters.length ? "Thử đổi bộ lọc hoặc tạo chapter mới." : "Tạo chapter đầu tiên để bắt đầu story flow."} />}
          </div>
          <div className="border-t border-border px-4 py-3 text-[10px] text-text-muted">Hiển thị {filtered.length} / {chapters.length} chapter</div>
        </section>

        {selected ? (
          <ChapterDetail
            chapter={selected}
            workspace={chapterWorkspaceQuery.data ?? null}
            loading={chapterWorkspaceQuery.isPending}
            error={chapterWorkspaceQuery.error}
            title={title}
            sourceText={sourceText}
            busy={busy}
            notice={notice}
            onTitleChange={setTitle}
            onSourceTextChange={setSourceText}
            onSave={() => void save()}
            onAnalyze={() => void analyzeChapter.mutateAsync(selected.id)}
            canAnalyze={(chapterWorkspaceQuery.data?.capabilities.canAnalyze ?? true) && !isDirty}
            onOpenEditor={openEditor}
            onOpenVisuals={() => navigate(`/projects/${projectId}/images`)}
          />
        ) : (
        <section className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-border bg-[var(--workspace-panel-strong)] shadow-[var(--shadow-panel)]">
          <div className="px-5 pt-5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary-hover" size={19} />
              <h2 className="text-base font-semibold">{selected ? "Chỉnh sửa chapter" : "Tạo chapter mới"}</h2>
            </div>
            <p className="mt-1 text-[10px] text-text-muted">Điền thông tin để tạo chapter mới cho project.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 px-5 py-4">
            <MetaChip icon={<Globe2 size={12} />} label="Ngôn ngữ: Tiếng Việt" />
            <MetaChip icon={<AudioLines size={12} />} label={`Ước lượng: ${estimateDuration(sourceText)}`} />
            <MetaChip icon={<FileText size={12} />} label={`${wordCount(sourceText).toLocaleString("vi-VN")} từ`} accent />
          </div>
          <div className="min-h-0 space-y-4 overflow-auto px-5 pb-4">
            <label className="grid gap-1.5 text-[10px] font-medium text-text-secondary">
              <span>Tên chapter <span className="text-primary-hover">*</span></span>
              <div className="relative">
                <Input name="chapter-title" autoComplete="off" maxLength={200} className="h-9 border-border-dark bg-surface-input pr-14 text-[11px] text-foreground placeholder:text-text-dim" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tên chapter (ví dụ: Chương 3: Đối đầu)" aria-label="Tên chapter" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-text-muted">{title.length} / 200</span>
              </div>
            </label>
            <label className="grid min-h-[220px] gap-1.5 text-[10px] font-medium text-text-secondary">
              <span>Mô tả / Nội dung chapter <span className="text-primary-hover">*</span></span>
              <Textarea name="chapter-source" className="min-h-0 resize-none border-border-dark bg-surface-input px-3 py-3 text-[11px] leading-5 text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/70" value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Nhập mô tả hoặc nội dung chapter…" aria-label="Mô tả hoặc nội dung chapter" />
              <span className="text-right text-[9px] text-text-muted">{wordCount(sourceText).toLocaleString("vi-VN")} từ</span>
            </label>
            <div className="flex items-start gap-2 rounded-md border border-cyan/20 bg-cyan/5 px-3 py-2.5 text-[10px] leading-5 text-text-secondary">
              <Lightbulb className="mt-0.5 shrink-0 text-cyan" size={14} />
              <span>Sau khi tạo chapter, bạn có thể tiếp tục phân tích và tạo scene trong Editor.</span>
            </div>
          </div>
          <div className="border-t border-border px-5 py-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelEditing} disabled={busy} className="h-9 flex-1 border-border bg-surface-input text-[10px] text-text-secondary">Hủy</Button>
              <Button onClick={() => void save()} disabled={!title.trim() || !sourceText.trim() || busy} className="h-9 flex-1 bg-primary text-[10px] text-primary-foreground hover:bg-primary-hover">
                <Sparkles size={13} /> {busy ? "Đang lưu…" : selected ? "Lưu thay đổi" : "Tạo chapter"}
              </Button>
            </div>
            {notice && <p className="mt-2 text-[10px] text-text-secondary" role="status" aria-live="polite">{notice}</p>}
          </div>
        </section>
        )}

        <WorkspaceContext
          projectName={projectName}
          workspaceStatus={workspaceStatus}
          chapters={chapters}
          totalWords={totalWords}
          chaptersWithContent={chaptersWithContent}
          projectsCount={projectsCount}
          assetsCount={assetsCount}
          charactersCount={charactersCount}
          onOpenEditor={openEditor}
          onOpenRender={() => navigate(`/projects/${projectId}/render`)}
        />
      </div>
    </div>
  );
}

function WorkflowRibbon() {
  const steps = [
    { label: "Story", icon: BookOpen },
    { label: "Chapter", icon: FileText, active: true },
    { label: "Scene", icon: Clapperboard },
    { label: "Visual Beat", icon: WandSparkles },
  ];

  return (
    <div className="border-b border-border px-5 py-3">
      <div className="flex max-w-4xl items-center gap-2 text-[10px] text-text-muted">
        {steps.map(({ label, icon: Icon, active }, index) => (
          <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <div className={`flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 ${active ? "border-primary/70 bg-primary-muted text-primary-hover" : "border-transparent text-text-secondary"}`}>
              <Icon size={13} />
              <span className="truncate font-medium">{label}</span>
            </div>
            {index < steps.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChapterDetail({ chapter, workspace, loading, error, title, sourceText, busy, notice, onTitleChange, onSourceTextChange, onSave, onAnalyze, canAnalyze, onOpenEditor, onOpenVisuals }: Readonly<{ chapter: DesktopChapterDetails; workspace: DesktopChapterWorkspace | null; loading: boolean; error: unknown; title: string; sourceText: string; busy: boolean; notice: string | null; onTitleChange: (value: string) => void; onSourceTextChange: (value: string) => void; onSave: () => void; onAnalyze: () => void; canAnalyze: boolean; onOpenEditor: () => void; onOpenVisuals: () => void }>) {
  const analysisStatus = workspace?.pipeline.analysis.status ?? "NOT_STARTED";
  const hasUnsavedChanges = title !== chapter.title || sourceText !== chapter.sourceText;
  const analysisReady = analysisStatus === "COMPLETED" && !workspace?.pipeline.sourceOutdated && !hasUnsavedChanges;

  return (
    <section className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-[var(--workspace-panel-strong)] shadow-[var(--shadow-panel)]">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] text-text-muted"><BookOpen size={12} /> Chapter Workspace <ChevronRight size={11} /> <span className="text-text-secondary">{title}</span></div>
            <h2 className="mt-2 truncate text-[20px] font-semibold tracking-[-.02em] text-foreground">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={onOpenEditor} className="h-8 border-border bg-surface-input text-[10px] text-text-secondary"><ExternalLink size={13} /> Mở editor lớn</Button>
            <span className="inline-flex h-8 items-center rounded-md border border-primary/35 bg-primary-muted px-2.5 text-[10px] text-primary-hover">v{chapter.rowVersion}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <MetaChip icon={<CheckCircle2 size={12} />} label={analysisStatusLabel(analysisStatus, workspace?.pipeline.sourceOutdated ?? false)} accent={analysisReady} />
          <MetaChip icon={<FileText size={12} />} label={`${wordCount(sourceText).toLocaleString("vi-VN")} từ`} />
          <MetaChip icon={<AudioLines size={12} />} label={workspace ? formatDurationSeconds(workspace.summary.estimatedDurationSeconds) : "— phút"} />
          <MetaChip icon={<Clapperboard size={12} />} label={workspace ? `${workspace.summary.sceneCount} scene` : "— scene"} />
          <MetaChip icon={<WandSparkles size={12} />} label={workspace ? `${workspace.summary.visualBeatCount} visual beat` : "— visual beat"} />
          {workspace?.pipeline.analysis.completedAt && <span className="inline-flex h-7 items-center rounded-md px-1.5 text-[9px] text-text-muted">Cập nhật {formatDateTime(workspace.pipeline.analysis.completedAt)}</span>}
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(300px,.98fr)] gap-2.5 overflow-hidden p-3">
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-border bg-surface-input">
          <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold">1. Chỉnh sửa nội dung chapter</h3><p className="mt-1 text-[10px] text-text-muted">Cập nhật nội dung nguồn trước khi phân tích.</p></div>
          <div className="min-h-0 overflow-auto p-4">
            <label className="grid gap-1.5 text-[10px] font-medium text-text-secondary"><span>Tiêu đề chapter</span><Input name="selected-chapter-title" maxLength={200} className="h-9 border-border-dark bg-surface-2 text-[11px] text-foreground" value={title} onChange={(event) => onTitleChange(event.target.value)} aria-label="Tiêu đề chapter" /></label>
            <label className="mt-4 grid min-h-[260px] gap-1.5 text-[10px] font-medium text-text-secondary"><span>Nội dung chapter</span><div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border-dark bg-surface-2"><div className="flex h-9 items-center gap-3 border-b border-border px-3 text-[10px] text-text-muted"><span>Đoạn văn</span><span className="font-semibold">B</span><span className="italic">I</span><span className="underline">U</span><span className="line-through">S</span><span className="ml-auto">Định dạng giữ nguyên khi lưu</span></div><Textarea name="selected-chapter-source" className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-3 text-[11px] leading-5 text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/70" value={sourceText} onChange={(event) => onSourceTextChange(event.target.value)} aria-label="Nội dung chapter" /></div><span className="text-right text-[9px] text-text-muted">Số từ: {wordCount(sourceText).toLocaleString("vi-VN")}</span></label>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3"><span className={`text-[10px] ${hasUnsavedChanges ? "text-warning" : "text-success"}`}>{hasUnsavedChanges ? "Có thay đổi chưa lưu" : "Đã đồng bộ backend"}</span><Button onClick={onSave} disabled={!title.trim() || !sourceText.trim() || busy || !hasUnsavedChanges} className="h-8 bg-primary text-[10px] text-primary-foreground hover:bg-primary-hover"><Save size={13} /> {busy ? "Đang lưu…" : "Lưu thay đổi"}</Button></div>
        </section>

        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-border bg-surface-input">
          <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3"><div><h3 className="text-sm font-semibold">2. Phân tích chapter</h3><p className="mt-1 text-[10px] text-text-muted">Tóm tắt và trạng thái pipeline từ backend.</p></div><StatusBadge status={analysisStatus} sourceOutdated={workspace?.pipeline.sourceOutdated ?? false} /></div>
          <div className="min-h-0 overflow-auto p-4">
            {loading && <AnalysisLoading />}
            {!loading && Boolean(error) && <AnalysisMessage title="Không tải được phân tích" description={error instanceof Error ? error.message : "Thử mở lại chapter để tải lại dữ liệu."} />}
            {!loading && !error && !analysisReady && <AnalysisMessage title={hasUnsavedChanges ? "Lưu thay đổi trước" : "Chapter chưa được phân tích"} description={hasUnsavedChanges ? "Phân tích chỉ chạy trên nội dung đã lưu ở backend." : "Phân tích sẽ nhận diện cấu trúc nội dung, scene và visual beat đề xuất."} actionLabel={hasUnsavedChanges ? undefined : "Phân tích chapter"} action={onAnalyze} disabled={!canAnalyze || busy} />}
            {!loading && !error && analysisReady && workspace && <AnalysisReady workspace={workspace} onAnalyze={onAnalyze} onOpenEditor={onOpenEditor} onOpenVisuals={onOpenVisuals} disabled={!canAnalyze || busy} />}
          </div>
          {notice && <p className="border-t border-border px-4 py-2 text-[10px] text-text-secondary" role="status" aria-live="polite">{notice}</p>}
        </section>
      </div>
    </section>
  );
}

function AnalysisLoading() {
  return <div className="grid gap-2"><div className="h-20 animate-pulse rounded-md bg-surface-2" /><div className="h-14 animate-pulse rounded-md bg-surface-2" /><div className="h-14 animate-pulse rounded-md bg-surface-2" /></div>;
}

function AnalysisMessage({ title, description, actionLabel, action, disabled = false }: Readonly<{ title: string; description: string; actionLabel?: string; action?: () => void; disabled?: boolean }>) {
  return <div className="flex min-h-[260px] flex-col items-center justify-center rounded-md border border-dashed border-border-dark bg-surface-2 px-6 text-center"><Sparkles className="text-primary-hover" size={22} /><h4 className="mt-3 text-sm font-semibold text-foreground">{title}</h4><p className="mt-1 max-w-xs text-[10px] leading-5 text-text-muted">{description}</p>{actionLabel && action && <Button onClick={action} disabled={disabled} className="mt-4 h-8 bg-primary text-[10px] text-primary-foreground hover:bg-primary-hover"><Sparkles size={13} /> {disabled ? "Đang xử lý…" : actionLabel}</Button>}</div>;
}

function AnalysisReady({ workspace, onAnalyze, onOpenEditor, onOpenVisuals, disabled }: Readonly<{ workspace: DesktopChapterWorkspace; onAnalyze: () => void; onOpenEditor: () => void; onOpenVisuals: () => void; disabled: boolean }>) {
  return <div className="grid gap-2.5"><div className="rounded-md border border-border-dark bg-surface-2 p-3"><div className="flex items-center justify-between"><h4 className="text-[11px] font-semibold">Tổng quan chapter</h4><span className="text-[9px] text-success">Đã phân tích</span></div><p className="mt-2 text-[10px] leading-5 text-text-secondary">Backend đã hoàn tất phân tích nội dung cho chapter này. Có {workspace.summary.sceneCount} scene và {workspace.summary.visualBeatCount} visual beat trong storyboard hiện tại.</p></div><div className="grid grid-cols-2 gap-2"><MetricCard label="Số scene" value={`${workspace.summary.sceneCount} scene`} /><MetricCard label="Số visual beat" value={`${workspace.summary.visualBeatCount} visual beat`} /></div><div className="rounded-md border border-border-dark bg-surface-2 p-3"><h4 className="text-[11px] font-semibold">Scene preview</h4>{workspace.previewScenes.length ? <div className="mt-2 grid gap-1.5">{workspace.previewScenes.slice(0, 4).map((scene) => <div key={scene.id} className="flex items-center justify-between gap-2 rounded border border-border-subtle px-2.5 py-2 text-[10px]"><span className="min-w-0 truncate text-text-secondary">{scene.orderIndex + 1}. {scene.title}</span><span className="shrink-0 text-text-muted">{scene.visualBeatCount} beat</span></div>)}</div> : <p className="mt-2 text-[10px] text-text-muted">Chưa có scene preview.</p>}</div><div className="rounded-md border border-border-dark bg-surface-2 p-3"><h4 className="text-[11px] font-semibold">Trạng thái pipeline</h4><div className="mt-2 grid gap-2"><PipelineRow label="Phân tích nội dung" status={workspace.pipeline.analysis.status} /><PipelineRow label="Gợi ý scene & visual beat" status={workspace.pipeline.visualPlanning.status} /><PipelineRow label="Visual generation" status={workspace.pipeline.visualGeneration.status} /><PipelineRow label="Render" status={workspace.pipeline.render.status} /></div></div><div className="flex gap-2"><Button variant="outline" onClick={onAnalyze} disabled={disabled} className="h-8 flex-1 border-primary/40 bg-primary-muted text-[10px] text-primary-hover hover:bg-primary-light">Phân tích lại</Button><Button variant="outline" onClick={onOpenEditor} className="h-8 flex-1 border-border bg-surface-2 text-[10px] text-text-secondary">Mở Editor</Button><Button variant="outline" onClick={onOpenVisuals} disabled={!workspace.capabilities.canGenerateVisuals} className="h-8 flex-1 border-border bg-surface-2 text-[10px] text-text-secondary">Mở Visuals</Button></div></div>;
}

function MetricCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="rounded-md border border-border-dark bg-surface-2 p-3"><span className="text-[9px] text-text-muted">{label}</span><strong className="mt-1 block text-sm text-foreground">{value}</strong><span className="mt-1 block text-[9px] text-success">• Đã đồng bộ</span></div>;
}

function PipelineRow({ label, status }: Readonly<{ label: string; status: string }>) {
  const complete = status === "COMPLETED";
  return <div className="flex items-center justify-between gap-2 text-[10px]"><span className="flex items-center gap-1.5 text-text-secondary"><CheckCircle2 className={complete ? "text-success" : "text-text-muted"} size={13} /> {label}</span><span className={complete ? "text-success" : "text-text-muted"}>{pipelineStatusLabel(status)}</span></div>;
}

function StatusBadge({ status, sourceOutdated }: Readonly<{ status: string; sourceOutdated: boolean }>) {
  const complete = status === "COMPLETED";
  return <span className={`rounded px-2 py-1 text-[9px] ${complete && !sourceOutdated ? "bg-success/15 text-success" : "bg-surface-3 text-text-muted"}`}>{analysisStatusLabel(status, sourceOutdated)}</span>;
}

function analysisStatusLabel(status: string, sourceOutdated: boolean) {
  if (sourceOutdated) return "Cần phân tích lại";
  if (status === "COMPLETED") return "Đã phân tích";
  if (status === "RUNNING") return "Đang phân tích";
  if (status === "QUEUED") return "Đang chờ";
  if (status === "FAILED") return "Phân tích lỗi";
  return "Chưa phân tích";
}

function pipelineStatusLabel(status: string) {
  if (status === "COMPLETED") return "Hoàn thành";
  if (status === "RUNNING") return "Đang chạy";
  if (status === "QUEUED") return "Đang chờ";
  if (status === "FAILED") return "Thất bại";
  return "Chưa bắt đầu";
}

function formatDurationSeconds(seconds: number) {
  if (!seconds) return "— phút";
  return `~ ${Math.max(1, Math.round(seconds / 60))} phút`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function ChapterListItem({ chapter, index, selected, onSelect, onRemove, disabled }: Readonly<{ chapter: DesktopChapterDetails; index: number; selected: boolean; onSelect: () => void; onRemove: () => void; disabled: boolean }>) {
  const content = hasContent(chapter);
  return (
    <div className={`group mb-1.5 flex items-center gap-2 rounded-md border p-2 transition-colors ${selected ? "border-primary/70 bg-[var(--chapter-selected)] shadow-[var(--shadow-primary)]" : "border-border-subtle bg-[var(--chapter-draft)] hover:border-border-dark hover:bg-surface-2"}`}>
      <GripVertical className="shrink-0 text-text-dim" size={14} aria-hidden="true" />
      <button type="button" disabled={disabled} className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-60" onClick={onSelect}>
        <span className={`grid size-7 shrink-0 place-items-center rounded-md text-xs font-semibold ${selected ? "bg-primary/25 text-primary-hover" : "bg-surface-3 text-text-secondary"}`}>{index + 1}</span>
        <span className="min-w-0">
          <strong className="block truncate text-[11px] text-foreground">{chapter.title}</strong>
          <span className="mt-0.5 block truncate text-[9px] text-text-muted">{wordCount(chapter.sourceText).toLocaleString("vi-VN")} từ <span className="px-1">•</span> v{chapter.rowVersion}</span>
        </span>
      </button>
      <span className={`hidden rounded px-1.5 py-0.5 text-[8px] sm:inline-flex ${content ? "bg-success/15 text-success" : "bg-surface-3 text-text-muted"}`}>{content ? "Có nội dung" : "Bản nháp"}</span>
      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-text-dim"><MoreVertical size={13} /></span>
      <Button variant="ghost" size="icon" aria-label={`Xóa ${chapter.title}`} onClick={onRemove} disabled={disabled} className="size-7 text-text-dim opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger"><Trash2 size={12} /></Button>
    </div>
  );
}

function MetaChip({ icon, label, accent = false }: Readonly<{ icon: ReactNode; label: string; accent?: boolean }>) {
  return <span className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[9px] ${accent ? "border-primary/25 bg-primary-muted text-primary-hover" : "border-border bg-surface-2 text-text-secondary"}`}>{icon}{label}</span>;
}

function WorkspaceContext({ projectName, workspaceStatus, chapters, totalWords, chaptersWithContent, projectsCount, assetsCount, charactersCount, onOpenEditor, onOpenRender }: Readonly<{ projectName: string; workspaceStatus: "loading" | "ready" | "partial" | "empty" | "error"; chapters: DesktopChapterDetails[]; totalWords: number; chaptersWithContent: number; projectsCount: number; assetsCount: number; charactersCount: number; onOpenEditor: () => void; onOpenRender: () => void }>) {
  const emptyDrafts = chapters.length - chaptersWithContent;
  return (
    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-border bg-[var(--workspace-context)]">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <FolderKanban className="text-text-secondary" size={16} />
          <h2 className="text-base font-semibold">Chapters</h2>
        </div>
        <p className="mt-1 text-[10px] text-text-secondary">Workspace context</p>
        <div className="mt-4 grid gap-1.5">
          <span className="text-[9px] text-text-muted">Project</span>
          <div className="flex h-8 items-center justify-between rounded-md border border-border bg-surface-input px-2.5 text-[10px] text-foreground"><span className="truncate">{projectName}</span><ChevronRight className="rotate-90 text-text-muted" size={13} /></div>
        </div>
        <div className="mt-5 grid gap-2.5">
          <ContextStat label="Tổng chapter" value={chapters.length} />
          <ContextStat label="Có nội dung" value={chaptersWithContent} />
          <ContextStat label="Bản nháp trống" value={emptyDrafts} />
          <ContextStat label="Tổng từ" value={totalWords.toLocaleString("vi-VN")} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          <ContextMiniStat label="Projects" value={projectsCount} />
          <ContextMiniStat label="Assets" value={assetsCount} />
          <ContextMiniStat label="Characters" value={charactersCount} />
        </div>
      </div>

      <div className="min-h-0 overflow-auto p-4">
        <div className="rounded-md border border-warning/20 bg-warning/5 p-3 text-[10px] leading-5 text-text-secondary">
          <div className="flex items-center gap-2 font-medium text-warning"><Lightbulb size={14} /> Mẹo nhanh</div>
          <ul className="mt-2 grid gap-2 pl-4">
            <li>Tạo chapter rõ ràng để dễ phân tích và tạo scene hơn.</li>
            <li>Mỗi chapter nên tập trung vào một mục tiêu hoặc bước phát triển chính.</li>
            <li>Sau khi tạo, hãy mở Editor để tiếp tục scene và visual beat.</li>
          </ul>
        </div>

        <div className="mt-4 rounded-md border border-border bg-surface-input p-3">
          <div className="flex items-center justify-between">
            <div><span className="text-[9px] font-bold uppercase tracking-[.17em] text-text-muted">Render queue</span><h3 className="mt-1 text-xs font-semibold">Production render</h3></div>
            <span className="grid size-5 place-items-center rounded bg-surface-3 text-[10px] text-text-muted">—</span>
          </div>
          <p className="mt-3 text-[10px] leading-5 text-text-secondary">Trạng thái render được cập nhật trong màn Render.</p>
          <Button variant="outline" size="sm" onClick={onOpenRender} className="mt-3 h-8 w-full border-primary/40 bg-primary-muted text-[10px] text-primary-hover hover:bg-primary-light"><Sparkles size={13} /> Mở Render Queue</Button>
        </div>
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[.1em] text-text-muted"><span className={`size-1.5 rounded-full ${workspaceStatus === "error" ? "bg-warning" : "bg-cyan shadow-[0_0_8px_var(--cyan)]"}`} /> {workspaceStatus === "ready" ? "Connected" : apiStatusLabel(workspaceStatus)}</div>
        <Button variant="outline" onClick={onOpenEditor} className="mt-3 h-8 w-full border-primary/45 bg-primary-muted text-[10px] text-primary-hover hover:bg-primary-light"><BookOpen size={13} /> Return to editor</Button>
      </div>
    </aside>
  );
}

function ContextStat({ label, value }: Readonly<{ label: string; value: number | string }>) {
  return <div className="flex items-center justify-between border-b border-border-subtle pb-2 text-[10px]"><span className="text-text-muted">{label}</span><strong className="tabular-nums text-foreground">{value}</strong></div>;
}

function ContextMiniStat({ label, value }: Readonly<{ label: string; value: number }>) {
  return <div className="rounded-md border border-border-subtle bg-surface-input px-2 py-2 text-center"><strong className="block tabular-nums text-[11px] text-foreground">{value}</strong><span className="mt-0.5 block truncate text-[8px] text-text-muted">{label}</span></div>;
}

function hasContent(chapter: DesktopChapterDetails) {
  return Boolean(chapter.sourceText.trim());
}

function apiStatusLabel(status: "loading" | "ready" | "partial" | "empty" | "error") {
  if (status === "loading") return "Syncing";
  if (status === "partial") return "Partial sync";
  if (status === "empty") return "No data";
  return "Offline";
}

function estimateDuration(value: string) {
  const words = wordCount(value);
  if (!words) return "—";
  return `${Math.max(1, Math.round(words / 150))} phút`;
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Thao tác chapter thất bại.";
}
