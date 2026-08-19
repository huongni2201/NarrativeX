"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, UploadCloud } from "lucide-react";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import { StoryboardScreen } from "@/features/storyboard/StoryboardScreen";
import { queryKeys } from "@/lib/query-keys";
import { ApiClientError, apiErrorMessage } from "@/shared/api/client";
import { ChapterTable } from "./components/ChapterTable";
import { CreateChapterModal, type CreateChapterInput } from "./components/CreateChapterModal";
import { ProjectHero } from "./components/ProjectHero";
import { ProjectTabs } from "./components/ProjectTabs";
import { ProjectInfoTab } from "./tabs/ProjectInfoTab";
import { ProjectResourcesTab } from "./tabs/ProjectResourcesTab";
import { ProjectSettingsTab } from "./tabs/ProjectSettingsTab";
import type { ProductionTab } from "./production.types";

interface ProductionShellProps {
  projectId?: string;
}

export function ProductionShell({ projectId }: Readonly<ProductionShellProps>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const numericProjectId = projectId ? Number(projectId) : Number.NaN;
  const hasValidProjectId = Number.isSafeInteger(numericProjectId) && numericProjectId > 0;
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState<ProductionTab>("chapters");

  const overviewQuery = useQuery({
    queryKey: hasValidProjectId
      ? queryKeys.projectOverview(numericProjectId)
      : ["projects", "invalid", "overview"],
    queryFn: () => projectsApi.getOverview(numericProjectId),
    enabled: hasValidProjectId,
  });

  const projectQuery = useQuery({
    queryKey: hasValidProjectId ? queryKeys.project(numericProjectId) : ["projects", "invalid"],
    queryFn: () => projectsApi.getById(numericProjectId),
    enabled: hasValidProjectId,
  });

  const storyQuery = useQuery({
    queryKey: hasValidProjectId ? queryKeys.story(numericProjectId) : ["stories", "invalid"],
    queryFn: async () => {
      try {
        return await projectsApi.getLatestStoryVersion(numericProjectId);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: hasValidProjectId,
  });

  const chapters = useMemo(
    () => overviewQuery.data?.chapters ?? [],
    [overviewQuery.data?.chapters],
  );
  const nextOrderIndex =
    chapters.length === 0 ? 0 : Math.max(...chapters.map((chapter) => chapter.orderIndex)) + 1;

  const createChapter = useMutation({
    mutationFn: async ({ title, sourceText }: CreateChapterInput) => {
      const normalizedTitle = title.trim();
      const normalizedSource = sourceText.trim();

      let storyVersion = storyQuery.data;
      if (!storyVersion) {
        const project = projectQuery.data;
        if (!project) throw new Error("Project chưa sẵn sàng.");
        storyVersion = await projectsApi.createStoryVersion(numericProjectId, {
          content: normalizedSource,
          sourceLanguage: project.sourceLanguage,
        });
        queryClient.setQueryData(queryKeys.story(numericProjectId), storyVersion);
      }

      return chaptersApi.create(numericProjectId, {
        storyVersionId: storyVersion.id,
        orderIndex: nextOrderIndex,
        title: normalizedTitle,
        sourceText: normalizedSource,
      });
    },
    onSuccess: (chapter) => {
      setFormError(null);
      setFormOpen(false);
      setFormResetKey((key) => key + 1);
      queryClient.setQueryData(queryKeys.chapter(numericProjectId, chapter.id), chapter);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectOverview(numericProjectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.story(numericProjectId) });
      router.push(`/projects/${numericProjectId}/chapters/${chapter.id}`);
    },
    onError: (error) => setFormError(apiErrorMessage(error, "Không thể tạo Chapter.")),
  });

  if (!projectId) {
    return <WorkspaceMessage>Chọn một project từ danh sách dự án để mở workspace.</WorkspaceMessage>;
  }
  if (!hasValidProjectId) return <WorkspaceMessage>Project ID không hợp lệ.</WorkspaceMessage>;
  if (overviewQuery.isPending || projectQuery.isPending || storyQuery.isPending) {
    return <WorkspaceMessage>Đang tải dữ liệu project từ backend…</WorkspaceMessage>;
  }
  if (overviewQuery.isError) {
    return <WorkspaceError error={overviewQuery.error} fallback="Không tải được Project Overview." />;
  }
  if (projectQuery.isError) {
    return <WorkspaceError error={projectQuery.error} fallback="Không tải được project." />;
  }
  if (storyQuery.isError) {
    return <WorkspaceError error={storyQuery.error} fallback="Không tải được Story Version." />;
  }

  const overview = overviewQuery.data;
  const project = projectQuery.data;
  const continueChapter =
    chapters.find((chapter) => chapter.status !== "RENDERED") ?? chapters.at(-1) ?? null;

  const continueProject = () => {
    if (continueChapter) {
      router.push(`/projects/${numericProjectId}/chapters/${continueChapter.id}`);
      return;
    }
    setFormOpen(true);
  };

  const openChapter = (chapterId: number) => {
    router.push(`/projects/${numericProjectId}/chapters/${chapterId}`);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0d1420] shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
        <ProjectHero
          project={overview}
          metrics={overview.metrics}
          continueChapter={continueChapter}
          onContinue={continueProject}
          onOpenInfo={() => setActiveTab("info")}
        />
        <ProjectTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "chapters" && (
          <div className="border-t border-slate-800/80">
            <ChapterTable chapters={chapters} onOpenChapter={(chapter) => openChapter(chapter.id)} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/70 p-4">
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-dashed border-purple-500/60 bg-purple-950/20 px-5 py-3 text-sm font-semibold text-purple-200 shadow-[0_0_20px_rgba(124,58,237,0.2)] transition-all hover:bg-purple-900/30"
              >
                <Plus className="h-4 w-4 text-purple-400" />
                <span>+ Add Chapter</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  alert("Backend đã hỗ trợ batch import; UI chọn file sẽ được nối ở bước tích hợp tiếp theo.");
                }}
                className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-[#0d1420] px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
              >
                <UploadCloud className="h-4 w-4 text-purple-400" />
                <span>Import nhiều chapter</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === "storyboard" && (
          <div className="border-t border-slate-800/80 p-4 sm:p-6">
            <StoryboardScreen projectId={numericProjectId} chapters={chapters} />
          </div>
        )}

        {activeTab === "info" && <ProjectInfoTab project={project} />}
        {activeTab === "characters" && (
          <ProjectResourcesTab kind="characters" onOpenLibrary={() => router.push("/characters")} />
        )}
        {activeTab === "locations" && <ProjectResourcesTab kind="locations" />}
        {activeTab === "assets" && (
          <ProjectResourcesTab kind="assets" onOpenLibrary={() => router.push("/assets")} />
        )}
        {activeTab === "settings" && <ProjectSettingsTab />}
      </section>

      <CreateChapterModal
        isOpen={formOpen}
        nextChapterNumber={chapters.length + 1}
        isSubmitting={createChapter.isPending}
        error={formError}
        resetKey={formResetKey}
        onClose={() => setFormOpen(false)}
        onSubmit={(input) => createChapter.mutate(input)}
      />
    </div>
  );
}

function WorkspaceError({ error, fallback }: Readonly<{ error: unknown; fallback: string }>) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-sm text-rose-200">
      {apiErrorMessage(error, fallback)}
    </div>
  );
}

function WorkspaceMessage({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 text-sm text-slate-300">
      {children}
    </div>
  );
}
