/* eslint-disable @next/next/no-img-element -- Project cover URLs are backend/CDN-owned runtime values. */
import Image from "next/image";
import React, { useState } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import {
  ArrowLeft,
  Video,
} from "lucide-react";

export const Render: React.FC = () => {
  const { project, activeChapterId, setView } = useProductionStore();

  const [activeTab, setActiveTab] = useState("chapter");
  const [resolution, setResolution] = useState("1080p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [quality, setQuality] = useState("standard");
  const [addWatermark, setAddWatermark] = useState(true);
  const [isRendering, setIsRendering] = useState(false);

  if (!project) return null;

  const chapter =
    project.chapters.find((c) => c.id === activeChapterId) ||
    project.chapters.find((c) => c.number === "06") ||
    project.chapters[0];

  const handleRender = () => {
    setIsRendering(true);
    setTimeout(() => {
      setIsRendering(false);
      setView("preview");
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
        <button
          onClick={() => setView("workspace")}
          className="hover:text-purple-400 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Chapter Workspace</span>
        </button>
        <span>/</span>
        <button
          onClick={() => setView("overview")}
          className="hover:text-slate-200 transition-colors"
        >
          {project.title}
        </button>
        <span>/</span>
        <span className="text-purple-300 font-semibold truncate">
          Render Chapter / Full Project
        </span>
      </div>

      {/* Two Tabs matching Screen 06 */}
      <div className="flex justify-center border-b border-slate-800 pb-2">
        <Tabs
          tabs={[
            { id: "chapter", label: "Render Chapter" },
            { id: "project", label: "Render Full Project" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="underlined"
        />
      </div>

      {/* Tab: Render Chapter */}
      {activeTab === "chapter" && (
        <div className="space-y-6">
          {/* Chapter Render Target Card matching Screen 06 */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Render Chapter hiện tại
            </h3>

            <div className="p-5 rounded-2xl bg-[#0d1420] border border-purple-500/40 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xl">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 border border-purple-500/40 shrink-0">
                  <Image
                    src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop"
                    alt={chapter.title}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-base text-white">
                    Chapter {chapter.number} – {chapter.title}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    {chapter.scenesCount || 14} scenes • {chapter.totalVisualsCount || 38} visual beats • Thời lượng dự kiến: {chapter.duration || "07:36"}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleRender}
                variant="gradient"
                size="md"
                isLoading={isRendering}
                className="shadow-[0_0_20px_rgba(124,58,237,0.5)] font-semibold shrink-0 w-full sm:w-auto"
                leftIcon={<Video className="w-4 h-4 mr-1.5" />}
              >
                Render Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Render Full Project */}
      {activeTab === "project" && (
        <div className="space-y-6">
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Render toàn bộ Project (các chapter đã sẵn sàng)
            </h3>

            <div className="p-5 rounded-2xl bg-[#0d1420] border border-purple-500/40 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xl">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 border border-purple-500/40 shrink-0">
                  <img
                    src={project.coverImage}
                    alt={project.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-base text-white">
                    {project.title}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    ({project.readyChapters}/{project.totalChapters} chapters ready) • Thời lượng dự kiến: {project.estimatedDuration}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleRender}
                variant="gradient"
                size="md"
                isLoading={isRendering}
                className="shadow-[0_0_20px_rgba(124,58,237,0.5)] font-semibold shrink-0 w-full sm:w-auto"
                leftIcon={<Video className="w-4 h-4 mr-1.5" />}
              >
                Render Full Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cài đặt xuất (Render Settings) matching Screen 06 */}
      <div className="p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
          Cài đặt xuất
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Độ phân giải */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Độ phân giải
            </label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full bg-[#090e18] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="1080p">1080P (Full HD)</option>
              <option value="720p">720P (Standard HD)</option>
              <option value="4k">4K (Ultra HD - Creator Pro)</option>
            </select>
          </div>

          {/* Tỉ lệ khung hình */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Tỉ lệ khung hình
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full bg-[#090e18] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="16:9">16 : 9 (Landscape / YouTube)</option>
              <option value="9:16">9 : 16 (Shorts / Reels / TikTok)</option>
              <option value="1:1">1 : 1 (Square)</option>
              <option value="4:3">4 : 3 (Classic)</option>
            </select>
          </div>

          {/* Chất lượng */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Chất lượng
            </label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="w-full bg-[#090e18] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="standard">Standard</option>
              <option value="high">High Bitrate</option>
              <option value="master">Master Cinema Quality</option>
            </select>
          </div>
        </div>

        {/* Checkbox Thêm watermark */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center gap-3">
          <input
            type="checkbox"
            id="watermark-cb"
            checked={addWatermark}
            onChange={(e) => setAddWatermark(e.target.checked)}
            className="w-4 h-4 rounded bg-[#090e18] border-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-[#0d1420] cursor-pointer"
          />
          <label htmlFor="watermark-cb" className="text-xs text-slate-300 select-none cursor-pointer">
            Thêm watermark <span className="text-slate-500 font-mono">(Tắt tự động cho gói Pro)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
