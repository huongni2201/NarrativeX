/* eslint-disable @next/next/no-img-element -- Project cover URLs are backend/CDN-owned runtime values. */
import React, { useState } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { ChapterStatusBadge } from "@/components/production/ChapterStatusBadge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Tabs } from "@/components/ui/Tabs";
import {
  Plus,
  Play,
  Settings,
  MoreVertical,
  UploadCloud,
} from "lucide-react";
import { Chapter } from "@/types/domain";

export const ProjectOverview: React.FC = () => {
  const {
    project,
    setActiveChapter,
    setView,
    openAddChapterModal,
    continueProject,
  } = useProductionStore();

  const [activeTab, setActiveTab] = useState("chapters");

  if (!project) return null;

  const projectTabs = [
    { id: "chapters", label: "Chapters", count: project.chapters.length },
    { id: "info", label: "Thông tin dự án" },
    { id: "characters", label: "Nhân vật", count: 24 },
    { id: "locations", label: "Địa điểm", count: 18 },
    { id: "assets", label: "Tài sản" },
    { id: "settings", label: "Cài đặt" },
  ];

  const handleChapterClick = (chapter: Chapter) => {
    if (chapter.status === "EMPTY") {
      openAddChapterModal();
      return;
    }
    setActiveChapter(chapter.id);
    setView("workspace");
  };

  return (
    <div className="space-y-7">
      {/* Top Project Hero Banner matching Screen 01 */}
      <div className="flex flex-col md:flex-row gap-6 p-6 rounded-2xl bg-surface border border-border-dark shadow-xl">
        {/* Cover Hero Thumbnail */}
        <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2 md:w-56">
          <img
            src={project.coverImage}
            alt={project.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute top-3 left-3">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary text-white border border-primary shadow-sm">
              {project.planBadge}
            </span>
          </div>
        </div>

        {/* Project Meta and Metrics */}
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  {project.title}
                </h1>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary-muted text-primary-light border border-primary/40 font-mono">
                  {project.planBadge}
                </span>
              </div>

              {/* Top Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setView("render")}
                  className="px-3.5 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-slate-300 border border-border-dark transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Chi tiết dự án</span>
                </button>

                <Button
                  onClick={continueProject}
                  variant="gradient"
                  size="md"
                  className="font-semibold"
                  leftIcon={<Play className="w-3.5 h-3.5 mr-1 fill-white" />}
                >
                  Tiếp tục dự án
                </Button>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              {project.description}
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
              <span>Tạo: {project.createdAt}</span>
              <span>•</span>
              <span>Cập nhật: {project.updatedAt}</span>
            </div>
          </div>

          {/* 4 Project Stats Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-border-dark">
            <div>
              <div className="text-xl font-extrabold text-white font-mono">
                {project.totalChapters}
              </div>
              <div className="text-xs text-slate-400 font-medium">Chapters</div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-white font-mono">
                {project.estimatedDuration}
              </div>
              <div className="text-xs font-medium text-slate-400">Thời lượng dự kiến</div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-white font-mono">
                {project.totalScenes}
              </div>
              <div className="text-xs text-slate-400 font-medium">Scenes</div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-primary-light font-mono">
                {project.approvedVisuals}
              </div>
              <div className="text-xs font-medium text-primary-light">Visual đã duyệt</div>
            </div>
          </div>

          {/* Overall Progress with Sub-metrics matching Screen 01 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold">Tiến độ tổng thể</span>
              <span className="text-primary-light font-bold text-sm">
                {project.overallProgress}%
              </span>
            </div>
            <Progress value={project.overallProgress} color="orange" />


            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 font-mono gap-2">
              <span>{project.readyChapters}/{project.totalChapters} Chapters ready</span>
              <span>•</span>
              <span>{project.renderedChapters}/{project.totalChapters} Chapters rendered</span>
              <span>•</span>
              <span className="text-primary-light font-semibold">{project.processingJobs} Đang xử lý</span>
              <span>•</span>
              <span>~58m Thời lượng dự kiến</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-border-dark">
        <Tabs
          tabs={projectTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="underlined"
        />
      </div>

      {/* Chapters Table matching Screen 01 */}
      {activeTab === "chapters" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border-dark overflow-hidden bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-panel text-slate-400 uppercase tracking-wider font-semibold border-b border-border-dark text-sm">
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
              <tbody className="divide-y divide-border-dark font-medium">
                {project.chapters.map((chapter) => (
                  <tr
                    key={chapter.id}
                    onClick={() => handleChapterClick(chapter)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleChapterClick(chapter);
                      }
                    }}
                    tabIndex={0}
                    className="group cursor-pointer transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                      {chapter.number}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200 group-hover:text-primary-light transition-colors">
                      {chapter.title}
                    </td>
                    <td className="py-3.5 px-4">
                      <ChapterStatusBadge status={chapter.status} />
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                      {chapter.scenesCount}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {chapter.duration}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {chapter.lastUpdated}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Thao tác cho ${chapter.title}`}
                        className="rounded p-1 text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Table Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              onClick={openAddChapterModal}
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4 mr-1.5" />}
            >
              + Thêm Chapter
            </Button>

            <button
              type="button"
              onClick={openAddChapterModal}
              className="px-4 py-2 rounded-lg bg-surface hover:bg-surface-3 text-xs font-semibold text-slate-300 border border-border-dark flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <UploadCloud className="w-4 h-4 text-primary-light" />
              <span>Import nhiều chapter</span>
            </button>
          </div>
        </div>
      )}

      {/* Info Tab */}
      {activeTab === "info" && (
        <div className="p-6 rounded-xl bg-surface border border-border-dark space-y-4 text-xs text-slate-300 leading-relaxed">
          <h3 className="text-sm font-bold text-white">Cấu hình dự án &amp; Kịch bản gốc</h3>
          <p>{project.description}</p>
        </div>
      )}
    </div>
  );
};
