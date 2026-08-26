import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  DesktopChapterDetails,
  DesktopChapterWorkspace,
  DesktopTimeline,
  DesktopVoice,
} from "@narrativex/client-contracts";
import {
  AudioLines,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  FileText,
  Filter,
  Folder,
  Info,
  Lightbulb,
  PencilLine,
  Plus,
  Search,
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

type WorkspaceStatus = "loading" | "ready" | "partial" | "empty" | "error";

export function ChaptersScreen({
  projectId,
  projectName,
  storyVersionId,
  chapters,
  voices,
  timeline,
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
  timeline: DesktopTimeline | null;
  workspaceStatus: WorkspaceStatus;
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
  const [isCreating, setIsCreating] = useState(false);
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

  useEffect(() => {
    if (workspaceStatus === "loading") return;
    if (!chapters.length) {
      setEditingId(null);
      setIsCreating(true);
      return;
    }
    if (isCreating) return;
    if (!editingId || !chapters.some((chapter) => chapter.id === editingId)) {
      setEditingId(chapters[0].id);
    }
  }, [chapters, editingId, isCreating, workspaceStatus]);

  useEffect(() => {
    if (!voices.some((voice) => voice.id === voiceId)) {
      setVoiceId(voices[0]?.id ?? "");
    }
  }, [voiceId, voices]);

  const selected = isCreating
    ? null
    : chapters.find((chapter) => chapter.id === editingId) ?? null;

  const baseChapters = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = chapters.filter((chapter) => {
      if (!needle) return true;
      return `${chapter.title} ${chapter.sourceText}`.toLocaleLowerCase().includes(needle);
    });

    return [...result].sort((left, right) => {
      if (sortBy === "title") return left.title.localeCompare(right.title, "vi");
      if (sortBy === "words") return wordCount(right.sourceText) - wordCount(left.sourceText);
      if (sortBy === "order") return left.orderIndex - right.orderIndex;
      return right.rowVersion - left.rowVersion;
    });
  }, [chapters, query, sortBy]);

  const visibleCandidates = useMemo(() => {
    const start = (page - 1) * pageSize;
    return baseChapters.slice(start, start + pageSize);
  }, [baseChapters, page]);

  const workspaceTargets = useMemo(() => {
    if (statusFilter !== "all") return chapters;
    const ids = new Set(visibleCandidates.map((chapter) => chapter.id));
    if (selected) ids.add(selected.id);
    return chapters.filter((chapter) => ids.has(chapter.id));
  }, [chapters, selected, statusFilter, visibleCandidates]);

  const chapterWorkspaceQueries = useChapterWorkspacesQuery(
    projectId,
    workspaceTargets,
    selected?.id,
  );

  const workspacesByChapterId = useMemo(() => {
    const workspaces = new Map<string, DesktopChapterWorkspace>();
    workspaceTargets.forEach((chapter, index) => {
      const data = chapterWorkspaceQueries[index]?.data;
      if (data) workspaces.set(chapter.id, data);
    });
    return workspaces;
  }, [chapterWorkspaceQueries, workspaceTargets]);

  const workspaceQueriesByChapterId = useMemo(
    () =>
      new Map(
        workspaceTargets.map((chapter, index) => [chapter.id, chapterWorkspaceQueries[index]]),
      ),
    [chapterWorkspaceQueries, workspaceTargets],
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return baseChapters;
    return baseChapters.filter(
      (chapter) => chapterStatus(workspacesByChapterId.get(chapter.id)) === statusFilter,
    );
  }, [baseChapters, statusFilter, workspacesByChapterId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), totalPages));
  }, [totalPages]);

  const paginatedChapters = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const selectedWorkspace = selected ? workspacesByChapterId.get(selected.id) : undefined;
  const selectedWorkspaceQuery = selected
    ? workspaceQueriesByChapterId.get(selected.id)
    : undefined;

  useEffect(() => {
    if (!selected) {
      if (!isCreating) {
        setTitle("");
        setSourceText("");
      }
      return;
    }
    setTitle(selected.title);
    setSourceText(selected.sourceText);
  }, [isCreating, selected]);

  const analyzeChapter = useMutation({
    mutationFn: (chapterId: string) => generationApi.analyze(projectId, chapterId),
    onSuccess: async (_job, chapterId) => {
      await queryClient.invalidateQueries({
        queryKey: chapterQueryKeys.workspace(projectId, chapterId),
      });
      if (editingId === chapterId) setNotice("Phân tích chapter đã được gửi.");
    },
    onError: (error) => setNotice(toMessage(error)),
  });

  const busy =
    createChapter.isPending ||
    generateNarration.isPending ||
    updateChapter.isPending ||
    deleteChapter.isPending ||
    analyzeChapter.isPending;

  const isDirty = selected
    ? title !== selected.title || sourceText !== selected.sourceText
    : Boolean(title.trim() || sourceText.trim());

  const totalWords = useMemo(
    () => chapters.reduce((total, chapter) => total + wordCount(chapter.sourceText), 0),
    [chapters],
  );

  const totalSceneCount = useMemo(() => {
    if (!timeline) return null;
    return new Set(timeline.beats.map((beat) => `${beat.chapterId}:${beat.sceneIndex}`)).size;
  }, [timeline]);

  const totalBeatCount = timeline?.beats.length ?? null;
  const audioReadyCount = timeline?.chapters.filter((chapter) => chapter.audioReady).length ?? null;
  const renderReadyCount =
    timeline?.chapters.filter((chapter) => chapter.readyForRender).length ?? null;

  function beginCreate() {
    if (isDirty && !window.confirm("Bạn có thay đổi chưa lưu. Bỏ thay đổi để tạo chapter mới?")) {
      return;
    }
    setEditingId(null);
    setIsCreating(true);
    setTitle("");
    setSourceText("");
    setNotice(null);
  }

  function selectChapter(chapterId: string) {
    if (isDirty && !window.confirm("Bạn có thay đổi chưa lưu. Bỏ thay đổi để mở chapter khác?")) {
      return;
    }
    setIsCreating(false);
    setNotice(null);
    setEditingId(chapterId);
  }

  function cancelEditing() {
    if (isDirty && !window.confirm("Bỏ các thay đổi chưa lưu?")) return;
    if (selected) {
      setTitle(selected.title);
      setSourceText(selected.sourceText);
      return;
    }
    if (chapters.length) {
      setIsCreating(false);
      setEditingId(chapters[0].id);
      return;
    }
    setTitle("");
    setSourceText("");
  }

  function openEditor() {
    if (isDirty && !window.confirm("Bạn có thay đổi chưa lưu. Rời màn hình này?")) return;
    navigate(`/projects/${projectId}/editor`);
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setSortBy("recent");
    setPage(1);
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
        setIsCreating(false);
        if (created?.id) setEditingId(created.id);
      }
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  async function createAudio() {
    if (!selected || !voiceId || busy || isDirty) return;
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
        queryClient.invalidateQueries({
          queryKey: chapterQueryKeys.workspace(projectId, selected.id),
        }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
      ]);
      setNotice(`Đã gửi tạo audio. Job ${job.jobId.slice(0, 8)} đang được xử lý.`);
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
        const remaining = chapters.filter((candidate) => candidate.id !== chapter.id);
        if (remaining.length) {
          setIsCreating(false);
          setEditingId(remaining[0].id);
        } else {
          setEditingId(null);
          setIsCreating(true);
          setTitle("");
          setSourceText("");
        }
      }
      setNotice("Chapter đã được xóa.");
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  const generationBlockedByUnsavedChanges = Boolean(selected && isDirty);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-background text-foreground select-none">
      <header className="flex items-start justify-between border-b border-border bg-surface-panel px-6 py-4">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            CHAPTER WORKSPACE
          </span>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-foreground">
            Chapter Workspace
          </h1>
          <p className="mt-1 text-xs text-text-secondary">
            Tạo, chỉnh sửa và chuẩn bị chapter trước khi phân tích hoặc tạo media.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs text-text-secondary">
            <span className={`size-2 rounded-full ${workspaceStatusDotClass(workspaceStatus)}`} />
            <span>{workspaceStatusLabel(workspaceStatus)}</span>
          </span>
          <Button
            variant="outline"
            onClick={openEditor}
            className="h-8 gap-1.5 border-border bg-surface-input px-3 text-xs font-semibold text-text-secondary hover:border-primary/55 hover:bg-surface-2 hover:text-primary-hover"
          >
            <span>Open Editor</span>
            <ChevronRight size={13} />
          </Button>
        </div>
      </header>

      <WorkflowRibbon />

      <div className="grid min-h-0 grid-cols-[minmax(320px,0.9fr)_minmax(460px,1.35fr)_minmax(280px,0.75fr)] gap-3 overflow-hidden p-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface-panel">
          <div className="space-y-3 border-b border-border p-4">
            <div>
              <h2 className="text-sm font-bold text-foreground">Chapter List</h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Quản lý và điều hướng các chapter trong project.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm kiếm chapter..."
                  className="h-8 w-full rounded-md border border-border bg-surface-input px-3 pr-8 text-xs text-foreground placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Search
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                  size={13}
                />
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

            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as ChapterFilter);
                  setPage(1);
                }}
                className="h-8 rounded-md border border-border bg-surface-input px-2 text-xs text-text-secondary focus:border-primary focus:outline-none"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="completed">Hoàn thành</option>
                <option value="in_progress">Đang xử lý</option>
                <option value="draft">Nháp</option>
              </select>
              <select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as ChapterSort);
                  setPage(1);
                }}
                className="h-8 rounded-md border border-border bg-surface-input px-2 text-xs text-text-secondary focus:border-primary focus:outline-none"
              >
                <option value="recent">Cập nhật mới nhất</option>
                <option value="order">Theo thứ tự</option>
                <option value="title">Theo tên A–Z</option>
                <option value="words">Nhiều từ nhất</option>
              </select>
            </div>

            {statusFilter !== "all" && (
              <p className="text-[10px] leading-4 text-text-muted">
                Bộ lọc trạng thái tải workspace của toàn bộ chapter theo yêu cầu; polling nền vẫn chỉ chạy cho chapter đang chọn.
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {paginatedChapters.map((chapter) => {
              const isSelected = !isCreating && editingId === chapter.id;
              const workspaceQuery = workspaceQueriesByChapterId.get(chapter.id);
              const workspace = workspacesByChapterId.get(chapter.id);
              const status = workspaceQuery?.isError ? "error" : chapterStatus(workspace);

              return (
                <div
                  key={chapter.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectChapter(chapter.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectChapter(chapter.id);
                    }
                  }}
                  className={`group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border p-2.5 text-left transition-colors ${
                    isSelected
                      ? "border-primary/65 border-l-2 border-l-primary bg-primary-muted/55"
                      : "border-border-subtle bg-surface hover:border-border hover:bg-surface-2"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <strong
                      className={`block truncate text-xs font-semibold ${
                        isSelected ? "text-primary-hover" : "text-foreground"
                      }`}
                    >
                      {chapter.title}
                    </strong>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-text-muted">
                      <span>{wordCount(chapter.sourceText).toLocaleString("vi-VN")} từ</span>
                      <span>v{chapter.rowVersion}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[9px] font-medium ${chapterStatusClass(status)}`}>
                      {chapterStatusLabel(status)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation();
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

          <div className="flex items-center justify-between border-t border-border px-3 py-2.5 text-xs text-text-muted">
            <span>
              Hiển thị {filtered.length > 0 ? (page - 1) * pageSize + 1 : 0} –{" "}
              {Math.min(page * pageSize, filtered.length)} của {filtered.length} chapter
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
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
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-text-muted hover:bg-surface-3 disabled:opacity-40"
                aria-label="Trang sau"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface-panel">
          <div className="flex items-start justify-between gap-3 border-b border-border p-5">
            <div>
              <div className="flex items-center gap-2">
                <PencilLine className="text-text-secondary" size={18} />
                <h2 className="text-base font-bold text-foreground">
                  {selected ? "Chỉnh sửa chapter" : "Tạo chapter mới"}
                </h2>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {selected
                  ? "Lưu thay đổi trước khi chạy các bước phân tích hoặc tạo audio."
                  : "Nhập nội dung chapter rồi lưu để tiếp tục pipeline."}
              </p>
            </div>
            {selected && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={beginCreate}
                disabled={busy}
                className="h-8 gap-1.5 text-xs"
              >
                <Plus size={13} />
                Chapter mới
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
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
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Nhập tên chapter"
                  className="h-9 border-border bg-surface-input pr-16 text-xs"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-dim">
                  {title.length} / 120
                </span>
              </div>
            </div>

            <div className="flex min-h-[240px] flex-col space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                Nội dung chapter <span className="text-danger">*</span>
              </label>
              <div className="relative flex flex-1 flex-col overflow-hidden rounded-md border border-border bg-surface-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Textarea
                  name="chapter-source"
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder="Nhập nội dung chapter..."
                  className="min-h-[200px] flex-1 resize-none border-0 bg-transparent p-3 text-xs leading-relaxed focus-visible:ring-0"
                />
                <div className="flex items-center justify-between border-t border-border-subtle bg-surface-2 px-3 py-1.5 text-[10px] text-text-dim">
                  <span>{wordCount(sourceText).toLocaleString("vi-VN")} từ</span>
                  <span>{sourceText.length.toLocaleString("vi-VN")} ký tự</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-info/20 bg-info-bg p-3 text-xs leading-relaxed text-text-secondary">
              <Info className="mt-0.5 shrink-0 text-info" size={15} />
              <span>
                Phân tích và tạo audio luôn dùng bản chapter đã lưu trên backend, không dùng nội dung nháp chưa lưu trong form.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={cancelEditing}
                disabled={busy}
                className="h-9 flex-1 border-border bg-surface-input text-xs font-semibold text-text-secondary"
              >
                Hủy
              </Button>
              <Button
                onClick={() => void save()}
                disabled={!title.trim() || !sourceText.trim() || busy || !isDirty}
                className="h-9 flex-1 gap-1.5 text-xs font-bold"
              >
                <PencilLine size={13} />
                <span>{busy ? "Đang lưu…" : selected ? "Lưu thay đổi" : "Tạo chapter"}</span>
              </Button>
            </div>

            {notice && (
              <p className="text-xs text-text-secondary" role="status">
                {notice}
              </p>
            )}

            <div className="space-y-3 rounded-md border border-border bg-surface p-3">
              <div className="flex items-start gap-2">
                <AudioLines className="mt-0.5 shrink-0 text-text-secondary" size={16} />
                <div>
                  <h3 className="text-xs font-bold text-foreground">Tạo audio cho chapter</h3>
                  <p className="mt-1 text-[10px] leading-4 text-text-secondary">
                    Chọn giọng đọc và gửi chapter đã lưu đến narration worker.
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
                disabled={!selected || !voiceId || busy || generationBlockedByUnsavedChanges}
                className="h-8 w-full gap-1.5 text-xs font-bold"
              >
                <AudioLines size={13} />
                {generateNarration.isPending ? "Đang gửi…" : "Tạo audio"}
              </Button>

              {generationBlockedByUnsavedChanges && (
                <p className="text-[10px] leading-4 text-warning">
                  Hãy lưu thay đổi trước khi tạo audio hoặc phân tích chapter.
                </p>
              )}

              <div className="border-t border-border-subtle pt-2 text-[10px] text-text-secondary">
                <span>Trạng thái audio: </span>
                <strong className="text-foreground">
                  {selectedWorkspace
                    ? audioStatusLabel(selectedWorkspace.pipeline.audio.status)
                    : selectedWorkspaceQuery?.isError
                      ? "Không tải được"
                      : selected
                        ? "Đang tải…"
                        : "Chưa có chapter"}
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

            <div className="space-y-2.5 border-t border-border pt-4">
              <span className="block text-[11px] font-semibold text-text-muted">
                Các hành động tiếp theo
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selected || busy || generationBlockedByUnsavedChanges}
                  onClick={() => {
                    if (selected) analyzeChapter.mutate(selected.id);
                  }}
                  className="h-auto items-start justify-start rounded-md border-border bg-surface p-3 text-left hover:border-border-dark hover:bg-surface-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-hover">
                      <WandSparkles size={13} />
                      <span>Phân tích chapter</span>
                    </div>
                    <p className="mt-1 text-[10px] font-normal leading-4 text-text-muted">
                      Phân tích nội dung và tạo cấu trúc scene/beat.
                    </p>
                  </div>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selected || busy}
                  onClick={openEditor}
                  className="h-auto items-start justify-start rounded-md border-border bg-surface p-3 text-left hover:border-border-dark hover:bg-surface-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                      <Clapperboard size={13} />
                      <span>Mở Editor</span>
                    </div>
                    <p className="mt-1 text-[10px] font-normal leading-4 text-text-muted">
                      Chỉnh scene, visual beat và media trên timeline.
                    </p>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col overflow-y-auto rounded-md border border-border bg-surface-panel">
          <div className="space-y-3 border-b border-border p-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                WORKSPACE CONTEXT
              </span>
              <div className="mt-1 flex items-center gap-2">
                <Folder className="text-primary-hover" size={16} />
                <h2 className="text-sm font-bold text-foreground">Chapters</h2>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-text-muted">Project</span>
              <div className="flex h-8 items-center justify-between rounded-md border border-border bg-surface-input px-3 text-xs text-foreground">
                <span className="truncate">{projectName}</span>
              </div>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <Metric label="Tổng chapter" value={chapters.length} />
              <Metric label="Tổng từ" value={`${totalWords.toLocaleString("vi-VN")} từ`} />
              <Metric label="Tổng scene" value={totalSceneCount ?? "—"} />
              <Metric label="Tổng visual beat" value={totalBeatCount ?? "—"} />
              <Metric label="Audio sẵn sàng" value={audioReadyCount ?? "—"} />
              <Metric label="Chapter sẵn sàng render" value={renderReadyCount ?? "—"} />
            </div>
          </div>

          <div className="flex-1 space-y-3 p-4">
            <div className="rounded-md border border-warning/20 bg-warning-bg p-3 text-xs leading-relaxed text-text-secondary">
              <div className="flex items-center gap-1.5 font-bold text-warning">
                <Lightbulb size={14} />
                <span>Mẹo nhanh</span>
              </div>
              <ul className="mt-2 space-y-2 text-[11px] text-text-secondary">
                <li>• Lưu chapter trước khi chạy tác vụ AI/media.</li>
                <li>• Status filter chỉ tải toàn bộ workspace khi bạn thực sự dùng bộ lọc đó.</li>
                <li>• Narration là master clock cho timeline render.</li>
              </ul>
            </div>

            <div className="space-y-2.5 rounded-md border border-border bg-surface p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
                    RENDER STATUS
                  </span>
                  <h3 className="mt-0.5 text-xs font-bold text-foreground">Production render</h3>
                </div>
                <span className="rounded bg-surface-3 px-2 py-1 text-[10px] font-bold text-text-muted">
                  {selectedWorkspace
                    ? pipelineStatusLabel(selectedWorkspace.pipeline.render.status)
                    : selectedWorkspaceQuery?.isError
                      ? "Không tải được"
                      : selected
                        ? "Đang tải…"
                        : "Chưa chọn"}
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {selectedWorkspace?.pipeline.render.latestJobId
                  ? `Job: ${selectedWorkspace.pipeline.render.latestJobId}`
                  : selected
                    ? "Chapter này chưa có render job."
                    : "Chọn một chapter để xem trạng thái render."}
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

function Metric({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return (
    <div className="flex items-center justify-between text-text-secondary">
      <span>{label}</span>
      <strong className="font-mono text-foreground">{value}</strong>
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
              className={`flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-b-2 border-primary bg-transparent text-primary-hover"
                  : "text-text-muted"
              }`}
            >
              <span className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-text-dim"}`} />
              <span>{label}</span>
            </div>
            {index < steps.length - 1 && (
              <span aria-hidden="true" className="w-7 border-t border-dashed border-border-dark" />
            )}
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

function chapterStatusClass(status: ChapterDisplayStatus) {
  if (status === "completed") return "border border-success/30 bg-success-bg text-success";
  if (status === "in_progress") return "border border-info/30 bg-info-bg text-info";
  if (status === "error") return "border border-danger/30 bg-danger-bg text-danger";
  return "border border-border bg-surface-3 text-text-muted";
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

function workspaceStatusDotClass(status: WorkspaceStatus) {
  if (status === "ready") return "bg-success";
  if (status === "error") return "bg-danger";
  if (status === "partial") return "bg-warning";
  if (status === "loading") return "bg-info";
  return "bg-text-muted";
}

function workspaceStatusLabel(status: WorkspaceStatus) {
  if (status === "ready") return "API ready";
  if (status === "error") return "API error";
  if (status === "partial") return "API partial";
  if (status === "loading") return "API loading";
  return "API empty";
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Thao tác chapter thất bại.";
}
