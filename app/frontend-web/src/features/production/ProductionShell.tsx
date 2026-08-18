"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/features/projects/api/projects.api";
import { apiErrorMessage } from "@/shared/api/client";
import { isMockDataMode } from "@/lib/data-mode";
import { queryKeys } from "@/lib/query-keys";

const ProductionDemoWorkspace = dynamic(() =>
  import("./ProductionDemoWorkspace").then((module) => module.ProductionDemoWorkspace),
);

interface ProductionShellProps {
  projectId?: string;
}

export function ProductionShell({ projectId }: Readonly<ProductionShellProps>) {
  const numericProjectId = projectId ? Number(projectId) : Number.NaN;
  const hasValidProjectId = Number.isSafeInteger(numericProjectId) && numericProjectId > 0;

  const projectQuery = useQuery({
    queryKey: hasValidProjectId ? queryKeys.project(numericProjectId) : ["projects", "invalid"],
    queryFn: () => projectsApi.getById(numericProjectId),
    enabled: !isMockDataMode && hasValidProjectId,
  });

  if (isMockDataMode) return <ProductionDemoWorkspace />;
  if (!projectId) return <WorkspaceMessage>Chọn một project từ danh sách dự án để mở workspace.</WorkspaceMessage>;
  if (!hasValidProjectId) return <WorkspaceMessage>Project ID không hợp lệ.</WorkspaceMessage>;
  if (projectQuery.isPending) return <WorkspaceMessage>Đang tải project từ backend…</WorkspaceMessage>;

  if (projectQuery.isError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-sm text-rose-200">
        {apiErrorMessage(projectQuery.error, "Không tải được project từ backend.")}
      </div>
    );
  }

  const project = projectQuery.data;
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
          <ProjectDatum label="Story language" value={project.sourceLanguage} />
          <ProjectDatum label="Frame" value={project.imageAspectRatio} />
          <ProjectDatum label="Quality" value={project.imageQualityTier} />
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-700 bg-[#0d1420]/40 p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300">Production workspace</p>
        <h3 className="mt-2 text-base font-semibold text-slate-200">Một phần backend đã kết nối</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Project, story version và analysis job đã đi qua API thật. Chapter, character, storyboard, visual-beat, render và export endpoints chưa sẵn sàng nên production không hiển thị dữ liệu fixture.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ProjectDatum label="Project / Story" value="Connected" />
          <ProjectDatum label="Chapter / Storyboard" value="Not connected" />
          <ProjectDatum label="Render / Export" value="Coming soon" />
        </div>
      </section>
    </div>
  );
}

function ProjectDatum({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-[#090e18] p-4"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-200">{value}</p></div>;
}

function WorkspaceMessage({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 text-sm text-slate-300">{children}</div>;
}
