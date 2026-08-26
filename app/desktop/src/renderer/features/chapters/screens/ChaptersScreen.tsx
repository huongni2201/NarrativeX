import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DesktopChapterDetails,
  DesktopChapterWorkspace,
  DesktopTimeline,
  DesktopVoice,
} from "@narrativex/client-contracts";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/errors";
import { generationApi } from "../../generation/api/generation.api";
import { useGenerateNarration } from "../../generation/queries/narration.queries";
import { ChapterEditorPanel } from "../components/ChapterEditorPanel";
import { ChapterListPanel } from "../components/ChapterListPanel";
import { ChapterWorkflowRibbon } from "../components/ChapterWorkflowRibbon";
import { ChapterWorkspaceContext } from "../components/ChapterWorkspaceContext";
import {
  chapterStatus,
  isAudioProcessingStatus,
  isGenerationJobTerminal,
  type ChapterFilter,
  type ChapterSort,
  type WorkspaceStatus,
  wordCount,
  workspaceStatusDotClass,
  workspaceStatusLabel,
} from "../model/chapter-ui";
import {
  chapterQueryKeys,
  useChapterWorkspacesQuery,
  useCreateChapter,
  useDeleteChapter,
  useUpdateChapter,
} from "../queries/chapters.queries";

type TrackedNarrationJob = {
  jobId: string;
  chapterId: string;
};

