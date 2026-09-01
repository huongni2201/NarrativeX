import { useEffect, useMemo, useState } from "react";
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
import { WorkspaceToolbar } from "../../workspace/components/WorkstationPrimitives";
import {
  useGenerateBatchNarration,
  useGenerateNarration,
} from "../../generation/queries/narration.queries";
import { ChapterEditorPanel } from "../components/ChapterEditorPanel";
import { ChapterListPanel } from "../components/ChapterListPanel";
import { ChapterWorkspaceContext } from "../components/ChapterWorkspaceContext";
import {
  audioGenerationBlockMessage,
  chapterStatus,
  isAnalysisProcessingStatus,
  isAudioProcessingStatus,
  type ChapterFilter,
  type ChapterSort,
  type WorkspaceStatus,
  wordCount,
  workspaceStatusDotClass,
  workspaceStatusLabel,
} from "../model/chapter-ui";
import {
  useBulkChapterAnalysis,
  useChapterAnalysis,
} from "../queries/chapter-analysis.queries";
import {
  useChapterWorkspacesQuery,
  useCreateChapter,
  useDeleteChapter,
  useUpdateChapter,
} from "../queries/chapters.queries";

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
  const updateChapter = useUpdateChapter(projectId);
  const deleteChapter = useDeleteChapter(projectId);
  const generateNarration = useGenerateNarration();
  const generateBatchNarration = useGenerateBatchNarration();
  const bulkChapterAnalysis = useBulkChapterAnalysis(projectId);
  const navigate = useNavigate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [speakingRate, setSpeakingRate] = useState("1");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChapterFilter>("all");
  const [sortBy, setSortBy] = useState<ChapterSort>("order");
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [audioRequestError, setAudioRequestError] = useState<string | null>(null);
  const [bulkAnalysisBusy, setBulkAnalysisBusy] = useState(false);

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

  const selected = isCreating ? null : chapters.find((chapter) => chapter.id === editingId) ?? null;

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
      const timestampDifference = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      return Number.isFinite(timestampDifference) && timestampDifference !== 0
        ? timestampDifference
        : right.orderIndex - left.orderIndex;
    });
  }, [chapters, query, sortBy]);

  const chapterWorkspaceQueries = useChapterWorkspacesQuery(projectId, chapters, selected?.id);

  const workspacesByChapterId = useMemo(() => {
    const workspaces = new Map<string, DesktopChapterWorkspace>();
    chapters.forEach((chapter, index) => {
      const data = chapterWorkspaceQueries[index]?.data;
      if (data) workspaces.set(chapter.id, data);
    });
    return workspaces;
  }, [chapterWorkspaceQueries, chapters]);

  const workspaceQueriesByChapterId = useMemo(
    () => new Map(chapters.map((chapter, index) => [chapter.id, chapterWorkspaceQueries[index]])),
    [chapterWorkspaceQueries, chapters],
  );

  const workspaceErrorsByChapterId = useMemo(
    () =>
      new Set(
        chapters
          .filter((_chapter, index) => chapterWorkspaceQueries[index]?.isError)
          .map((chapter) => chapter.id),
      ),
    [chapterWorkspaceQueries, chapters],
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
  const selectedWorkspaceQuery = selected ? workspaceQueriesByChapterId.get(selected.id) : undefined;
  const selectedAudioStatus = selectedWorkspace?.pipeline.audio.status ?? null;
  const selectedAudioProcessing = isAudioProcessingStatus(selectedAudioStatus);
  const selectedAnalysisProcessing = isAnalysisProcessingStatus(selectedWorkspace?.pipeline.analysis.status);
  const analysisResumeJobId = selectedAnalysisProcessing
    ? selectedWorkspace?.pipeline.analysis.latestJobId ?? null
    : null;
  const chapterAnalysis = useChapterAnalysis(projectId, selected?.id ?? null, analysisResumeJobId);
  const canAnalyze = Boolean(
    selected && selectedWorkspace?.capabilities.canAnalyze && chapterAnalysis.canAnalyze,
  );
  const audioBusy = generateNarration.isPending || selectedAudioProcessing;
  const audioReady = selectedAudioStatus === "READY" || selectedAudioStatus === "COMPLETED";
  const audioBlockMessage = audioGenerationBlockMessage(
    selectedWorkspace?.capabilities.audioGenerationBlockReason,
  );

  const bulkAudioChapterIds = useMemo(
    () =>
      chapters
        .filter((chapter) => {
          const workspace = workspacesByChapterId.get(chapter.id);
          if (!workspace?.capabilities.canGenerateAudio) return false;
          const status = workspace.pipeline.audio.status;
          return !isAudioProcessingStatus(status) && status !== "READY" && status !== "COMPLETED";
        })
        .map((chapter) => chapter.id),
    [chapters, workspacesByChapterId],
  );

  const bulkAnalysisChapterIds = useMemo(
    () =>
      chapters
        .filter((chapter) => {
          const workspace = workspacesByChapterId.get(chapter.id);
          return Boolean(
            workspace?.capabilities.canAnalyze &&
              !isAnalysisProcessingStatus(workspace.pipeline.analysis.status),
          );
        })
        .map((chapter) => chapter.id),
    [chapters, workspacesByChapterId],
  );

  useEffect(() => {
    if (!selected) return;
    const audio = selectedWorkspace?.pipeline.audio;
    if (audio?.voiceId && voices.some((voice) => voice.id === audio.voiceId)) {
      setVoiceId(audio.voiceId);
    }
    if (audio?.speakingRate != null) {
      setSpeakingRate(String(audio.speakingRate));
    }
  }, [selected?.id, selectedWorkspace?.pipeline.audio.speakingRate, selectedWorkspace?.pipeline.audio.voiceId, voices]);

  useEffect(() => {
    if (!chapterAnalysis.isTerminal || !chapterAnalysis.job || !chapterAnalysis.message) return;
    setNotice(chapterAnalysis.message);
  }, [chapterAnalysis.isTerminal, chapterAnalysis.job?.jobId, chapterAnalysis.job?.status, chapterAnalysis.message]);

  useEffect(() => {
    if (chapterAnalysis.connectionInterrupted) {
      setNotice("Kết nối realtime tạm gián đoạn. Workspace vẫn tự polling trạng thái phân tích.");
    }
  }, [chapterAnalysis.connectionInterrupted]);

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

  const saveBusy = createChapter.isPending || updateChapter.isPending;
  const analysisBusy = chapterAnalysis.isAnalyzing || selectedAnalysisProcessing;
  const busy = saveBusy || deleteChapter.isPending;
  const isDirty = selected
    ? title !== selected.title || sourceText !== selected.sourceText
    : Boolean(title.trim() || sourceText.trim());
  const generationBlockedByUnsavedChanges = Boolean(selected && isDirty);
  const generationActionDisabled = busy || generationBlockedByUnsavedChanges;

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
  const renderReadyCount = timeline?.chapters.filter((chapter) => chapter.readyForRender).length ?? null;

  function beginCreate() {
    if (isDirty && !window.confirm("Bạn có thay đổi chưa lưu. Bỏ thay đổi để tạo chapter mới?")) return;
    setEditingId(null);
    setIsCreating(true);
    setTitle("");
    setSourceText("");
    setNotice(null);
  }

  function selectChapter(chapterId: string) {
    if (isDirty && !window.confirm("Bạn có thay đổi chưa lưu. Bỏ thay đổi để mở chapter khác?")) return;
    setIsCreating(false);
    setNotice(null);
    setAudioRequestError(null);
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
    setSortBy("order");
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
      generationActionDisabled ||
      selectedAudioProcessing ||
      generateNarration.isPending ||
      audioBlockMessage
    ) return;

    setNotice(null);
    setAudioRequestError(null);
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
      setNotice(`Đã gửi tạo audio. Job ${job.jobId.slice(0, 8)} đang được worker xử lý.`);
    } catch (error) {
      const message = toErrorMessage(error, "Tạo audio thất bại.");
      setAudioRequestError(message);
      setNotice(message);
    }
  }

  async function generateAudioAll() {
    if (!voiceId || !bulkAudioChapterIds.length || generateBatchNarration.isPending) return;
    setNotice(null);
    const parsedRate = Number.parseFloat(speakingRate);
    try {
      const admitted = await generateBatchNarration.mutateAsync({
        projectId,
        chapterIds: bulkAudioChapterIds,
        voiceId,
        speakingRate: Number.isFinite(parsedRate) ? parsedRate : 1,
      });
      setNotice(`Đã xếp hàng tạo audio cho ${admitted.length} chapter. Narration worker sẽ xử lý song song theo concurrency.`);
    } catch (error) {
      setNotice(toErrorMessage(error, "Không thể xếp hàng tạo audio cho các chapter."));
    }
  }

  async function analyzeAll() {
    if (!bulkAnalysisChapterIds.length || bulkAnalysisBusy) return;
    const currentMode = selectedWorkspace?.pipeline.analysis.visualGenerationMode ?? "IMAGE";
    const preferences = {
      visualGenerationMode: currentMode,
      imageProvider: currentMode === "IMAGE" ? selectedWorkspace?.pipeline.analysis.imageProvider ?? "GEMINI_WEB" : null,
    };

    setBulkAnalysisBusy(true);
    setNotice(null);
    try {
      const result = await bulkChapterAnalysis.analyzeAll(bulkAnalysisChapterIds, preferences);
      const failed = result.total - result.admitted;
      setNotice(
        failed
          ? `Đã gửi phân tích ${result.admitted}/${result.total} chapter; ${failed} request chưa được nhận.`
          : `Đã xếp hàng phân tích ${result.admitted} chapter. General worker sẽ xử lý song song theo concurrency.`,
      );
    } catch (error) {
      setNotice(toErrorMessage(error, "Không thể xếp hàng phân tích các chapter."));
    } finally {
      setBulkAnalysisBusy(false);
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

  const audioControlsDisabled =
    !selected ||
    saveBusy ||
    selectedAudioProcessing ||
    generateNarration.isPending ||
    Boolean(audioBlockMessage);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground select-none">
      <WorkspaceToolbar className="px-4">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-tight text-foreground">Chapter Workspace</div>
          <div className="truncate text-[10px] text-text-dim">Write, analyze and prepare narration before production.</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-text-muted">
            <span className={`size-1.5 rounded-full ${workspaceStatusDotClass(workspaceStatus)}`} />
            {workspaceStatusLabel(workspaceStatus)}
          </span>
          <Button variant="outline" size="sm" onClick={openEditor}>
            Open Editor <ChevronRight size={12} />
          </Button>
        </div>
      </WorkspaceToolbar>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(270px,300px)_minmax(420px,1fr)_minmax(250px,280px)] overflow-hidden">
        <ChapterListPanel
          chapters={paginatedChapters}
          allChaptersCount={chapters.length}
          editingId={editingId}
          isCreating={isCreating}
          deleteBusy={deleteChapter.isPending}
          bulkAudioBusy={generateBatchNarration.isPending}
          bulkAnalysisBusy={bulkAnalysisBusy}
          canBulkAudio={Boolean(voiceId && bulkAudioChapterIds.length)}
          canBulkAnalysis={Boolean(bulkAnalysisChapterIds.length)}
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
          onGenerateAudioAll={() => void generateAudioAll()}
          onAnalyzeAll={() => void analyzeAll()}
        />

        <ChapterEditorPanel
          selected={selected}
          workspace={selectedWorkspace}
          canAnalyze={canAnalyze}
          title={title}
          sourceText={sourceText}
          busy={busy}
          saveBusy={saveBusy}
          analyzeBusy={analysisBusy}
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
            generatePending: generateNarration.isPending,
            blockMessage: audioBlockMessage,
            requestError: audioRequestError,
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
          onAnalyze={(preferences) => {
            if (!selected || !canAnalyze || generationActionDisabled) return;
            setNotice(null);
            void chapterAnalysis
              .analyze(preferences)
              .then((job) => {
                setNotice(`Đã gửi phân tích. Job ${job.jobId.slice(0, 8)} đang được AI xử lý.`);
              })
              .catch((error) => {
                setNotice(toErrorMessage(error, "Phân tích chapter thất bại."));
              });
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
