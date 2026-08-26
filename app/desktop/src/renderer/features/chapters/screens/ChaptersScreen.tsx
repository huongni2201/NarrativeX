import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  DesktopChapterDetails,
  DesktopChapterWorkspace,
  DesktopVoice,
} from "@narrativex/client-contracts";
import {
  ArrowDownAZ,
  AudioLines,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  FileText,
  Filter,
  Folder,
  GripVertical,
  Info,
  Layers,
  Lightbulb,
  MoreVertical,
  Plus,
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
import { useGenerateNarration } from "../../generation/queries/narration.queries";
import {
  chapterQueryKeys,
  useCreateChapter,
  useDeleteChapter,
  useChapterWorkspacesQuery,
  useUpdateChapter,
} from "../queries/chapters.queries";

type ChapterFilter = "all" | "completed" | "in_progress" | "draft";
type ChapterSort = "recent" | "title" | "order" | "words";

export function ChaptersScreen({
  projectId,
  projectName,
  storyVersionId,
  chapters,
  voices,
  workspaceStatus,
  projectsCount: _projectsCount,
  assetsCount: _assetsCount,
  charactersCount: _charactersCount,
}: Readonly<{
  projectId: string;
  projectName: string;
  storyVersionId: string | null;
  chapters: DesktopChapterDetails[];
  voices: DesktopVoice[];
  workspaceStatus: "loading" | "ready" | "partial" | "empty" | "error";
  projectsCount: number;
  assetsCount: number;
  charactersCount: number;
}>) {
  const createChapter = useCreateChapter(projectId);
  const generateNarration = useGenerateNarration();
  const updateChapter = useUpdateChapter(projectId);
  const deleteChapter = useDeleteChapter(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [speakingRate, setSpeakingRate] = useState("1");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChapterFilter>("all");
  const [sortBy, setSortBy] = useState<ChapterSort>("recent");
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Auto select first chapter if available
  useEffect(() => {
    if (!editingId && chapters.length > 0) {
      setEditingId(chapters[0].id);
    }
  }, [chapters, editingId]);

  useEffect(() => {
    if (!voices.some((voice) => voice.id === voiceId)) {
      setVoiceId(voices[0]?.id ?? "");
    }
  }, [voiceId, voices]);

  const selected = chapters.find((chapter) => chapter.id === editingId) ?? null;
  const chapterWorkspaceQueries = useChapterWorkspacesQuery(projectId, chapters);
  const workspacesByChapterId = useMemo(() => {
    const workspaces = new Map<string, DesktopChapterWorkspace>();
    for (const query of chapterWorkspaceQueries) {
      if (query.data) workspaces.set(query.data.chapter.id, query.data);
    }
    return workspaces;
  }, [chapterWorkspaceQueries]);
  const workspaceQueriesByChapterId = useMemo(
    () => new Map(chapters.map((chapter, index) => [chapter.id, chapterWorkspaceQueries[index]])),
    [chapters, chapterWorkspaceQueries],
  );
  const selectedWorkspace = selected ? workspacesByChapterId.get(selected.id) : undefined;
  const selectedWorkspaceQuery = selected ? workspaceQueriesByChapterId.get(selected.id) : undefined;
  const chapterWorkspaceStatsReady =
    chapterWorkspaceQueries.length === chapters.length &&
    chapterWorkspaceQueries.every((query) => query.isSuccess);
  const analyzeChapter = useMutation({
    mutationFn: (chapterId: string) => generationApi.analyze(projectId, chapterId),
    onSuccess: async (_job, chapterId) => {
      await queryClient.invalidateQueries({ queryKey: chapterQueryKeys.workspace(projectId, chapterId) });
      if (editingId === chapterId) setNotice("Phân tích chapter đã được gửi.");
    },
    onError: (error) => setNotice(toMessage(error)),
  });

  async function createAudio() {
    if (!selected || !voiceId || busy) return;
    setNotice(null);
    const parsedRate = Number.parseFloat(speakingRate);
    try {
      const job = await generateNarration.mutateAsync({
        projectId,
        request: {
          chapterId: selected.id,
          voiceId,
          speakingRate: Number.isFinite(parsedRate) ? parsedRate : 1,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chapterQueryKeys.workspace(projectId, selected.id) }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
      ]);
      setNotice(`Đã gửi tạo audio. Job ${job.jobId.slice(0, 8)} đang được xử lý.`);
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  const totalWords = useMemo(
    () => chapters.reduce((total, chapter) => total + wordCount(chapter.sourceText), 0),
    [chapters],
  );

  const completedCount = useMemo(
    () => chapters.filter((chapter) => chapterStatus(workspacesByChapterId.get(chapter.id)) === "completed").length,
    [chapters, workspacesByChapterId],
  );

  const inProgressCount = useMemo(
    () => chapters.filter((chapter) => chapterStatus(workspacesByChapterId.get(chapter.id)) === "in_progress").length,
    [chapters, workspacesByChapterId],
  );

  const draftCount = useMemo(
    () => chapters.filter((chapter) => chapterStatus(workspacesByChapterId.get(chapter.id)) === "draft").length,
    [chapters, workspacesByChapterId],
  );

  const totalSceneCount = useMemo(
    () => [...workspacesByChapterId.values()].reduce((total, workspace) => total + workspace.summary.sceneCount, 0),
    [workspacesByChapterId],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = chapters.filter((chapter) => {
      const matchesQuery =
        !needle || `${chapter.title} ${chapter.sourceText}`.toLocaleLowerCase().includes(needle);
      const status = chapterStatus(workspacesByChapterId.get(chapter.id));
      const matchesStatus = statusFilter === "all" || statusFilter === status;
      return matchesQuery && matchesStatus;
    });

    return [...result].sort((left, right) => {
      if (sortBy === "title") return left.title.localeCompare(right.title, "vi");
      if (sortBy === "words") return wordCount(right.sourceText) - wordCount(left.sourceText);
      if (sortBy === "order") return left.orderIndex - right.orderIndex;
      return right.rowVersion - left.rowVersion;
    });
  }, [chapters, query, sortBy, statusFilter, workspacesByChapterId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedChapters = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (!selected) {
      setTitle("");
      setSourceText("");
      return;
    }
    setTitle(selected.title);
    setSourceText(selected.sourceText);
  }, [selected]);

  const busy =
    createChapter.isPending ||
    generateNarration.isPending ||
    updateChapter.isPending ||
    deleteChapter.isPending ||
    analyzeChapter.isPending;
  const isDirty = selected
    ? title !== selected.title || sourceText !== selected.sourceText
    : Boolean(title.trim() || sourceText.trim());

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
    if (selected) {
      setTitle(selected.title);
      setSourceText(selected.sourceText);
    } else {
      startNew();
    }
  }

  function openEditor() {
    if (isDirty && !window.confirm("Bạn có thay đổi chưa lưu. Rời màn hình này?")) return;
    navigate(`/projects/${projectId}/editor`);
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setSortBy("recent");
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
        const created = await createChapter.mutateAsync({
          storyVersionId: storyVersionId ?? undefined,
          title: title.trim(),
          sourceText,
        });
        setNotice("Chapter mới đã được tạo.");
        if (created?.id) setEditingId(created.id);
      }
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  async function remove(chapter: DesktopChapterDetails) {
    if (!window.confirm(`Xóa chapter “${chapter.title}”?`)) return;
    setNotice(null);
    try {
      await deleteChapter.mutateAsync(chapter.id);
      if (editingId === chapter.id) {
        const remaining = chapters.filter((c) => c.id !== chapter.id);
        if (remaining.length) {
          setEditingId(remaining[0].id);
        } else {
          startNew(false);
        }
      }
      setNotice("Chapter đã được xóa.");
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-background text-foreground select-none">
      {/* 1. Header Banner */}
      <header className="flex items-start justify-between border-b border-border bg-surface-panel px-6 py-4">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">CHAPTER WORKSPACE</span>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-foreground">Chapter Workspace</h1>
          <p className="mt-1 text-xs text-text-secondary">Nội dung được lấy từ backend domain và hiển thị trong cùng một workspace.</p>
        </div>

        {/* Right API Status & Open Editor Button */}
        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs text-text-secondary">
            <span
              className={`size-2 rounded-full ${
                workspaceStatus === "error"
                  ? "bg-danger"
                  : "bg-success shadow-[0_0_8px_var(--success)]"
              }`}
            />
            <span>API status</span>
          </span>

          <Button
            variant="outline"
            onClick={openEditor}
            className="h-8 gap-1.5 border-primary/40 bg-primary-muted px-3 text-xs font-semibold text-primary-hover hover:bg-primary-light"
          >
            <span>Open Editor</span>
            <ChevronRight size={13} />
          </Button>
        </div>
      </header>

      {/* 2. Storyboard Step Flow Navigation Ribbon */}
      <WorkflowRibbon />

      {/* 3. Main 3-Column Content Layout */}
      <div className="grid min-h-0 grid-cols-[minmax(320px,0.9fr)_minmax(460px,1.35fr)_minmax(280px,0.75fr)] gap-3 overflow-hidden p-4">
        {/* ========================================================================= */}
        {/* COLUMN 1: Chapter List Panel                                              */}
        {/* ========================================================================= */}
        <section className="flex flex-col min-h-0 overflow-hidden rounded-lg border border-border bg-surface-panel shadow-[var(--shadow-panel)]">
          <div className="border-b border-border p-4 space-y-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">Chapter List</h2>
              <p className="mt-0.5 text-xs text-text-muted">Quản lý và điều hướng các chapter trong project.</p>
            </div>

            {/* Search Input Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm kiếm chapter..."
                  className="h-8 w-full rounded-md border border-border bg-surface-input px-3 pr-8 text-xs text-foreground placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={13} />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={resetFilters}
                title="Đặt lại bộ lọc"
                className="size-8 border-border bg-surface-input text-text-muted hover:border-border-dark hover:text-foreground"
              >
                <Filter size={13} />
              </Button>
            </div>

            {/* Filter & Sort Dropdowns */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as ChapterFilter);
                  setPage(1);
                }}
                className="h-8 rounded-md border border-border bg-surface-input px-2 text-xs text-text-secondary focus:border-primary focus:outline-none"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="completed">Hoàn thành</option>
                <option value="in_progress">Đang viết</option>
                <option value="draft">Nháp</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ChapterSort)}
                className="h-8 rounded-md border border-border bg-surface-input px-2 text-xs text-text-secondary focus:border-primary focus:outline-none"
              >
                <option value="recent">Sắp xếp: Cập nhật mới nhất</option>
                <option value="order">Sắp xếp: Theo thứ tự</option>
                <option value="title">Sắp xếp: Theo tên A–Z</option>
                <option value="words">Sắp xếp: Nhiều từ nhất</option>
              </select>
            </div>

            {/* Chapter Count Badge */}
            <div className="text-xs text-text-muted">
              <span>{filtered.length} chapter</span>
            </div>
          </div>

          {/* Chapters Scrollable List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
            {paginatedChapters.map((chapter) => {
              const isSelected = editingId === chapter.id;
              const workspaceQuery = workspaceQueriesByChapterId.get(chapter.id);
              const workspace = workspacesByChapterId.get(chapter.id);
              const status = workspaceQuery?.isError ? "error" : chapterStatus(workspace);

              return (
                <div
                  key={chapter.id}
                  onClick={() => selectChapter(chapter.id)}
                  className={`group relative flex items-center justify-between gap-2 rounded-md border p-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary-muted shadow-[var(--shadow-primary)] ring-1 ring-primary/40"
                      : "border-border-subtle bg-surface hover:border-border hover:bg-surface-2"
                  }`}
                >
                  {/* Left: Drag handle & Title */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <GripVertical className="shrink-0 text-text-dim opacity-40 group-hover:opacity-100" size={13} />
                    <div className="min-w-0 flex-1">
                      <strong className={`block truncate text-xs font-semibold ${isSelected ? "text-primary-hover" : "text-foreground"}`}>
                        {chapter.title}
                      </strong>
                      <div className="mt-0.5 flex items-center gap-3 text-[10px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <Clapperboard size={10} />
                          <span>{workspace ? `${workspace.summary.sceneCount} scene` : "Đang tải…"}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText size={10} />
                          <span>{workspace ? `${workspace.summary.visualBeatCount} beat` : "Đang tải…"}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status badge & timestamp & menu */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded px-2 py-0.5 text-[9px] font-medium ${
                        status === "completed"
                          ? "border border-success/30 bg-success-bg text-success"
                        : status === "in_progress"
                            ? "border border-info/30 bg-info-bg text-info"
                            : status === "error"
                              ? "border border-danger/30 bg-danger-bg text-danger"
                            : "border border-border bg-surface-3 text-text-muted"
                      }`}
                    >
                      {chapterStatusLabel(status)}
                    </span>

                    <span className="text-[10px] text-text-dim hidden sm:inline-block">
                      v{chapter.rowVersion}
                    </span>

                    <span aria-hidden="true" className="text-text-dim">
                      <MoreVertical size={13} />
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(chapter);
                      }}
                      disabled={busy}
                      className="size-6 text-text-dim opacity-0 group-hover:opacity-100 hover:text-danger"
                      title={`Xóa chapter ${chapter.title}`}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              );
            })}

            {!filtered.length && (
              <EmptyState
                title="Chưa có chapter phù hợp"
                description={
                  chapters.length
                    ? "Thử đổi bộ lọc hoặc tạo chapter mới."
                    : "Tạo chapter đầu tiên để bắt đầu story flow."
                }
              />
            )}
          </div>

          {/* List Footer Pagination */}
          <div className="border-t border-border px-3 py-2.5 text-xs text-text-muted flex items-center justify-between">
            <span>
              Hiển thị {filtered.length > 0 ? (page - 1) * pageSize + 1 : 0} –{" "}
              {Math.min(page * pageSize, filtered.length)} của {filtered.length} chapter
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-surface-3 text-text-muted disabled:opacity-40"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="px-2 py-0.5 rounded bg-primary-muted text-primary-hover font-semibold text-xs">
                {page}
              </span>
              {totalPages > 1 && (
                <button
                  type="button"
                  onClick={() => setPage(2)}
                  className="px-2 py-0.5 rounded text-xs text-text-muted hover:bg-surface-3"
                >
                  2
                </button>
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded hover:bg-surface-3 text-text-muted disabled:opacity-40"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* COLUMN 2: Form Panel (Tạo / Chỉnh sửa chapter)                            */}
        {/* ========================================================================= */}
        <section className="flex flex-col min-h-0 overflow-hidden rounded-lg border border-border bg-surface-panel shadow-[var(--shadow-panel)]">
          {/* Header */}
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary-hover" size={18} />
              <h2 className="text-base font-bold text-foreground">
                {selected ? "Chỉnh sửa chapter" : "Tạo chapter mới"}
              </h2>
            </div>
            <p className="mt-1 text-xs text-text-muted">Điền thông tin để tạo chapter mới cho project.</p>
          </div>

          {/* Form Fields */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
            {/* Field: Tên chapter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                Tên chapter <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Input
                  name="chapter-title"
                  autoComplete="off"
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tên chapter (ví dụ: Chương 3: Đối đầu)"
                  className="h-9 border-border bg-surface-input pr-16 text-xs text-foreground placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-dim">
                  {title.length} / 120
                </span>
              </div>
            </div>

            {/* Field: Mô tả / Nội dung chapter */}
            <div className="space-y-1.5 flex flex-col flex-1 min-h-[220px]">
              <label className="text-xs font-semibold text-text-secondary">
                Mô tả / Nội dung chapter <span className="text-danger">*</span>
              </label>
              <div className="relative flex flex-1 flex-col rounded-md border border-border bg-surface-input overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Textarea
                  name="chapter-source"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Nhập mô tả hoặc nội dung chapter..."
                  className="flex-1 min-h-[180px] resize-none border-0 bg-transparent p-3 text-xs leading-relaxed text-foreground placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-0"
                />
                <div className="border-t border-border-subtle bg-surface-2 px-3 py-1.5 flex items-center justify-between text-[10px] text-text-dim">
                  <span>{wordCount(sourceText).toLocaleString("vi-VN")} từ</span>
                  <span>{Math.min(100, Math.round((sourceText.length / 5000) * 100))}%</span>
                </div>
              </div>
            </div>

            {/* Info Callout Box */}
            <div className="flex items-start gap-2 rounded-md border border-info/20 bg-info-bg p-3 text-xs leading-relaxed text-text-secondary">
              <Info className="mt-0.5 shrink-0 text-info" size={15} />
              <span>Sau khi tạo chapter, bạn có thể tiếp tục phân tích, tạo scene và visual beat.</span>
            </div>

            {/* Audio generation */}
            <div className="space-y-3 rounded-md border border-primary/25 bg-primary-muted/30 p-3">
              <div className="flex items-start gap-2">
                <AudioLines className="mt-0.5 shrink-0 text-primary-hover" size={16} />
                <div>
                  <h3 className="text-xs font-bold text-foreground">Tạo audio cho chapter</h3>
                  <p className="mt-1 text-[10px] leading-4 text-text-secondary">
                    Chọn giọng đọc và gửi nội dung chapter đến dịch vụ narration.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
                <label className="grid gap-1 text-[10px] text-text-secondary">
                  <span>Voice</span>
                  <select
                    aria-label="Voice đọc chapter"
                    value={voiceId}
                    onChange={(event) => setVoiceId(event.target.value)}
                    disabled={!selected || !voices.length || busy}
                    className="h-8 rounded-md border border-border bg-surface-input px-2 text-xs text-foreground disabled:opacity-50"
                  >
                    {!voices.length && <option value="">Chưa có voice</option>}
                    {voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} · {voice.language}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[10px] text-text-secondary">
                  <span>Tốc độ</span>
                  <Input
                    aria-label="Tốc độ đọc"
                    type="number"
                    min="0.25"
                    max="2"
                    step="0.05"
                    value={speakingRate}
                    onChange={(event) => setSpeakingRate(event.target.value)}
                    disabled={!selected || busy}
                    className="h-8 border-border bg-surface-input text-xs"
                  />
                </label>
              </div>

              <Button
                type="button"
                onClick={() => void createAudio()}
                disabled={!selected || !voiceId || !sourceText.trim() || busy}
                className="h-8 w-full gap-1.5 bg-primary text-xs font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                <AudioLines size={13} />
                {generateNarration.isPending ? "Đang gửi…" : "Tạo audio"}
              </Button>

              <div className="border-t border-primary/15 pt-2 text-[10px] text-text-secondary">
                <span>Trạng thái audio: </span>
                <strong className="text-foreground">
                  {selectedWorkspace
                    ? audioStatusLabel(selectedWorkspace.pipeline.audio.status)
                    : selectedWorkspaceQuery?.isError
                      ? "Không tải được"
                      : "Đang tải…"}
                </strong>
                {selectedWorkspace?.pipeline.audio.audioUrl && (
                  <audio
                    className="mt-2 h-8 w-full"
                    controls
                    preload="none"
                    src={selectedWorkspace.pipeline.audio.audioUrl}
                  />
                )}
              </div>
            </div>

            {/* Form Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={cancelEditing}
                disabled={busy}
                className="h-9 flex-1 border-border bg-surface-input text-xs font-semibold text-text-secondary hover:border-border-dark hover:text-foreground"
              >
                Hủy
              </Button>

              <Button
                onClick={() => void save()}
                disabled={!title.trim() || !sourceText.trim() || busy}
                className="h-9 flex-1 gap-1.5 bg-primary text-xs font-bold text-primary-foreground shadow-[var(--shadow-primary)] hover:bg-primary-hover disabled:opacity-50"
              >
                <Sparkles size={13} />
                <span>{busy ? "Đang lưu…" : selected ? "Lưu thay đổi" : "Tạo chapter"}</span>
              </Button>
            </div>
            {notice && <p className="text-xs text-text-secondary" role="status">{notice}</p>}

            {/* Next Steps Container */}
            <div className="border-t border-border pt-4 space-y-2.5">
              <span className="text-[11px] font-semibold text-text-muted block">
                Các hành động tiếp theo (sẽ sau khi tạo)
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Card 1: Phân tích chapter */}
                <div
                  onClick={() => {
                    if (selected) void analyzeChapter.mutateAsync(selected.id);
                  }}
                  className="rounded-md border border-border bg-surface p-3 transition-all hover:border-primary/50 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-primary-hover font-semibold text-xs">
                    <Sparkles size={13} />
                    <span>Phân tích chapter</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-text-muted">
                    Phân tích nội dung và gợi ý cấu trúc
                  </p>
                </div>

                {/* Card 2: Tạo scene */}
                <div
                  onClick={openEditor}
                  className="rounded-md border border-border bg-surface p-3 transition-all hover:border-primary/50 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-text-secondary font-semibold text-xs">
                    <Clapperboard size={13} />
                    <span>Tạo scene</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-text-muted">
                    Tạo các scene từ nội dung chapter
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* COLUMN 3: Workspace Context Panel                                         */}
        {/* ========================================================================= */}
        <aside className="flex flex-col min-h-0 overflow-y-auto rounded-lg border border-border bg-surface-panel shadow-[var(--shadow-panel)]">
          {/* Header */}
          <div className="border-b border-border p-4 space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">WORKSPACE CONTEXT</span>
              <div className="mt-1 flex items-center gap-2">
                <Folder className="text-primary-hover" size={16} />
                <h2 className="text-sm font-bold text-foreground">Chapters</h2>
              </div>
            </div>

            {/* Project Picker */}
            <div className="space-y-1">
              <span className="text-[10px] text-text-muted">Project</span>
              <div className="flex h-8 items-center justify-between rounded-md border border-border bg-surface-input px-3 text-xs text-foreground">
                <span className="truncate">{projectName}</span>
                <ChevronRight className="rotate-90 text-text-muted" size={13} />
              </div>
            </div>

            {/* Metrics List */}
            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center justify-between text-text-secondary">
                <span>Tổng chapter</span>
                <strong className="font-mono text-foreground">{chapters.length}</strong>
              </div>
              <div className="flex items-center justify-between text-text-secondary">
                <span>Chapter hoàn thành</span>
                <strong className="font-mono text-foreground">{chapterWorkspaceStatsReady ? completedCount : "—"}</strong>
              </div>
              <div className="flex items-center justify-between text-text-secondary">
                <span>Đang viết</span>
                <strong className="font-mono text-foreground">{chapterWorkspaceStatsReady ? inProgressCount : "—"}</strong>
              </div>
              <div className="flex items-center justify-between text-text-secondary">
                <span>Nháp</span>
                <strong className="font-mono text-foreground">{chapterWorkspaceStatsReady ? draftCount : "—"}</strong>
              </div>
              <div className="flex items-center justify-between text-text-secondary">
                <span>Tổng từ</span>
                <strong className="font-mono text-foreground">{totalWords.toLocaleString("vi-VN")} từ</strong>
              </div>
              <div className="flex items-center justify-between text-text-secondary">
                <span>Tổng scene</span>
                <strong className="font-mono text-foreground">{chapterWorkspaceStatsReady ? totalSceneCount : "—"}</strong>
              </div>
            </div>
          </div>

          {/* Quick Tips Box */}
          <div className="p-4 space-y-3 flex-1">
            <div className="rounded-md border border-warning/20 bg-warning-bg p-3 text-xs leading-relaxed text-text-secondary">
              <div className="flex items-center gap-1.5 font-bold text-warning">
                <Lightbulb size={14} />
                <span>Mẹo nhanh</span>
              </div>
              <ul className="mt-2 space-y-2 text-[11px] text-text-secondary">
                <li>• Tạo chapter rõ ràng, có cấu trúc giúp phân tích và tạo scene chính xác hơn.</li>
                <li>• Mỗi chapter nên tập trung vào một mục tiêu hoặc bước phát triển chính của câu chuyện.</li>
                <li>• Sau khi tạo, hãy phân tích để hệ thống gợi ý cấu trúc scene tối ưu.</li>
              </ul>
            </div>

            {/* Render status from the selected chapter workspace */}
            <div className="rounded-md border border-border bg-surface p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">RENDER STATUS</span>
                  <h3 className="mt-0.5 text-xs font-bold text-foreground">Production render</h3>
                </div>
                <span className="rounded bg-surface-3 px-2 py-1 text-[10px] font-bold text-text-muted">
                  {selectedWorkspace
                    ? pipelineStatusLabel(selectedWorkspace.pipeline.render.status)
                    : selectedWorkspaceQuery?.isError
                      ? "Không tải được"
                      : "Đang tải…"}
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {selectedWorkspace?.pipeline.render.latestJobId
                  ? `Job: ${selectedWorkspace.pipeline.render.latestJobId}`
                  : selected
                    ? "Chapter này chưa có render job."
                    : "Chọn một chapter để xem trạng thái render."}
              </p>
              <p className="text-[11px] leading-4 text-text-secondary">
                Timeline chuẩn bị sẵn sàng để render. Kiểm tra audio, asset và chapter state.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate(`/projects/${projectId}/render`)}
                className="h-8 w-full gap-1.5 border-border bg-surface-input text-xs text-text-secondary hover:border-primary/50 hover:text-foreground"
              >
                <Clapperboard size={12} />
                <span>Open Render Queue</span>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WorkflowRibbon() {
  const steps = [
    { label: "Story", icon: BookOpen, active: false },
    { label: "Chapter", icon: FileText, active: true },
    { label: "Scene", icon: Clapperboard, active: false },
    { label: "Visual Beat", icon: WandSparkles, active: false },
  ];

  return (
    <div className="border-b border-border bg-surface-panel px-6 py-2.5">
      <div className="flex max-w-2xl items-center gap-3 text-xs text-text-muted">
        {steps.map(({ label, active }, index) => (
          <div key={label} className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? "border border-primary/50 bg-primary-muted text-primary-hover shadow-[0_0_8px_var(--primary-light)]"
                  : "text-text-muted"
              }`}
            >
              <span className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-text-dim"}`} />
              <span>{label}</span>
            </div>
            {index < steps.length - 1 && <span className="text-border-dark">⋯⋯</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

type ChapterDisplayStatus = "completed" | "in_progress" | "draft" | "loading" | "error";

function chapterStatus(workspace: DesktopChapterWorkspace | undefined): ChapterDisplayStatus {
  if (!workspace) return "loading";
  if (workspace.pipeline.sourceOutdated) return "in_progress";
  if (workspace.pipeline.analysis.status === "COMPLETED") return "completed";
  if (["QUEUED", "RUNNING", "STALLED", "UNKNOWN"].includes(workspace.pipeline.analysis.status)) {
    return "in_progress";
  }
  return "draft";
}

function chapterStatusLabel(status: ChapterDisplayStatus) {
  if (status === "completed") return "Hoàn thành";
  if (status === "in_progress") return "Đang xử lý";
  if (status === "error") return "Không tải được";
  if (status === "loading") return "Đang tải…";
  return "Nháp";
}

function pipelineStatusLabel(status: string) {
  if (status === "COMPLETED" || status === "READY") return "Hoàn thành";
  if (["QUEUED", "RUNNING", "GENERATING", "STALLED", "UNKNOWN"].includes(status)) {
    return "Đang chạy";
  }
  if (status === "FAILED") return "Thất bại";
  return "Chưa bắt đầu";
}

function audioStatusLabel(status: string) {
  if (status === "READY" || status === "COMPLETED") return "Sẵn sàng";
  if (["QUEUED", "RUNNING", "GENERATING", "STALLED", "UNKNOWN"].includes(status)) {
    return "Đang xử lý";
  }
  if (status === "FAILED") return "Thất bại";
  return "Chưa tạo";
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Thao tác chapter thất bại.";
}
