"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { queryKeys } from "@/lib/query-keys";
import { ApiClientError, apiErrorMessage } from "@/shared/api/client";
import { ACTIVE_JOB_STATUSES, TERMINAL_JOB_STATUSES } from "@/types/api";
import type { ApiChapterLanguageStatus } from "@/types/api";

export type WorkspaceTab = "overview" | "content" | "storyboard" | "visuals" | "audio" | "render";

export interface TabConfig {
  id: WorkspaceTab;
  label: string;
  available: boolean;
}

export const WORKSPACE_TABS: TabConfig[] = [
  { id: "overview", label: "Tổng quan", available: true },
  { id: "content", label: "Nội dung", available: true },
  { id: "storyboard", label: "Storyboard", available: true },
  { id: "visuals", label: "Visuals", available: false },
  { id: "audio", label: "Audio", available: false },
  { id: "render", label: "Render & Export", available: false },
];

export function useChapterWorkspaceState(projectId: string, chapterId: string) {
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
  const [translationPromptOpen, setTranslationPromptOpen] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: validIds
      ? queryKeys.chapterWorkspace(numericProjectId, numericChapterId)
      : ["chapter-workspace", "invalid"],
    queryFn: () => chaptersApi.getWorkspace(numericProjectId, numericChapterId),
    enabled: validIds,
  });

  const languageStatusQuery = useQuery<ApiChapterLanguageStatus>({
    queryKey: validIds
      ? queryKeys.chapterLanguageStatus(numericProjectId, numericChapterId)
      : ["chapter-language-status", "invalid"],
    queryFn: () => chaptersApi.getLanguageStatus(numericProjectId, numericChapterId),
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

  const analyzeChapterMutation = useMutation({
    mutationFn: (contentVariantId: number | undefined) =>
      chaptersApi.analyze(numericProjectId, numericChapterId, contentVariantId),
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

  const confirmTranslation = useMutation({
    mutationFn: () => {
      const status = languageStatusQuery.data;
      if (!status?.sourceVariantId) throw new Error("Chưa có bản gốc hợp lệ để dịch.");
      return chaptersApi.confirmTranslation(numericProjectId, numericChapterId, {
        sourceVariantId: status.sourceVariantId,
        sourceContentHash: workspaceQuery.data?.chapter.sourceHash ?? "",
        targetLanguage: status.projectLanguage,
      });
    },
    onSuccess: (job) => {
      setTranslationPromptOpen(false);
      setAnalysisMessage(`Đã xếp hàng bản dịch (${job.status.toLowerCase()}).`);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chapterLanguageStatus(numericProjectId, numericChapterId),
      });
    },
    onError: (error) => setAnalysisMessage(apiErrorMessage(error, "Không thể bắt đầu dịch Chapter.")),
  });

  const analysisJob = analysisJobQuery.data ?? analyzeChapterMutation.data;
  const analysisActive = Boolean(
    analysisJob?.status && ACTIVE_JOB_STATUSES.has(analysisJob.status),
  );

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
    } else if (job.status === "CANCELED") {
      setAnalysisMessage("Phân tích đã bị hủy.");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chapterWorkspace(numericProjectId, numericChapterId),
      });
    } else if (job.status === "PAUSED_COST_LIMIT") {
      setAnalysisMessage("Phân tích đang tạm dừng do giới hạn chi phí.");
    }
  }, [analysisJobId, analysisJobQuery.data, numericChapterId, numericProjectId, queryClient]);

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

  const startEditing = () => {
    setEditing(true);
    setActiveTab("content");
    setSaveMessage(null);
  };

  const cancelEditing = (originalTitle: string, originalText: string, originalVersion: number) => {
    if (dirty && !window.confirm("Bỏ các thay đổi Chapter chưa lưu?")) return;
    setTitle(originalTitle);
    setSourceText(originalText);
    setRowVersion(originalVersion);
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

  return {
    numericProjectId,
    numericChapterId,
    validIds,
    workspaceQuery,
    activeTab,
    setActiveTab,
    editing,
    setEditing,
    title,
    setTitle,
    sourceText,
    setSourceText,
    dirty,
    markDirty,
    saveMessage,
    saving: updateChapter.isPending,
    saveChapter: () => updateChapter.mutate(),
    analyzeChapter: () => {
      const status = languageStatusQuery.data;
      if (status?.translationStatus === "PENDING_CONFIRMATION") {
        setTranslationPromptOpen(true);
        return;
      }
      analyzeChapterMutation.mutate(status?.existingTranslationVariantId ?? status?.sourceVariantId);
    },
    analyzeOriginal: () => {
      setTranslationPromptOpen(false);
      analyzeChapterMutation.mutate(languageStatusQuery.data?.sourceVariantId);
    },
    confirmTranslation: () => confirmTranslation.mutate(),
    confirmingTranslation: confirmTranslation.isPending,
    languageStatus: languageStatusQuery.data ?? null,
    translationPromptOpen,
    closeTranslationPrompt: () => setTranslationPromptOpen(false),
    analysisJob,
    analysisActive,
    analysisMessage,
    startEditing,
    cancelEditing,
    reloadWorkspace,
  };
}
