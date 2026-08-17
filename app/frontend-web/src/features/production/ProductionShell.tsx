import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useProductionStore } from "@/store/useProductionStore";
import { useStudioStore } from "@/store/useStudioStore";
import { Screen01ProjectOverview } from "./Screen01ProjectOverview";
import { Screen02AddChapterModal } from "./Screen02AddChapterModal";
import { Screen03ChapterWorkspace } from "./Screen03ChapterWorkspace";
import { Screen04Storyboard } from "./Screen04Storyboard";
import { Screen05VisualReview } from "./Screen05VisualReview";
import { Screen06Render } from "./Screen06Render";
import { Screen07LongFormPreview } from "./Screen07LongFormPreview";
import { isMockDataMode } from "@/lib/data-mode";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export const ProductionShell: React.FC = () => {
  const currentView = useProductionStore((state) => state.currentView);
  const selectedProjectId = useStudioStore((state) => state.selectedProjectId);
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.listProjects,
    enabled: !isMockDataMode,
  });

  if (isMockDataMode) {
    return (
      <div className="w-full">
        {currentView === "overview" && <Screen01ProjectOverview />}
        {currentView === "workspace" && <Screen03ChapterWorkspace />}
        {currentView === "storyboard" && <Screen04Storyboard />}
        {currentView === "visual-review" && <Screen05VisualReview />}
        {currentView === "render" && <Screen06Render />}
        {currentView === "preview" && <Screen07LongFormPreview />}
        <Screen02AddChapterModal />
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
    return <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-sm text-rose-200">Không tải được project từ backend.</div>;
  }

  const project = projectsQuery.data?.find((item) => String(item.id) === selectedProjectId);

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
      <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0d1420]/40 p-6 text-sm text-slate-400">Project, story version và analysis job đã đi qua API thật. Chapter, character và visual-beat endpoints sẽ được nối vào cùng query boundary khi backend contract sẵn sàng.</div>
    </div>
  );
};
