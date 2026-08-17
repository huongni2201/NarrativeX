import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useProductionStore } from "@/store/useProductionStore";
import { useStudioStore } from "@/store/useStudioStore";
import { ProjectOverview } from "./ProjectOverview";
import { AddChapterModal } from "./AddChapterModal";
import { ChapterWorkspace } from "./ChapterWorkspace";
import { Storyboard } from "./Storyboard";
import { VisualReview } from "./VisualReview";
import { Render } from "./Render";
import { LongFormPreview } from "./LongFormPreview";
import { isMockDataMode } from "@/lib/data-mode";
import { api, apiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const PROJECT_PAGE = 0;
const PROJECT_PAGE_SIZE = 100;

export const ProductionShell: React.FC = () => {
  const currentView = useProductionStore((state) => state.currentView);
  const selectedProjectId = useStudioStore((state) => state.selectedProjectId);
  const projectsQuery = useQuery({
    queryKey: queryKeys.projectsPage(PROJECT_PAGE, PROJECT_PAGE_SIZE),
    queryFn: () => api.listProjects({ page: PROJECT_PAGE, size: PROJECT_PAGE_SIZE }),
    enabled: !isMockDataMode,
  });

  if (isMockDataMode) {
    return (
      <div className="w-full">
        {currentView === "overview" && <ProjectOverview />}
        {currentView === "workspace" && <ChapterWorkspace />}
        {currentView === "storyboard" && <Storyboard />}
        {currentView === "visual-review" && <VisualReview />}
        {currentView === "render" && <Render />}
        {currentView === "preview" && <LongFormPreview />}
        <AddChapterModal />
      </div>
    );
  }

  if (projectsQuery.isPending) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 text-sm text-slate-300">
        Đang tải project từ backend…
      </div>
    );
  }

  if (projectsQuery.isError) {
    return <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-sm text-rose-200">{apiErrorMessage(projectsQuery.error, "Không tải được project từ backend.")}</div>;
  }

  const project = projectsQuery.data?.content.find((item) => String(item.id) === selectedProjectId);

  if (!project) {
    return <div className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 text-sm text-slate-300">Chọn một project từ Tổng quan để mở workspace.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300">Backend project</p>
            <h2 className="mt-2 text-2xl font-bold text-white">{project.name}</h2>
            <p className="mt-2 text-xs text-slate-500">Project #{project.id} · row version {project.rowVersion}</p>
          </div>
          <span className="rounded-full border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-300">{project.status}</span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-[#090e18] p-4"><p className="text-[11px] text-slate-500">Story language</p><p className="mt-1 text-sm text-slate-200">{project.sourceLanguage}</p></div>
          <div className="rounded-xl border border-slate-800 bg-[#090e18] p-4"><p className="text-[11px] text-slate-500">Frame</p><p className="mt-1 text-sm text-slate-200">{project.imageAspectRatio}</p></div>
          <div className="rounded-xl border border-slate-800 bg-[#090e18] p-4"><p className="text-[11px] text-slate-500">Quality</p><p className="mt-1 text-sm text-slate-200">{project.imageQualityTier}</p></div>
        </div>
      </section>
      <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0d1420]/40 p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300">Production workspace</p>
        <h3 className="mt-2 text-base font-semibold text-slate-200">Một phần backend đã kết nối</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">Project, story version và analysis job đã đi qua API thật. Chapter, character, storyboard, visual-beat, render và export endpoints chưa sẵn sàng nên workspace không hiển thị dữ liệu mẫu.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Project / Story", "Connected"],
            ["Chapter / Storyboard", "Not connected"],
            ["Render / Export", "Coming soon"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-[#090e18] p-4">
              <p className="text-[11px] text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
