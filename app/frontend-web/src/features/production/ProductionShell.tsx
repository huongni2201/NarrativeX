"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, UploadCloud } from "lucide-react";
import { StoryboardScreen } from "@/features/storyboard/StoryboardScreen";
import { apiErrorMessage } from "@/shared/api/client";
import { LoadingState } from "@/components/ui/LoadingState";
import { ChapterTable } from "./components/ChapterTable";
import { CreateChapterModal } from "./components/CreateChapterModal";
import { ProjectHero } from "./components/ProjectHero";
import { ProjectTabs } from "./components/ProjectTabs";
import { ProjectSummaryWidget } from "./components/ProjectSummaryWidget";
import { ProjectCharactersTab } from "./tabs/ProjectCharactersTab";
import { ProjectInfoTab } from "./tabs/ProjectInfoTab";
import { ProjectResourcesTab } from "./tabs/ProjectResourcesTab";
import { ProjectSettingsTab } from "./tabs/ProjectSettingsTab";
import type { ProductionTab } from "./production.types";
import { useBatchChapterImport } from "./hooks/useBatchChapterImport";
import { useCreateChapter } from "./hooks/useCreateChapter";
import { useProjectResources } from "./hooks/useProjectResources";
import { useProjectWorkspace } from "./hooks/useProjectWorkspace";

interface ProductionShellProps {
  projectId?: string;
  initialTab?: ProductionTab;
}

export function ProductionShell({ projectId, initialTab = "chapters" }: Readonly<ProductionShellProps>) {
  const router = useRouter();
  const numericProjectId = projectId ? Number(projectId) : Number.NaN;
  const hasValidProjectId = Number.isSafeInteger(numericProjectId) && numericProjectId > 0;
  const [formOpen, setFormOpen] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const workspace = useProjectWorkspace(numericProjectId, initialTab, hasValidProjectId);
  const resources = useProjectResources(numericProjectId, workspace.activeTab, hasValidProjectId);
  const createChapter = useCreateChapter(numericProjectId, {
    onCreated: () => {
      setFormOpen(false);
      setFormResetKey((key) => key + 1);
    },
  });
  const batchImport = useBatchChapterImport(numericProjectId);

  if (!hasValidProjectId) {
    return <WorkspaceError error={new Error("ID dự án không hợp lệ.")} fallback="ID dự án không hợp lệ." />;
  }

  const { activeTab, changeTab, chapters, continueChapter, overviewQuery, projectQuery } = workspace;

  if (overviewQuery.isPending || projectQuery.isPending) {
    return (
      <LoadingState
        message="Đang tải dữ liệu project từ backend…"
        className="rounded-xl border border-border bg-surface-panel p-8"
      />
    );
  }
  if (overviewQuery.isError) {
    return <WorkspaceError error={overviewQuery.error} fallback="Không tải được Project Overview." />;
  }
  if (projectQuery.isError) {
    return <WorkspaceError error={projectQuery.error} fallback="Không tải được project." />;
  }

  const overview = overviewQuery.data;
  const project = projectQuery.data;
  const continueProject = () => {
    if (continueChapter) workspace.continueProject();
    else setFormOpen(true);
  };

  const openChapter = (chapterId: number) => {
    workspace.navigateToChapter(chapterId);
  };

  const selectBatchImportFile = () => {
    batchImport.selectFile();
  };

  const tabBreadcrumbLabel =
    activeTab === "characters"
      ? "Nhân vật"
      : activeTab === "storyboard"
        ? "Storyboard"
        : activeTab === "locations"
          ? "Địa điểm"
          : activeTab === "assets"
            ? "Tài sản"
            : activeTab === "settings"
              ? "Cài đặt"
              : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/projects" className="hover:text-primary-light transition-colors font-medium">
          Dự án
        </Link>
        <span className="text-slate-600">/</span>
        <button
          type="button"
          onClick={() => changeTab("chapters")}
          className={`hover:text-primary-light transition-colors font-semibold ${
            tabBreadcrumbLabel ? "text-slate-400" : "text-slate-200"
          }`}
        >
          {project.name}
        </button>
        {tabBreadcrumbLabel && (
          <>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200 font-semibold">{tabBreadcrumbLabel}</span>
          </>
        )}
      </div>

      {/* Top Project Hero Banner */}
      <ProjectHero
        project={overview}
        metrics={overview.metrics}
        continueChapter={continueChapter}
        onContinue={continueProject}
        onOpenInfo={() => changeTab("info")}
      />

      {/* Project Navigation Tabs */}
      <ProjectTabs activeTab={activeTab} onChange={changeTab} />

      {/* Main Tab Content */}
      {activeTab === "chapters" && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          {/* Left Column: Chapters Table Card */}
          <div className="rounded-2xl border border-slate-800/90 bg-surface shadow-xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 p-5">
              <h2 className="text-base font-bold text-slate-100">Danh sách chapter</h2>

              <div className="flex items-center gap-2.5">
                <input
                  ref={batchImport.inputRef}
                  type="file"
                  accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (file) batchImport.importFile(file);
                  }}
                />

                <button
                  type="button"
                  onClick={selectBatchImportFile}
                  disabled={batchImport.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {batchImport.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-light" />
                  ) : (
                    <UploadCloud className="h-3.5 w-3.5 text-primary-light" />
                  )}
                  <span>{batchImport.isPending ? "Đang import…" : "Import nhiều chapter"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Chapter</span>
                </button>
              </div>
            </div>

            {batchImport.errorMessage && (
              <div className="m-4 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">
                {batchImport.errorMessage}
              </div>
            )}

            <ChapterTable
              chapters={chapters}
              onOpenChapter={(chapter) => openChapter(chapter.id)}
            />
          </div>

          {/* Right Column: Project Summary Widget */}
          <ProjectSummaryWidget metrics={overview.metrics} />
        </div>
      )}

      {activeTab === "storyboard" && (
        <div className="rounded-2xl border border-slate-800/90 bg-surface p-4 sm:p-6 shadow-xl">
          <StoryboardScreen projectId={numericProjectId} chapters={chapters} />
        </div>
      )}

      {activeTab === "characters" && (
        <ProjectCharactersTab
          projectId={numericProjectId}
          onOpenLibrary={() => router.push("/characters")}
        />
      )}

      {activeTab === "info" && <ProjectInfoTab project={project} />}
      {activeTab === "locations" && (
        <ProjectResourcesTab
          kind="locations"
          locations={resources.locationsQuery.data?.content}
          isLoading={resources.locationsQuery.isPending}
          errorMessage={
            resources.locationsQuery.isError
              ? apiErrorMessage(resources.locationsQuery.error, "Không tải được Locations.")
              : null
          }
        />
      )}
      {activeTab === "assets" && (
        <ProjectResourcesTab
          kind="assets"
          assets={resources.assetsQuery.data?.content}
          isLoading={resources.assetsQuery.isPending}
          errorMessage={
            resources.assetsQuery.isError
              ? apiErrorMessage(resources.assetsQuery.error, "Không tải được Assets.")
              : null
          }
        />
      )}
      {activeTab === "settings" && <ProjectSettingsTab />}

      <CreateChapterModal
        isOpen={formOpen}
        nextChapterNumber={chapters.length + 1}
        isSubmitting={createChapter.isPending}
        error={createChapter.errorMessage}
        resetKey={formResetKey}
        onClose={() => setFormOpen(false)}
        onSubmit={(input) => {
          createChapter.submit(input);
        }}
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
