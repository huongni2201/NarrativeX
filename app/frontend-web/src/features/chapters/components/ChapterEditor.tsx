"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Film,
  Image as ImageIcon,
  Layers,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { queryKeys } from "@/lib/query-keys";
import { ApiClientError, apiErrorMessage } from "@/shared/api/client";
import type {
  ApiChapterWorkspace,
  ApiChapterWorkspacePipelineStep,
  ApiChapterWorkspacePreviewScene,
} from "@/types/api";

interface ChapterEditorProps {
  projectId: string;
  chapterId: string;
}

type WorkspaceTab = "overview" | "content" | "storyboard" | "visuals" | "audio" | "render";

const TERMINAL_JOB_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const ACTIVE_JOB_STATUSES = new Set(["QUEUED", "RUNNING", "STALLED", "UNKNOWN"]);

const TABS: Array<{ id: WorkspaceTab; label: string; available: boolean }> = [
  { id: "overview", label: "Tổng quan", available: true },
  { id: "content", label: "Nội dung", available: true },
  { id: "storyboard", label: "Storyboard", available: true },
  { id: "visuals", label: "Visuals", available: false },
  { id: "audio", label: "Audio", available: false },
  { id: "render", label: "Render & Export", available: false },
];

export function ChapterEditor({ projectId, chapterId }: Readonly<ChapterEditorProps>) {
  const numericProjectId = Number(projectId);
  const numericChapterId = Number(chapterId);
  const validIds =
    Number.isSafeInteger(numericProjectId) &&
    numericProjectId > 0 &&
    Number.isSafeInteger(numericChapterId) &&
    numericChapterId > 0;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [rowVersion, setRowVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: validIds
      ? queryKeys.chapterWorkspace(numericProjectId, numericChapterId)
      : ["chapter-workspace", "invalid"],
    queryFn: () => chaptersApi.getWorkspace(numericProjectId, numericChapterId),
    enabled: validIds,
  });

  useEffect(() => {
    if (!workspaceQuery.data || dirty) return;
    setTitle(workspaceQuery.data.chapter.title);
    setSourceText(workspaceQuery.data.chapter.sourceText);
    setRowVersion(workspaceQuery.data.chapter.rowVersion);
  }, [workspaceQuery.data, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const interceptInternalLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank") return;
      const nextUrl = new URL(target.href, window.location.href);
      if (nextUrl.origin !== window.location.origin || nextUrl.href === window.location.href) return;
      if (!window.confirm("Chapter có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", preventUnload);
    document.addEventListener("click", interceptInternalLink, true);
    return () => {
      window.removeEventListener("beforeunload", preventUnload);
      document.removeEventListener("click", interceptInternalLink, true);
    };
  }, [dirty]);

  const updateChapter = useMutation({
    mutationFn: () =>
      chaptersApi.update(numericProjectId, numericChapterId, rowVersion, { title, sourceText }),
    onSuccess: async (chapter) => {
      queryClient.setQueryData(queryKeys.chapter(numericProjectId, numericChapterId), chapter);
      setTitle(chapter.title);
      setSourceText(chapter.sourceText);
      setRowVersion(chapter.rowVersion);
      setDirty(false);
      setEditing(false);
      setSaveMessage("Đã lưu Chapter.");
      setAnalysisMessage(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chapterWorkspace(numericProjectId, numericChapterId),
      });
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 409) {
        setSaveMessage(
          "Chapter đã thay đổi ở phiên khác. Bản local vẫn được giữ; tải lại dữ liệu server nếu bạn muốn bỏ draft local.",
        );
        return;
      }
      setSaveMessage(apiErrorMessage(error, "Không thể lưu Chapter."));
    },
  });

  const analyzeChapter = useMutation({
    mutationFn: () => chaptersApi.analyze(numericProjectId, numericChapterId),
    onMutate: () => setAnalysisMessage("Đang tạo analysis job…"),
    onSuccess: (job) => {
      setAnalysisJobId(job.jobId);
      queryClient.setQueryData(queryKeys.job(job.jobId), job);
      setAnalysisMessage(`Analysis job ${job.status.toLowerCase()}.`);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chapterWorkspace(numericProjectId, numericChapterId),
      });
    },
    onError: (error) => {
      setAnalysisMessage(apiErrorMessage(error, "Không thể bắt đầu phân tích Chapter."));
    },
  });

  const analysisJobQuery = useQuery({
    queryKey: analysisJobId ? queryKeys.job(analysisJobId) : ["jobs", "none"],
    queryFn: () => chaptersApi.getAnalysisJob(analysisJobId!),
    enabled: Boolean(analysisJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_JOB_STATUSES.has(status) ? false : 1500;
    },
  });

  const analysisJob = analysisJobQuery.data ?? analyzeChapter.data;
  const analysisStatus = analysisJob?.status ?? workspaceQuery.data?.pipeline.analysis.status ?? null;
  const analysisActive = Boolean(analysisStatus && ACTIVE_JOB_STATUSES.has(analysisStatus));

  useEffect(() => {
    if (!analysisJobId || !analysisJobQuery.data) return;
    const job = analysisJobQuery.data;
    if (job.status === "COMPLETED") {
      setAnalysisMessage("Phân tích hoàn tất. Storyboard đã được cập nhật từ backend.");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chapterWorkspace(numericProjectId, numericChapterId),
      });
      void queryClient.invalidateQueries({ queryKey: ["projects", numericProjectId] });
    } else if (job.status === "FAILED") {
      setAnalysisMessage(
        `Phân tích thất bại${job.errorCode ? ` (${job.errorCode})` : ""}. Kiểm tra worker/provider rồi thử lại.`,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chapterWorkspace(numericProjectId, numericChapterId),
      });
    }
  }, [analysisJobId, analysisJobQuery.data, numericProjectId, queryClient]);

  useEffect(() => {
    const saveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (editing && dirty && !updateChapter.isPending && title.trim()) updateChapter.mutate();
      }
    };
    window.addEventListener("keydown", saveShortcut);
    return () => window.removeEventListener("keydown", saveShortcut);
  }, [dirty, editing, title, updateChapter]);

  if (!validIds) return <WorkspaceMessage>Chapter route không hợp lệ.</WorkspaceMessage>;
  if (workspaceQuery.isPending)
    return <WorkspaceMessage>Đang tải Chapter Workspace từ backend…</WorkspaceMessage>;
  if (workspaceQuery.isError) {
    return (
      <WorkspaceMessage>
        {apiErrorMessage(workspaceQuery.error, "Không tải được Chapter Workspace từ backend.")}
      </WorkspaceMessage>
    );
  }

  const workspace = workspaceQuery.data;
  const chapterNumber = String(workspace.chapter.orderIndex + 1).padStart(2, "0");
  const analyzeDisabled =
    dirty ||
    !sourceText.trim() ||
    updateChapter.isPending ||
    analyzeChapter.isPending ||
    analysisActive ||
    !workspace.capabilities.canAnalyze;

  const startEditing = () => {
    setEditing(true);
    setActiveTab("content");
    setSaveMessage(null);
  };

  const cancelEditing = () => {
    if (dirty && !window.confirm("Bỏ các thay đổi Chapter chưa lưu?")) return;
    setTitle(workspace.chapter.title);
    setSourceText(workspace.chapter.sourceText);
    setRowVersion(workspace.chapter.rowVersion);
    setDirty(false);
    setEditing(false);
    setSaveMessage(null);
  };

  const markDirty = () => {
    setDirty(true);
    setSaveMessage(null);
    setAnalysisMessage(null);
    setAnalysisJobId(null);
  };

  const reloadWorkspace = async () => {
    if (dirty && !window.confirm("Tải lại sẽ bỏ toàn bộ thay đổi local chưa lưu. Tiếp tục?")) return;
    const latest = await workspaceQuery.refetch();
    if (!latest.data) return;
    setTitle(latest.data.chapter.title);
    setSourceText(latest.data.chapter.sourceText);
    setRowVersion(latest.data.chapter.rowVersion);
    setDirty(false);
    setEditing(false);
    setSaveMessage("Đã tải dữ liệu mới nhất từ server.");
    setAnalysisMessage(null);
    setAnalysisJobId(null);
  };

  return (
    <div className="space-y-4">
      <Breadcrumb workspace={workspace} chapterNumber={chapterNumber} />

      <ChapterHero
        workspace={workspace}
        chapterNumber={chapterNumber}
        analysisActive={analysisActive}
        onEdit={startEditing}
      />

      <nav
        className="flex gap-1 overflow-x-auto border-b border-slate-800/90 px-1"
        aria-label="Chapter workspace tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={!tab.available}
            onClick={() => tab.available && setActiveTab(tab.id)}
            className={`relative whitespace-nowrap px-3 py-3 text-xs font-medium transition sm:px-4 ${
              activeTab === tab.id
                ? "text-purple-300"
                : tab.available
                  ? "text-slate-400 hover:text-slate-200"
                  : "cursor-not-allowed text-slate-600"
            }`}
            title={tab.available ? undefined : "Tính năng này chưa có API runtime"}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-purple-500" />
            )}
          </button>
        ))}
      </nav>

      {workspace.pipeline.sourceOutdated && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Nội dung đã thay đổi sau lần phân tích gần nhất.</p>
            <p className="mt-0.5 text-xs text-amber-200/70">
              Storyboard hiện tại có thể đã cũ. Phân tích lại sau khi xác nhận nội dung Chapter.
            </p>
          </div>
        </div>
      )}

      {activeTab === "content" ? (
        <ContentEditor
          editing={editing}
          title={title}
          sourceText={sourceText}
          dirty={dirty}
          saving={updateChapter.isPending}
          saveMessage={saveMessage}
          onTitleChange={(value) => {
            setTitle(value);
            markDirty();
          }}
          onSourceChange={(value) => {
            setSourceText(value);
            markDirty();
          }}
          onStartEditing={() => setEditing(true)}
          onCancel={cancelEditing}
          onSave={() => updateChapter.mutate()}
          onReload={reloadWorkspace}
        />
      ) : activeTab === "storyboard" ? (
        <StoryboardPreview workspace={workspace} />
      ) : (
        <Overview
          workspace={workspace}
          analysisJobStatus={analysisJob?.status ?? null}
          analysisJobProgress={analysisJob?.progress ?? null}
          analysisMessage={analysisMessage}
          analyzeDisabled={analyzeDisabled}
          analysisActive={analysisActive}
          onAnalyze={() => analyzeChapter.mutate()}
          onEdit={startEditing}
          onOpenStoryboard={() => setActiveTab("storyboard")}
        />
      )}
    </div>
  );
}

