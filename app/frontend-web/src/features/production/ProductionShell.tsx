"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  FileText,
  ImageIcon,
  MoreVertical,
  Play,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  MapPin,
  FolderKanban,
  ExternalLink,
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
  const [activeTab, setActiveTab] = useState<"chapters" | "info" | "characters" | "locations" | "assets" | "settings">("chapters");

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
    <div className="space-y-6">
      {/* Top Project Hero Banner matching Screen 01 */}
      <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0d1420] shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col md:flex-row gap-6 p-6">
          {/* Cover Hero Thumbnail */}
          <div className="relative w-full md:w-56 aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 border border-purple-500/30 shrink-0 shadow-[0_0_25px_rgba(124,58,237,0.25)]">
            <ProjectCover name={overview.name} coverImageUrl={overview.coverImageUrl} />
            <div className="absolute top-3 left-3 z-10">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-600/90 text-white border border-purple-400/40 shadow-sm">
                PRO
              </span>
            </div>
          </div>

          {/* Project Meta and Metrics */}
          <div className="flex-1 flex flex-col justify-between space-y-4 min-w-0">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight truncate">
                    {overview.name}
                  </h1>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-950/90 text-purple-300 border border-purple-700/60 font-mono">
                    PRO
                  </span>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("info")}
                    className="px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Chi tiết dự án</span>
                  </button>

                  <button
                    type="button"
                    onClick={continueProject}
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.5)] transition-all flex items-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Continue Project</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                {overview.description || "Hành trình sáng tạo video tự động từ kịch bản phân cảnh AI."}
              </p>

              <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
                <span>Tạo: {formatDate(overview.createdAt)}</span>
                <span>•</span>
                <span>Cập nhật: {formatDate(overview.updatedAt)}</span>
              </div>
            </div>

            {/* 4 Project Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-slate-800/80">
              <div>
                <div className="text-xl font-extrabold text-white font-mono">
                  {metrics.totalChapters}
                </div>
                <div className="text-xs text-slate-400 font-medium">Chapters</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-white font-mono">
                  {formatDuration(metrics.estimatedDurationSeconds)}
                </div>
                <div className="text-xs text-slate-400 font-medium">Estimated</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-white font-mono">
                  {metrics.totalScenes}
                </div>
                <div className="text-xs text-slate-400 font-medium">Scenes</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-white font-mono text-purple-300">
                  {metrics.approvedVisuals}
                </div>
                <div className="text-xs text-purple-400 font-medium">Approved Visuals</div>
              </div>
            </div>

            {/* Overall Progress with Sub-metrics matching Screen 01 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-semibold">Tiến độ tổng thể</span>
                <span className="text-purple-300 font-bold text-sm">
                  {metrics.overallProgress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-400 transition-[width] duration-500"
                  style={{ width: `${Math.max(0, Math.min(metrics.overallProgress, 100))}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 font-mono gap-2">
                <span>{metrics.readyChapters}/{metrics.totalChapters} Chapters ready</span>
                <span>•</span>
                <span>{metrics.renderedChapters}/{metrics.totalChapters} Chapters rendered</span>
                <span>•</span>
                <span className="text-purple-400 font-semibold">{metrics.processingJobs} Đang xử lý</span>
                <span>•</span>
                <span>~{formatMinutes(metrics.estimatedDurationSeconds)} Thời lượng dự kiến</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation matching Screen 01 */}
        <div className="border-t border-slate-800 px-6">
          <nav className="flex min-w-max gap-8 overflow-x-auto text-sm" aria-label="Project tabs">
            <TabButton
              label="Chapters"
              active={activeTab === "chapters"}
              onClick={() => setActiveTab("chapters")}
            />
            <TabButton
              label="Thông tin dự án"
              active={activeTab === "info"}
              onClick={() => setActiveTab("info")}
            />
            <TabButton
              label={`Nhân vật${overview.counts.characters ? ` (${overview.counts.characters})` : ""}`}
              active={activeTab === "characters"}
              onClick={() => setActiveTab("characters")}
            />
            <TabButton
              label="Địa điểm"
              active={activeTab === "locations"}
              onClick={() => setActiveTab("locations")}
            />
            <TabButton
              label="Tài sản"
              active={activeTab === "assets"}
              onClick={() => setActiveTab("assets")}
            />
            <TabButton
              label="Cài đặt"
              active={activeTab === "settings"}
              onClick={() => setActiveTab("settings")}
            />
          </nav>
        </div>

        {/* Chapters Tab Content */}
        {activeTab === "chapters" && (
          <div className="border-t border-slate-800/80">
            {chapters.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-600" />
                <h2 className="mt-3 text-sm font-semibold text-slate-200">Chưa có Chapter</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Thêm Chapter đầu tiên để bắt đầu nhập nội dung truyện và tạo storyboard.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead className="bg-[#090e18] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Chapter</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-center">Scenes</th>
                      <th className="py-3 px-4">Thời lượng</th>
                      <th className="py-3 px-4">Cập nhật lần cuối</th>
                      <th className="py-3 px-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
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

            {/* Bottom Table Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-800/70">
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="px-5 py-2.5 rounded-lg border border-dashed border-purple-500/60 bg-purple-950/20 hover:bg-purple-900/30 text-xs font-semibold text-purple-200 shadow-[0_0_20px_rgba(124,58,237,0.2)] transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-purple-400" />
                <span>+ Add Chapter</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  alert("Tính năng Import nhiều chapter từ file văn bản / kịch bản đang trong lộ trình backend.");
                }}
                className="px-4 py-2.5 rounded-lg bg-[#0d1420] hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700/80 flex items-center gap-2 transition-colors"
              >
                <UploadCloud className="w-4 h-4 text-purple-400" />
                <span>Import nhiều chapter</span>
              </button>
            </div>
          </div>
        )}

        {/* Info Tab */}
        {activeTab === "info" && (
          <div className="p-6 border-t border-slate-800 space-y-4 text-xs text-slate-300 leading-relaxed">
            <h3 className="text-sm font-bold text-white">Thông tin dự án &amp; Kịch bản gốc</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Tên dự án</span>
                <p className="text-sm font-bold text-white">{overview.name}</p>
                <span className="text-[11px] text-slate-400 uppercase font-semibold block pt-2">Mô tả</span>
                <p className="text-xs text-slate-300">{overview.description || "Chưa có mô tả."}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Ngôn ngữ &amp; Tỷ lệ</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-slate-800 text-slate-200 font-mono">16:9</span>
                  <span className="px-2 py-1 rounded bg-slate-800 text-slate-200 font-mono">vi-VN</span>
                  <span className="px-2 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">STANDARD</span>
                </div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold block pt-2">ID Dự án</span>
                <p className="text-xs text-slate-400 font-mono">{overview.id}</p>
              </div>
            </div>
          </div>
        )}

        {/* Characters Tab */}
        {activeTab === "characters" && (
          <div className="p-6 border-t border-slate-800 space-y-4 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Nhân vật tham gia dự án</h3>
              <button
                type="button"
                onClick={() => router.push("/characters")}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
              >
                <span>Quản lý Thư viện nhân vật</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Nhân vật trong NarrativeX thuộc quyền sở hữu của User/Workspace và được tham gia vào dự án thông qua ProjectCharacter snapshot bất biến.
            </p>
          </div>
        )}

        {/* Locations Tab */}
        {activeTab === "locations" && (
          <div className="p-6 border-t border-slate-800 space-y-4 text-xs text-slate-300">
            <h3 className="text-sm font-bold text-white">Địa điểm &amp; Bối cảnh thế giới</h3>
            <p className="text-xs text-slate-400">
              Địa điểm và bối cảnh (Location Bible) giúp đảm bảo tính nhất quán môi trường qua từng Visual Beat. API đang được hoàn thiện.
            </p>
          </div>
        )}

        {/* Assets Tab */}
        {activeTab === "assets" && (
          <div className="p-6 border-t border-slate-800 space-y-4 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Tài sản dự án (Assets)</h3>
              <button
                type="button"
                onClick={() => router.push("/assets")}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
              >
                <span>Mở Thư viện tài sản</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Các hình ảnh, video clip, audio âm thanh đã được render và duyệt cho dự án này.
            </p>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="p-6 border-t border-slate-800 space-y-4 text-xs text-slate-300">
            <h3 className="text-sm font-bold text-white">Cài đặt dự án</h3>
            <p className="text-xs text-slate-400">
              Quản lý quyền chia sẻ, xuất video, cấu hình AI renderer và lưu trữ đám mây.
            </p>
          </div>
        )}
      </section>

      {/* Add Chapter Modal */}
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
  if (coverImageUrl) {
    return (
      <div
        className="w-full h-full bg-cover bg-center relative"
        style={{ backgroundImage: `url(${coverImageUrl})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative flex flex-col justify-end p-4 bg-gradient-to-b from-[#1b1938] via-[#0f1424] to-[#080c16]">
      {/* Decorative artwork background */}
      <div className="absolute inset-0 opacity-40 mix-blend-screen overflow-hidden">
        <svg viewBox="0 0 200 300" className="w-full h-full object-cover">
          <defs>
            <linearGradient id="castleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d="M20 300 L20 220 L40 220 L40 180 L50 180 L50 140 L70 140 L70 110 L90 110 L90 70 L110 70 L110 110 L130 110 L130 140 L150 140 L150 180 L160 180 L160 220 L180 220 L180 300 Z" fill="url(#castleGrad)" />
          <circle cx="100" cy="80" r="40" fill="#c084fc" opacity="0.15" />
          <circle cx="100" cy="80" r="20" fill="#e9d5ff" opacity="0.25" />
        </svg>
      </div>
      <div className="relative z-10 space-y-1">
        <Sparkles className="w-5 h-5 text-purple-400 mb-1" />
        <p className="line-clamp-2 text-xs font-bold text-slate-100">{name}</p>
        <p className="text-[10px] text-purple-300 font-medium">NarrativeX Visual</p>
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 py-3.5 text-xs font-semibold transition-all ${
        active
          ? "border-purple-500 text-purple-300 font-bold"
          : "border-transparent text-slate-400 hover:text-slate-200"
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
      className="cursor-pointer bg-[#0d1420] text-slate-300 transition hover:bg-[#111a29] group"
    >
      <td className="py-3.5 px-4 text-center font-mono text-slate-400">
        {String(displayNumber).padStart(2, "0")}
      </td>
      <td className="py-3.5 px-4 font-semibold text-slate-200 group-hover:text-purple-300 transition-colors">
        {chapter.title}
      </td>
      <td className="py-3.5 px-4">
        <OverviewStatusBadge status={chapter.status} />
      </td>
      <td className="py-3.5 px-4 text-center font-mono text-slate-300">
        {chapter.sceneCount}
      </td>
      <td className="py-3.5 px-4 font-mono text-slate-400">
        {formatDuration(chapter.durationSeconds)}
      </td>
      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
        {formatDateTime(chapter.updatedAt)}
      </td>
      <td className="py-3.5 px-4 text-right">
        <button
          type="button"
          aria-label={`Mở Chapter ${chapter.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function OverviewStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  if (normalized === "RENDERED") {
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-[11px] font-bold border border-emerald-600/50 bg-emerald-950/80 text-emerald-300">
        Rendered
      </span>
    );
  }
  if (normalized === "VISUAL_REVIEW" || normalized === "IN_REVIEW") {
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-[11px] font-bold border border-purple-600/50 bg-purple-950/80 text-purple-300">
        Visual Review
      </span>
    );
  }
  if (normalized === "ANALYZED") {
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-[11px] font-bold border border-blue-600/50 bg-blue-950/80 text-blue-300">
        Analyzed
      </span>
    );
  }
  if (normalized === "ANALYZING" || normalized === "IN_PROGRESS") {
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-[11px] font-bold border border-purple-500 bg-purple-950/90 text-purple-200 animate-pulse">
        Analyzing
      </span>
    );
  }
  if (normalized === "DRAFT") {
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-[11px] font-bold border border-amber-600/50 bg-amber-950/80 text-amber-300">
        Draft
      </span>
    );
  }
  if (normalized === "FAILED") {
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-[11px] font-bold border border-rose-600/50 bg-rose-950/80 text-rose-300">
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex rounded px-2 py-0.5 text-[11px] font-bold border border-slate-700 bg-slate-900 text-slate-400">
      {status.replaceAll("_", " ")}
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
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