const PAGE_SIZE = 8;

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
  const [narrationJob, setNarrationJob] = useState<TrackedNarrationJob | null>(null);

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
    const start = (page - 1) * PAGE_SIZE;
    return baseChapters.slice(start, start + PAGE_SIZE);
  }, [baseChapters, page]);

  const workspaceTargets = useMemo(() => {
    if (statusFilter !== "all") return chapters;
    const ids = new Set(visibleCandidates.map((chapter) => chapter.id));
    if (selected) ids.add(selected.id);
    if (narrationJob) ids.add(narrationJob.chapterId);
    return chapters.filter((chapter) => ids.has(chapter.id));
  }, [chapters, narrationJob, selected, statusFilter, visibleCandidates]);

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

  const workspaceErrorsByChapterId = useMemo(
    () =>
      new Set(
        workspaceTargets
          .filter((_chapter, index) => chapterWorkspaceQueries[index]?.isError)
          .map((chapter) => chapter.id),
      ),
    [chapterWorkspaceQueries, workspaceTargets],
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return baseChapters;
    return baseChapters.filter(
      (chapter) => chapterStatus(workspacesByChapterId.get(chapter.id)) === statusFilter,
    );
  }, [baseChapters, statusFilter, workspacesByChapterId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), totalPages));
  }, [totalPages]);

  const paginatedChapters = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const selectedWorkspace = selected ? workspacesByChapterId.get(selected.id) : undefined;
  const selectedWorkspaceQuery = selected
    ? workspaceQueriesByChapterId.get(selected.id)
    : undefined;
  const selectedAudioStatus = selectedWorkspace?.pipeline.audio.status ?? null;
  const selectedAudioProcessing = isAudioProcessingStatus(selectedAudioStatus);
  const trackedNarrationForSelected = Boolean(
    selected && narrationJob?.chapterId === selected.id,
  );
  const audioBusy =
    generateNarration.isPending || selectedAudioProcessing || trackedNarrationForSelected;
  const audioReady = selectedAudioStatus === "READY" || selectedAudioStatus === "COMPLETED";

  const narrationJobQuery = useQuery({
    queryKey: ["generation-jobs", narrationJob?.jobId ?? "none"],
    queryFn: () => generationApi.getGenerationJob(narrationJob!.jobId),
    enabled: Boolean(narrationJob?.jobId),
    refetchInterval: (jobQuery) =>
      isGenerationJobTerminal(jobQuery.state.data?.status) ? false : 1500,
  });

  const narrationJobStatus = narrationJobQuery.data?.status;
  const narrationJobErrorCode = narrationJobQuery.data?.errorCode;

  useEffect(() => {
    if (!narrationJob || !isGenerationJobTerminal(narrationJobStatus)) return;

    const completedJob = narrationJob;
    const completedStatus = narrationJobStatus;
    const completedErrorCode = narrationJobErrorCode;

    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: chapterQueryKeys.workspace(projectId, completedJob.chapterId),
      }),
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
    ]).finally(() => {
      setNarrationJob((current) =>
        current?.jobId === completedJob.jobId ? null : current,
      );
      if (editingId !== completedJob.chapterId) return;

      if (completedStatus === "COMPLETED") {
        setNotice("Audio đã tạo xong. Bạn có thể nghe ngay bên dưới.");
        return;
      }

      setNotice(
        completedErrorCode
          ? `Tạo audio thất bại: ${completedErrorCode}`
          : "Tạo audio không hoàn tất. Bạn có thể thử lại.",
      );
    });
  }, [
    editingId,
    narrationJob,
    narrationJobErrorCode,
    narrationJobStatus,
    projectId,
    queryClient,
  ]);

  useEffect(() => {
    if (!narrationJob || !narrationJobQuery.isError) return;
    const failedTrackingJob = narrationJob;
    setNarrationJob(null);
    void queryClient.invalidateQueries({
      queryKey: chapterQueryKeys.workspace(projectId, failedTrackingJob.chapterId),
    });
    if (editingId === failedTrackingJob.chapterId) {
      setNotice("Không thể theo dõi job tạo audio. Đã tải lại trạng thái chapter.");
    }
  }, [editingId, narrationJob, narrationJobQuery.isError, projectId, queryClient]);

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
    onError: (error) => setNotice(toErrorMessage(error, "Phân tích chapter thất bại.")),
  });

  const saveBusy = createChapter.isPending || updateChapter.isPending;
  const busy =
    saveBusy ||
    generateNarration.isPending ||
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
      setNotice(toErrorMessage(error, "Thao tác chapter thất bại."));
    }
  }

  async function createAudio() {
    if (
      !selected ||
      !voiceId ||
      busy ||
      isDirty ||
      selectedAudioProcessing ||
      narrationJob
    ) {
      return;
    }

    setNotice(null);
    const chapterId = selected.id;
    const parsedRate = Number.parseFloat(speakingRate);
    try {
      const job = await generateNarration.mutateAsync({
        projectId,
        request: {
          chapterId,
          voiceId,
          speakingRate: Number.isFinite(parsedRate) ? parsedRate : 1,
        },
      });
      setNarrationJob({ jobId: job.jobId, chapterId });
      void queryClient.invalidateQueries({
        queryKey: chapterQueryKeys.workspace(projectId, chapterId),
      });
      setNotice(`Đã gửi tạo audio. Job ${job.jobId.slice(0, 8)} đang được xử lý.`);
    } catch (error) {
      setNotice(toErrorMessage(error, "Tạo audio thất bại."));
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
      setNotice(toErrorMessage(error, "Xóa chapter thất bại."));
    }
  }

  const narrationBlockedByAnotherChapter = Boolean(
    narrationJob && narrationJob.chapterId !== selected?.id,
  );
  const audioControlsDisabled =
    !selected || busy || selectedAudioProcessing || Boolean(narrationJob);

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

      <ChapterWorkflowRibbon />

      <div className="grid min-h-0 grid-cols-[minmax(270px,0.85fr)_minmax(440px,1.45fr)_minmax(240px,0.72fr)] gap-3 overflow-x-auto overflow-y-hidden p-4">
        <ChapterListPanel
          chapters={paginatedChapters}
          allChaptersCount={chapters.length}
          editingId={editingId}
          isCreating={isCreating}
          busy={busy}
          query={query}
          statusFilter={statusFilter}
          sortBy={sortBy}
          page={page}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
          filteredCount={filtered.length}
          workspacesByChapterId={workspacesByChapterId}
          workspaceErrorsByChapterId={workspaceErrorsByChapterId}
          onQueryChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          onStatusFilterChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          onSortChange={(value) => {
            setSortBy(value);
            setPage(1);
          }}
          onResetFilters={resetFilters}
          onPageChange={setPage}
          onSelectChapter={selectChapter}
          onDeleteChapter={(chapter) => void remove(chapter)}
        />

        <ChapterEditorPanel
          selected={selected}
          title={title}
          sourceText={sourceText}
          busy={busy}
          saveBusy={saveBusy}
          isDirty={isDirty}
          notice={notice}
          audio={{
            voices,
            voiceId,
            speakingRate,
            workspace: selectedWorkspace,
            workspaceError: Boolean(selectedWorkspaceQuery?.isError),
            status: selectedAudioStatus,
            busy: audioBusy,
            ready: audioReady,
            processing: selectedAudioProcessing,
            controlsDisabled: audioControlsDisabled,
            trackedForSelected: trackedNarrationForSelected,
            blockedByAnotherChapter: narrationBlockedByAnotherChapter,
            generatePending: generateNarration.isPending,
            onVoiceChange: setVoiceId,
            onSpeakingRateChange: setSpeakingRate,
            onCreate: () => void createAudio(),
            onRefetchWorkspace: () => {
              void selectedWorkspaceQuery?.refetch();
            },
          }}
          onTitleChange={setTitle}
          onSourceTextChange={setSourceText}
          onBeginCreate={beginCreate}
          onCancel={cancelEditing}
          onSave={() => void save()}
          onAnalyze={() => {
            if (selected) analyzeChapter.mutate(selected.id);
          }}
          onOpenEditor={openEditor}
        />

        <ChapterWorkspaceContext
          projectName={projectName}
          selected={Boolean(selected)}
          selectedWorkspace={selectedWorkspace}
          selectedWorkspaceError={Boolean(selectedWorkspaceQuery?.isError)}
          metrics={{
            chapters: chapters.length,
            words: totalWords,
            scenes: totalSceneCount,
            beats: totalBeatCount,
            audioReady: audioReadyCount,
            renderReady: renderReadyCount,
          }}
          onOpenRender={() => navigate(`/projects/${projectId}/render`)}
        />
      </div>
    </div>
  );
}