function Breadcrumb({
  workspace,
  chapterNumber,
}: {
  workspace: ApiChapterWorkspace;
  chapterNumber: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] text-slate-500">
      <span>Dự án</span>
      <ChevronRight className="h-3 w-3 shrink-0" />
      <span className="truncate text-purple-300/80">{workspace.projectName}</span>
      <ChevronRight className="h-3 w-3 shrink-0" />
      <span className="truncate text-slate-400">
        Chapter {chapterNumber} – {workspace.chapter.title}
      </span>
    </div>
  );
}

function ChapterHero({
  workspace,
  chapterNumber,
  analysisActive,
  onEdit,
}: {
  workspace: ApiChapterWorkspace;
  chapterNumber: string;
  analysisActive: boolean;
  onEdit: () => void;
}) {
  const pipelineBadge = derivePipelineBadge(workspace, analysisActive);
  const coverScene = workspace.previewScenes.find((scene) => scene.previewImageUrl);

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-[#0b111c]/95 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="relative flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700/80 bg-gradient-to-br from-slate-800 to-slate-950 sm:h-28 sm:w-36">
            {coverScene?.previewImageUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${JSON.stringify(coverScene.previewImageUrl).slice(1, -1)})` }}
                aria-label="Chapter preview"
                role="img"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <ImageIcon className="h-7 w-7" />
                <span className="text-[10px]">Chưa có visual</span>
              </div>
            )}
          </div>

          <div className="min-w-0 py-1">
            <p className="text-[11px] font-medium text-slate-500">Chapter {chapterNumber}</p>
            <div className="mt-1 flex items-start gap-2">
              <h1 className="min-w-0 text-lg font-semibold text-slate-100 sm:text-xl">
                {workspace.chapter.title}
              </h1>
              <button
                type="button"
                onClick={onEdit}
                className="mt-0.5 rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
                aria-label="Chỉnh sửa Chapter"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[10px]">
              <PipelineBadge label="Draft" status="completed" />
              <ChevronRight className="h-3 w-3 text-slate-700" />
              <PipelineBadge label="Analyzed" status={pipelineBadge.analysis} />
              <ChevronRight className="h-3 w-3 text-slate-700" />
              <PipelineBadge label="Visual Ready" status={pipelineBadge.visual} />
              <ChevronRight className="h-3 w-3 text-slate-700" />
              <PipelineBadge label="Rendered" status={pipelineBadge.render} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[350px]">
          <StatCard label="Scenes" value={String(workspace.summary.sceneCount)} />
          <StatCard label="Visual Beats" value={String(workspace.summary.visualBeatCount)} />
          <StatCard
            label="Thời lượng dự kiến"
            value={formatDuration(workspace.summary.estimatedDurationSeconds)}
          />
        </div>

        <button
          type="button"
          disabled={!workspace.capabilities.canRender}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-purple-900/40 disabled:text-purple-300/50"
          title={workspace.capabilities.canRender ? "Render Chapter" : "Render chưa khả dụng"}
        >
          <Film className="h-3.5 w-3.5" />
          Render Chapter
        </button>
      </div>
    </section>
  );
}

function Overview({
  workspace,
  analysisJobStatus,
  analysisJobProgress,
  analysisMessage,
  analyzeDisabled,
  analysisActive,
  onAnalyze,
  onEdit,
  onOpenStoryboard,
}: {
  workspace: ApiChapterWorkspace;
  analysisJobStatus: string | null;
  analysisJobProgress: number | null;
  analysisMessage: string | null;
  analyzeDisabled: boolean;
  analysisActive: boolean;
  onAnalyze: () => void;
  onEdit: () => void;
  onOpenStoryboard: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-800/90 bg-[#0b111c]/90 p-4">
        <h2 className="text-xs font-semibold text-slate-200">Tiến trình</h2>
        <div className="mt-4 space-y-1">
          <ProgressItem
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Phân tích Chapter"
            step={workspace.pipeline.analysis}
            active={analysisActive}
          />
          <ProgressItem
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Lập kế hoạch Visual Beats"
            step={workspace.pipeline.visualPlanning}
          />
          <ProgressItem
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            label="Generate Visuals"
            step={workspace.pipeline.visualGeneration}
            progressLabel={
              workspace.pipeline.visualGeneration.total > 0
                ? `${workspace.pipeline.visualGeneration.completed}/${workspace.pipeline.visualGeneration.total}`
                : undefined
            }
          />
          <ProgressItem
            icon={<Volume2 className="h-3.5 w-3.5" />}
            label="Audio (TTS & Subtitle)"
            step={workspace.pipeline.audio}
          />
          <ProgressItem
            icon={<Film className="h-3.5 w-3.5" />}
            label="Render Chapter"
            step={workspace.pipeline.render}
          />
        </div>

        {(analysisMessage || analysisJobStatus) && (
          <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-[11px] text-slate-400">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{analysisMessage ?? "Đang theo dõi analysis job…"}</span>
              {analysisJobStatus && (
                <span className="shrink-0 font-mono text-purple-300">
                  {analysisJobStatus}
                  {analysisJobProgress !== null ? ` · ${analysisJobProgress}%` : ""}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-slate-800 pt-4">
          <h3 className="text-[11px] font-semibold text-slate-400">Hành động nhanh</h3>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={analyzeDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {analysisActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {workspace.pipeline.analysis.status === "COMPLETED"
                ? "Phân tích Chapter lại"
                : "Phân tích Chapter"}
            </button>
            <QuickAction label="Review Visuals" enabled={workspace.capabilities.canGenerateVisuals} />
            <QuickAction label="Tạo Audio" enabled={workspace.capabilities.canGenerateAudio} />
          </div>
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-slate-800/90 bg-[#0b111c]/90 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold text-slate-200">Nội dung Chapter</h2>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            >
              <Pencil className="h-3 w-3" />
              Chỉnh sửa
            </button>
          </div>
          <p className="mt-3 max-h-32 overflow-hidden whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#080d16] px-4 py-3 text-sm leading-6 text-slate-400">
            {workspace.chapter.sourceText || "Chapter chưa có nội dung."}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800/90 bg-[#0b111c]/90 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold text-slate-200">
              Scenes ({workspace.summary.sceneCount})
            </h2>
            {workspace.summary.sceneCount > 0 && (
              <button
                type="button"
                onClick={onOpenStoryboard}
                className="text-[11px] font-medium text-purple-300 transition hover:text-purple-200"
              >
                Xem tất cả
              </button>
            )}
          </div>
          <SceneGrid scenes={workspace.previewScenes} />
        </section>
      </div>
    </div>
  );
}

function ContentEditor({
  editing,
  title,
  sourceText,
  dirty,
  saving,
  saveMessage,
  onTitleChange,
  onSourceChange,
  onStartEditing,
  onCancel,
  onSave,
  onReload,
}: {
  editing: boolean;
  title: string;
  sourceText: string;
  dirty: boolean;
  saving: boolean;
  saveMessage: string | null;
  onTitleChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onStartEditing: () => void;
  onCancel: () => void;
  onSave: () => void;
  onReload: () => void;
}) {
  if (!editing) {
    return (
      <section className="rounded-2xl border border-slate-800/90 bg-[#0b111c]/90 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">Nội dung Chapter được tải trực tiếp từ backend.</p>
          </div>
          <button
            type="button"
            onClick={onStartEditing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            <Pencil className="h-3.5 w-3.5" />
            Chỉnh sửa
          </button>
        </div>
        <div className="mt-5 whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#080d16] p-5 text-sm leading-7 text-slate-300">
          {sourceText || "Chapter chưa có nội dung."}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-[#0b111c]/90 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Chỉnh sửa Chapter</h2>
          <p className="mt-1 text-xs text-slate-500">Ctrl/Cmd + S để lưu. Backend kiểm soát optimistic concurrency.</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] ${
            dirty
              ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
              : "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
          }`}
        >
          {dirty ? "Chưa lưu" : "Đã đồng bộ"}
        </span>
      </div>

      <label className="mt-5 block space-y-2">
        <span className="text-xs font-medium text-slate-300">Tiêu đề Chapter</span>
        <input
          value={title}
          maxLength={200}
          onChange={(event) => onTitleChange(event.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-[#080d16] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
        />
      </label>

      <label className="mt-4 block space-y-2">
        <span className="text-xs font-medium text-slate-300">Nội dung truyện</span>
        <textarea
          value={sourceText}
          onChange={(event) => onSourceChange(event.target.value)}
          rows={20}
          className="min-h-[420px] w-full resize-y rounded-xl border border-slate-700 bg-[#080d16] px-4 py-4 text-sm leading-7 text-slate-200 outline-none transition focus:border-purple-500"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500">
          {Array.from(sourceText).length.toLocaleString("vi-VN")} ký tự · SHA-256 do backend tính khi lưu
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReload}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tải lại
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Hủy
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || !title.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Đang lưu…" : "Lưu Chapter"}
          </button>
        </div>
      </div>

      {saveMessage && (
        <p className="mt-4 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
          {saveMessage}
        </p>
      )}
    </section>
  );
}

function StoryboardPreview({ workspace }: { workspace: ApiChapterWorkspace }) {
  return (
    <section className="rounded-2xl border border-slate-800/90 bg-[#0b111c]/90 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Storyboard</h2>
          <p className="mt-1 text-xs text-slate-500">
            {workspace.summary.sceneCount} scenes · {workspace.summary.visualBeatCount} visual beats từ lần phân tích hiện tại.
          </p>
        </div>
        {workspace.summary.sceneCount > workspace.previewScenes.length && (
          <p className="text-[11px] text-slate-600">
            Overview API chỉ trả {workspace.previewScenes.length} scene đầu để giữ payload gọn.
          </p>
        )}
      </div>
      <SceneGrid scenes={workspace.previewScenes} expanded />
    </section>
  );
}

function SceneGrid({
  scenes,
  expanded = false,
}: {
  scenes: ApiChapterWorkspacePreviewScene[];
  expanded?: boolean;
}) {
  if (scenes.length === 0) {
    return (
      <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-[#080d16] px-6 text-center">
        <Layers className="h-7 w-7 text-slate-700" />
        <p className="mt-3 text-xs font-medium text-slate-400">Chưa có Scene</p>
        <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-600">
          Phân tích Chapter để backend tạo Scene và Visual Beat. UI không dùng dữ liệu mock.
        </p>
      </div>
    );
  }

  return (
    <div className={`mt-4 grid gap-3 ${expanded ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
      {scenes.map((scene) => (
        <SceneCard key={scene.id} scene={scene} />
      ))}
    </div>
  );
}

function SceneCard({ scene }: { scene: ApiChapterWorkspacePreviewScene }) {
  const sceneNumber = String(scene.orderIndex + 1).padStart(2, "0");
  return (
    <article className="overflow-hidden rounded-xl border border-slate-800 bg-[#080d16] transition hover:border-slate-700">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-800/80 via-slate-900 to-slate-950">
        {scene.previewImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(scene.previewImageUrl).slice(1, -1)})` }}
            role="img"
            aria-label={`Preview ${scene.title}`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-700">
            <ImageIcon className="h-8 w-8" />
            <span className="text-[10px]">Visual chưa được generate</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-200 backdrop-blur">
          {sceneNumber}
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 min-h-9 text-xs font-medium leading-4 text-slate-200">{scene.title}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {scene.visualBeatCount} beats
          </span>
          {scene.durationSeconds !== null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(scene.durationSeconds)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function ProgressItem({
  icon,
  label,
  step,
  active = false,
  progressLabel,
}: {
  icon: React.ReactNode;
  label: string;
  step: ApiChapterWorkspacePipelineStep | ApiChapterWorkspace["pipeline"]["visualGeneration"];
  active?: boolean;
  progressLabel?: string;
}) {
  const completed = step.status === "COMPLETED";
  const failed = step.status === "FAILED";
  const statusText = active
    ? "Đang xử lý"
    : completed
      ? "Hoàn thành"
      : failed
        ? "Thất bại"
        : progressLabel
          ? `Đang xử lý ${progressLabel}`
          : "Chờ xử lý";
  const completedAt = "completedAt" in step ? step.completedAt : null;

  return (
    <div className="group flex gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-900/60">
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          completed
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : active
              ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
              : failed
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : "border-slate-700 bg-slate-900 text-slate-600"
        }`}
      >
        {active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium text-slate-300">{label}</p>
          {completed ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-700" />
          )}
        </div>
        <p className="mt-0.5 text-[10px] text-slate-600">
          {statusText}
          {completedAt ? ` · ${formatCompletedAt(completedAt)}` : ""}
        </p>
      </div>
    </div>
  );
}

function QuickAction({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <button
      type="button"
      disabled={!enabled}
      className="flex w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400 transition hover:border-slate-700 hover:bg-slate-900 disabled:cursor-not-allowed disabled:text-slate-700"
      title={enabled ? undefined : "Backend capability chưa khả dụng"}
    >
      {label}
    </button>
  );
}

function PipelineBadge({
  label,
  status,
}: {
  label: string;
  status: "completed" | "active" | "waiting";
}) {
  return (
    <span
      className={`rounded-full border px-2 py-1 ${
        status === "completed"
          ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
          : status === "active"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-slate-700 bg-slate-900/70 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#080d16] px-3 py-2.5">
      <p className="truncate text-[9px] uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function derivePipelineBadge(workspace: ApiChapterWorkspace, analysisActive: boolean) {
  const analysis = analysisActive
    ? "active"
    : workspace.pipeline.analysis.status === "COMPLETED"
      ? "completed"
      : "waiting";
  const visual = workspace.pipeline.visualGeneration.status === "COMPLETED" ? "completed" : "waiting";
  const render = workspace.pipeline.render.status === "COMPLETED" ? "completed" : "waiting";
  return { analysis, visual, render } as const;
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatCompletedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function WorkspaceMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 text-sm text-slate-300">
      {children}
    </div>
  );
}
