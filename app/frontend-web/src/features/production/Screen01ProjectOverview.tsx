import React, { useState } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { ChapterStatusBadge } from "@/components/production/ChapterStatusBadge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Tabs } from "@/components/ui/Tabs";
import {
  Sparkles,
  Plus,
  Play,
  Settings,
  MoreVertical,
  UploadCloud,
  FileSpreadsheet,
  Film,
  Users,
  MapPin,
  Image as ImageIcon,
  Clock,
  Layers,
} from "lucide-react";
import { Chapter } from "@/types/domain";

export const Screen01ProjectOverview: React.FC = () => {
  const {
    project,
    setActiveChapter,
    setView,
    openAddChapterModal,
    continueProject,
  } = useProductionStore();

  const [activeTab, setActiveTab] = useState("chapters");

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
      <div className="flex flex-col md:flex-row gap-6 p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 shadow-xl">
        {/* Cover Hero Thumbnail */}
        <div className="relative w-full md:w-56 aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 border border-purple-500/30 shrink-0 shadow-[0_0_25px_rgba(124,58,237,0.2)]">
          <img
            src={project.coverImage}
            alt={project.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute top-3 left-3">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-600/90 text-white border border-purple-400/40 shadow-sm">
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
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-950/80 text-purple-300 border border-purple-700/60 font-mono">
                  {project.planBadge}
                </span>
              </div>

              {/* Top Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setView("render")}
                  className="px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Chi tiết dự án</span>
                </button>

                <Button
                  onClick={continueProject}
                  variant="gradient"
                  size="md"
                  className="shadow-[0_0_20px_rgba(124,58,237,0.5)] font-semibold"
                  leftIcon={<Play className="w-3.5 h-3.5 mr-1 fill-white" />}
                >
                  Continue Project
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-slate-800/80">
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
              <div className="text-xs text-slate-400 font-medium">Estimated</div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-white font-mono">
                {project.totalScenes}
              </div>
              <div className="text-xs text-slate-400 font-medium">Scenes</div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-white font-mono text-purple-300">
                {project.approvedVisuals}
              </div>
              <div className="text-xs text-purple-400 font-medium">Approved Visuals</div>
            </div>
          </div>

          {/* Overall Progress with Sub-metrics matching Screen 01 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold">Tiến độ tổng thể</span>
              <span className="text-purple-300 font-bold text-sm">
                {project.overallProgress}%
              </span>
            </div>
            <Progress value={project.overallProgress} color="purple" />

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 font-mono gap-2">
              <span>{project.readyChapters}/{project.totalChapters} Chapters ready</span>
              <span>•</span>
              <span>{project.renderedChapters}/{project.totalChapters} Chapters rendered</span>
              <span>•</span>
              <span className="text-purple-400 font-semibold">{project.processingJobs} Đang xử lý</span>
              <span>•</span>
              <span>~58m Thời lượng dự kiến</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-800">
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
          <div className="rounded-xl border border-slate-800/90 overflow-hidden bg-[#0d1420]">
            <table className="w-full text-left text-xs">
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
                {project.chapters.map((chapter) => (
                  <tr
                    key={chapter.id}
                    onClick={() => handleChapterClick(chapter)}
                    className="hover:bg-[#111a29] cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                      {chapter.number}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200 group-hover:text-purple-300 transition-colors">
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
                        className="p-1 rounded text-slate-400 hover:text-slate-200"
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
              className="shadow-[0_0_20px_rgba(124,58,237,0.35)]"
            >
              + Add Chapter
            </Button>

            <button
              type="button"
              onClick={openAddChapterModal}
              className="px-4 py-2 rounded-lg bg-[#0d1420] hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700/80 flex items-center gap-2 transition-colors"
            >
              <UploadCloud className="w-4 h-4 text-purple-400" />
              <span>Import nhiều chapter</span>
            </button>
          </div>
        </div>
      )}

      {/* Info Tab */}
      {activeTab === "info" && (
        <div className="p-6 rounded-xl bg-[#0d1420] border border-slate-800 space-y-4 text-xs text-slate-300 leading-relaxed">
          <h3 className="text-sm font-bold text-white">Cấu hình dự án &amp; Kịch bản gốc</h3>
          <p>{project.description}</p>
        </div>
      )}
    </div>
  );
};
