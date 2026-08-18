"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  ImageIcon,
  MoreVertical,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import type { ApiProjectOverviewChapter } from "@/features/projects/api/project-overview.types";
import { queryKeys } from "@/lib/query-keys";
import { ApiClientError, apiErrorMessage } from "@/shared/api/client";

interface ProductionShellProps {
  projectId?: string;
}

const inheritedContexts = [
  "Character Bible & Locked Versions",
  "Địa điểm & Bối cảnh",
  "Outfit & Style Bible",
  "Cài đặt Visual & Motion",
  "Giọng đọc & Ngôn ngữ",
];

export function ProductionShell({ projectId }: Readonly<ProductionShellProps>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const numericProjectId = projectId ? Number(projectId) : Number.NaN;
  const hasValidProjectId = Number.isSafeInteger(numericProjectId) && numericProjectId > 0;
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    mutationFn: async () => {
      const normalizedTitle = title.trim();
      const normalizedSource = sourceText.trim();
      if (!normalizedTitle || !normalizedSource) {
        throw new Error("Nhập tiêu đề và nội dung Chapter.");
      }

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
      setTitle("");
      setSourceText("");
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
  const metrics = overview.metrics;
  const continueChapter =
    chapters.find((chapter) => chapter.status !== "RENDERED") ?? chapters.at(-1) ?? null;

  const continueProject = () => {
    if (continueChapter) {
      router.push(`/projects/${numericProjectId}/chapters/${continueChapter.id}`);
      return;
    }
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0d1420] shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
        <div className="grid gap-6 p-5 lg:grid-cols-[150px_minmax(0,1fr)] lg:p-6">
          <ProjectCover name={overview.name} coverImageUrl={overview.coverImageUrl} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-white">
                    {overview.name}
                  </h1>
                  <span className="rounded-md border border-purple-600/40 bg-purple-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300">
                    {overview.status}
                  </span>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  {overview.description || "Project chưa có mô tả."}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Tạo: {formatDate(overview.createdAt)} · Cập nhật: {formatDate(overview.updatedAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${numericProjectId}`)}
                  className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  Chi tiết dự án
                </button>
                <button
                  type="button"
                  onClick={continueProject}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(124,58,237,0.35)] transition hover:bg-purple-500"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Continue Project
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard value={String(metrics.totalChapters)} label="Chapters" />
              <MetricCard value={formatDuration(metrics.estimatedDurationSeconds)} label="Estimated" />
              <MetricCard value={String(metrics.totalScenes)} label="Scenes" />
              <MetricCard value={String(metrics.approvedVisuals)} label="Approved Visuals" />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Tiến độ tổng thể</span>
                <span className="font-bold text-slate-200">{metrics.overallProgress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-400 transition-[width] duration-500"
                  style={{ width: `${Math.max(0, Math.min(metrics.overallProgress, 100))}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-4">
                <SmallMetric
                  value={`${metrics.readyChapters}/${metrics.totalChapters}`}
                  label="Chapters ready"
                />
                <SmallMetric
                  value={`${metrics.renderedChapters}/${metrics.totalChapters}`}
                  label="Chapters rendered"
                />
                <SmallMetric value={String(metrics.processingJobs)} label="Đang xử lý" />
                <SmallMetric
                  value={`~${formatMinutes(metrics.estimatedDurationSeconds)}`}
                  label="Thời lượng dự kiến"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 px-5 lg:px-6">
          <nav className="flex min-w-max gap-6 overflow-x-auto text-sm" aria-label="Project sections">
            <Tab label="Chapters" active />
            <Tab label="Thông tin dự án" />
            <Tab label={`Nhân vật${overview.counts.characters ? ` (${overview.counts.characters})` : ""}`} />
            <Tab label="Địa điểm" />
            <Tab label="Tài sản" />
            <Tab label="Cài đặt" />
          </nav>
        </div>

        <div className="border-t border-slate-800/70">
          {chapters.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="mx-auto h-9 w-9 text-slate-600" />
              <h2 className="mt-3 text-sm font-semibold text-slate-200">Chưa có Chapter</h2>
              <p className="mt-1 text-sm text-slate-500">
                Thêm Chapter đầu tiên để bắt đầu nhập nội dung truyện.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="bg-[#090e18] text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-14 px-4 py-3 text-center">#</th>
                    <th className="px-4 py-3">Chapter</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-center">Scenes</th>
                    <th className="px-4 py-3">Thời lượng</th>
                    <th className="px-4 py-3">Cập nhật lần cuối</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {chapters.map((chapter, index) => (
                    <ChapterRow
                      key={chapter.id}
                      chapter={chapter}
                      displayNumber={index + 1}
                      onOpen={() =>
                        router.push(`/projects/${numericProjectId}/chapters/${chapter.id}`)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-3 border-t border-slate-800/70 p-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-purple-600/50 bg-purple-950/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-purple-500 hover:bg-purple-950/20"
            >
              <Plus className="h-4 w-4" />
              Add Chapter
            </button>
            <button
              type="button"
              disabled
              title="Import nhiều chapter chưa được triển khai ở backend"
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-800 bg-[#090e18] px-4 py-3 text-sm font-semibold text-slate-500 opacity-70"
            >
              <UploadCloud className="h-4 w-4" />
              Import nhiều chapter
            </button>
          </div>
        </div>
      </section>

      <Modal
        isOpen={formOpen}
        onClose={() => !createChapter.isPending && setFormOpen(false)}
        title="Thêm Chapter mới"
        subtitle="Chapter mới sẽ dùng cấu hình và context hiện có của project."
        maxWidth="2xl"
        closeDisabled={createChapter.isPending}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createChapter.mutate();
          }}
          className="space-y-5 p-6"
        >
          <div>
            <label className="text-xs font-semibold text-slate-300">Số thứ tự Chapter</label>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center font-mono text-sm font-bold text-slate-300">
                {String(chapters.length + 1).padStart(2, "0")}
              </div>
              <span className="text-xs text-slate-500">Thứ tự được hệ thống tự động xác định.</span>
            </div>
          </div>

          <div>
            <label htmlFor="chapter-title" className="text-xs font-semibold text-slate-300">
              Tiêu đề Chapter
            </label>
            <input
              id="chapter-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Nhập tiêu đề chapter..."
              maxLength={200}
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="chapter-source" className="text-xs font-semibold text-slate-300">
                Nhập nội dung Chapter
              </label>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-950/50 px-2 py-1 text-[10px] font-medium text-purple-300">
                <FileText className="h-3 w-3" /> Nhập văn bản
              </span>
            </div>
            <textarea
              id="chapter-source"
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Dán nội dung chương truyện vào đây..."
              rows={8}
              className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm leading-6 text-slate-200 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
            <p className="mt-1 text-right text-[11px] text-slate-500">
              {sourceText.length.toLocaleString("vi-VN")} ký tự
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#090e18] p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Kế thừa từ dự án
              </h3>
            </div>
            <div className="mt-3 space-y-2">
              {inheritedContexts.map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              disabled={createChapter.isPending}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createChapter.isPending || !title.trim() || !sourceText.trim()}
              className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_rgba(124,58,237,0.3)] transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createChapter.isPending ? "Đang thêm…" : "Thêm Chapter"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ProjectCover({ name, coverImageUrl }: { name: string; coverImageUrl: string | null }) {
  return (
    <div
      className="relative min-h-52 overflow-hidden rounded-xl border border-slate-700 bg-[radial-gradient(circle_at_top,#312e81_0%,#111827_46%,#020617_100%)] lg:min-h-0"
      style={
        coverImageUrl
          ? {
              backgroundImage: `linear-gradient(to top, rgba(2,6,23,.72), rgba(2,6,23,.08)), url(${JSON.stringify(coverImageUrl).slice(1, -1)})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
      aria-label={coverImageUrl ? `Ảnh bìa ${name}` : `Project ${name} chưa có ảnh bìa`}
      role="img"
    >
      {!coverImageUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <ImageIcon className="h-8 w-8 text-purple-300/70" />
          <p className="mt-2 line-clamp-3 text-sm font-semibold text-slate-300">{name}</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#090e18]/80 px-3 py-3">
      <div className="text-xl font-bold tabular-nums text-white">{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function SmallMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-[#090e18]/60 px-3 py-2">
      <div className="font-semibold tabular-nums text-slate-300">{value}</div>
      <div className="mt-0.5 text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function Tab({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={`border-b-2 py-3 text-xs font-medium transition ${
        active
          ? "border-purple-500 text-purple-300"
          : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

function ChapterRow({
  chapter,
  displayNumber,
  onOpen,
}: {
  chapter: ApiProjectOverviewChapter;
  displayNumber: number;
  onOpen: () => void;
}) {
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer bg-[#0d1420] text-slate-300 transition hover:bg-[#111a29]"
    >
      <td className="px-4 py-3 text-center font-mono text-slate-500">
        {String(displayNumber).padStart(2, "0")}
      </td>
      <td className="px-4 py-3 font-semibold text-slate-200">{chapter.title}</td>
      <td className="px-4 py-3">
        <OverviewStatusBadge status={chapter.status} />
      </td>
      <td className="px-4 py-3 text-center font-mono">{chapter.sceneCount}</td>
      <td className="px-4 py-3 font-mono text-slate-400">{formatDuration(chapter.durationSeconds)}</td>
      <td className="px-4 py-3 text-slate-500">{formatDateTime(chapter.updatedAt)}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          aria-label={`Mở Chapter ${chapter.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function OverviewStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  if (normalized === "RENDERED") return <Badge tone="emerald">Rendered</Badge>;
  if (normalized === "VISUAL_REVIEW") return <Badge tone="purple">Visual Review</Badge>;
  if (normalized === "ANALYZED") return <Badge tone="blue">Analyzed</Badge>;
  if (normalized === "ANALYZING") return <Badge tone="purple">Analyzing</Badge>;
  if (normalized === "FAILED") return <Badge tone="rose">Failed</Badge>;
  if (normalized === "DRAFT") return <Badge tone="amber">Draft</Badge>;
  return <Badge tone="slate">{status.replaceAll("_", " ")}</Badge>;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  const classes: Record<string, string> = {
    emerald: "border-emerald-800/60 bg-emerald-950/70 text-emerald-300",
    purple: "border-purple-800/60 bg-purple-950/70 text-purple-300",
    blue: "border-blue-800/60 bg-blue-950/70 text-blue-300",
    amber: "border-amber-800/60 bg-amber-950/70 text-amber-300",
    rose: "border-rose-800/60 bg-rose-950/70 text-rose-300",
    slate: "border-slate-700 bg-slate-900 text-slate-300",
  };
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${classes[tone]}`}>
      {children}
    </span>
  );
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatMinutes(seconds: number): string {
  return `${Math.max(0, Math.round(seconds / 60))}m`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function WorkspaceError({ error, fallback }: { error: unknown; fallback: string }) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-sm text-rose-200">
      {apiErrorMessage(error, fallback)}
    </div>
  );
}

function WorkspaceMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 text-sm text-slate-300">
      {children}
    </div>
  );
}
