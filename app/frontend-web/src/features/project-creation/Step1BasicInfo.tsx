import React from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Input, Textarea } from "@/components/ui/Input";
import { AspectRatio, ImageQuality } from "@/types/studio";
import { Sparkles, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiFieldError } from "@/types/api";

interface Step1Props {
  onNext: () => void;
  onCancel: () => void;
  validationErrors?: ApiFieldError[];
}

export const Step1BasicInfo: React.FC<Step1Props> = ({ validationErrors = [] }) => {
  const { wizardDraft, updateWizardDraft } = useStudioStore();
  const nameError = validationErrors.find((error) => ["name", "title", "projectName"].includes(error.field));

  const aspectRatios: AspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "3:4"];
  const qualities: ImageQuality[] = ["Standard", "High"];

  const genres = [
    "Fantasy",
    "Sci-Fi",
    "Cổ trang",
    "Kinh dị",
    "Trinh thám",
    "Đô thị / Hiện đại",
  ];

  const languages = ["Tiếng Việt", "English", "日本語", "한국어"];

  return (
    <div className="flex flex-col md:flex-row gap-8 min-h-[480px]">
      {/* Left Form Area */}
      <div className="flex-1 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Thông tin cơ bản</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Thiết lập tên dự án, thể loại và định dạng hiển thị mặc định.
          </p>
        </div>

        {/* Tên dự án */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Tên dự án</label>
          <Input
            value={wizardDraft.title}
            onChange={(e) => updateWizardDraft({ title: e.target.value })}
            placeholder="Nhập tên dự án (ví dụ: Huyền Thoại Ánh Sáng)..."
            aria-invalid={nameError ? "true" : undefined}
          />
          {nameError && <p className="text-xs text-rose-300">{nameError.message || nameError.code || "Tên dự án không hợp lệ."}</p>}
        </div>

        {/* Mô tả */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Mô tả</label>
          <Textarea
            rows={3}
            value={wizardDraft.description}
            onChange={(e) => updateWizardDraft({ description: e.target.value })}
            placeholder="Mô tả tóm tắt về cuộc hành trình hoặc bối cảnh thế giới..."
          />
        </div>

        {/* Thể loại & Ngôn ngữ dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Thể loại</label>
            <div className="relative">
              <select
                value={wizardDraft.genre}
                onChange={(e) => updateWizardDraft({ genre: e.target.value })}
                className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 appearance-none cursor-pointer"
              >
                {genres.map((g) => (
                  <option key={g} value={g} className="bg-[#0d1420] text-slate-200">
                    {g}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Ngôn ngữ truyện</label>
            <div className="relative">
              <select
                value={wizardDraft.language}
                onChange={(e) => updateWizardDraft({ language: e.target.value })}
                className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 appearance-none cursor-pointer"
              >
                {languages.map((l) => (
                  <option key={l} value={l} className="bg-[#0d1420] text-slate-200">
                    {l}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Tỉ lệ khung hình mặc định */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300">
            Tỉ lệ khung hình mặc định
          </label>
          <div className="flex flex-wrap gap-2">
            {aspectRatios.map((ratio) => {
              const isActive = wizardDraft.aspectRatio === ratio;
              return (
                <button
                  type="button"
                  key={ratio}
                  onClick={() => updateWizardDraft({ aspectRatio: ratio })}
                  className={cn(
                    "px-4 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150",
                    isActive
                      ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_12px_rgba(124,58,237,0.4)]"
                      : "bg-[#0a0f1d] text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                  )}
                >
                  {ratio}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chất lượng hình ảnh mặc định */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-300">
            Chất lượng hình ảnh mặc định
          </label>
          <div className="flex gap-2">
            {qualities.map((q) => {
              const isActive = wizardDraft.quality === q;
              return (
                <button
                  type="button"
                  key={q}
                  onClick={() => updateWizardDraft({ quality: q })}
                  className={cn(
                    "px-4 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150",
                    isActive
                      ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_12px_rgba(124,58,237,0.4)]"
                      : "bg-[#0a0f1d] text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                  )}
                >
                  {q}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Tips Sidebar Panel */}
      <div className="w-full md:w-64 shrink-0 space-y-4">
        <div className="p-4 rounded-xl bg-[#090e18] border border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
            <Info className="w-4 h-4 text-purple-400" />
            <span>Gợi ý</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Bạn có thể thay đổi các cài đặt này sau trong quá trình thực hiện dự án.
          </p>

          <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-300 text-xs flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <span>Tỉ lệ 9:16 phù hợp để tạo Short / Reel / TikTok.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
