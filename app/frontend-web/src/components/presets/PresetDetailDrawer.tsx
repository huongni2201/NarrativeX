import React, { useState } from "react";
import { StylePreset } from "@/types/presets";
import { Button } from "@/components/ui/Button";
import { useStudioStore } from "@/store/useStudioStore";
import { useProductionStore } from "@/store/useProductionStore";
import {
  X,
  Edit3,
  Copy,
  Trash2,
  Sparkles,
  ExternalLink,
  Layers,
  Palette,
  Camera,
  Film,
} from "lucide-react";

interface PresetDetailDrawerProps {
  preset: StylePreset | null;
  onClose: () => void;
  onEdit: (preset: StylePreset) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export const PresetDetailDrawer: React.FC<PresetDetailDrawerProps> = ({
  preset,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const { openWizard, setScreen } = useStudioStore();
  const { setView } = useProductionStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!preset) return null;

  const handleApplyToNewProject = () => {
    openWizard(1);
  };

  const handleOpenProject = (projectId: string) => {
    setScreen("project-workspace");
    setView("overview");
  };

  return (
    <aside className="w-full lg:w-[380px] xl:w-[420px] bg-[#0d1420] border-l border-slate-800 flex flex-col justify-between shrink-0 h-full overflow-y-auto z-20 select-none shadow-2xl animate-in slide-in-from-right-4 duration-200">
      {/* Header with Title, Edit & Close button matching Mockup 09 */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#0d1420]/95 backdrop-blur-md z-10">
        <h3 className="text-sm font-bold text-white truncate max-w-[240px]">
          {preset.name}
        </h3>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            onClick={() => onEdit(preset)}
            variant="secondary"
            size="sm"
            className="text-xs h-7 px-2 text-purple-300 border-purple-900/60 hover:bg-purple-950/40"
            leftIcon={<Edit3 className="w-3 h-3 mr-1" />}
          >
            Chỉnh sửa
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5 space-y-5 flex-1 text-xs">
        {/* Description */}
        <p className="text-slate-300 leading-relaxed bg-[#090e18] p-3.5 rounded-xl border border-slate-800/80">
          {preset.description}
        </p>

        {/* Màu sắc chủ đạo (Color Swatches) matching Mockup 09 */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Màu sắc chủ đạo
          </h4>
          <div className="flex items-center gap-2">
            {(preset.colorPalette || ["#070B14", "#111A29", "#7C3AED", "#D97706", "#94A3B8"]).map(
              (color, idx) => (
                <div
                  key={idx}
                  style={{ backgroundColor: color }}
                  className="w-7 h-7 rounded-lg border border-white/20 shadow-md transition-transform hover:scale-110 cursor-pointer"
                  title={color}
                />
              )
            )}
          </div>
        </div>

        {/* Structured Settings Table matching Mockup 09 */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Cấu hình phong cách
          </h4>

          <div className="space-y-2 bg-[#090e18] p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 pb-2 border-b border-slate-800/60">
              <span className="text-slate-500 font-medium">Ánh sáng:</span>
              <span className="text-slate-200 font-medium sm:text-right max-w-[220px]">
                {preset.lighting || "Kịch tính, tương phản cao, ánh sáng định hướng"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 pb-2 border-b border-slate-800/60">
              <span className="text-slate-500 font-medium">Bầu không khí:</span>
              <span className="text-slate-200 font-medium sm:text-right max-w-[220px]">
                {preset.atmosphere || "Huyền bí, u tối, mạnh mẽ"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 pb-2 border-b border-slate-800/60">
              <span className="text-slate-500 font-medium">Camera:</span>
              <span className="text-slate-200 font-medium sm:text-right max-w-[220px] font-mono text-[11px]">
                {preset.cameraStyle || "35mm cinematic, shallow DOF, dynamic angles"}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-slate-500 font-medium">Tỷ lệ mặc định:</span>
              <span className="text-purple-300 font-bold font-mono">{preset.defaultAspectRatio || "16:9"}</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-slate-500 font-medium">Độ phân giải mặc định:</span>
              <span className="text-slate-200 font-bold font-mono uppercase">{preset.defaultQuality || "STANDARD"}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 pb-2 border-b border-slate-800/60">
              <span className="text-slate-500 font-medium">Motion mặc định:</span>
              <span className="text-slate-200 font-medium sm:text-right max-w-[220px]">
                {preset.motionPreset || "Slow pan, dramatic zoom, smooth motion"}
              </span>
            </div>

            <div className="flex flex-col gap-1 pt-0.5">
              <span className="text-slate-500 font-medium">Negative Rules:</span>
              <span className="text-slate-400 text-[11px] font-mono leading-relaxed bg-[#070b14] p-2 rounded-lg border border-slate-800/60">
                {preset.negativeRules || "No text, no watermark, no distorted anatomy, no low quality"}
              </span>
            </div>
          </div>
        </div>

        {/* Được dùng trong (Used-in Projects) matching Mockup 09 */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Được dùng trong
          </h4>

          {preset.usedInProjects && preset.usedInProjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {preset.usedInProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleOpenProject(p.id)}
                  className="group flex items-center gap-3 p-2.5 rounded-xl bg-[#090e18] hover:bg-slate-800/60 border border-slate-800/80 hover:border-purple-500/40 cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-700/60">
                    <img
                      src={p.coverImage}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                      {p.title}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {p.chaptersCount} chapters
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic bg-[#090e18] p-3 rounded-xl border border-slate-800/80">
              Preset này chưa được áp dụng trong dự án nào.
            </p>
          )}
        </div>
      </div>

      {/* Action Footer matching Mockup 09 */}
      <div className="p-4 border-t border-slate-800/80 bg-[#090e18] sticky bottom-0 z-10 space-y-2">
        {showDeleteConfirm ? (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 space-y-2 animate-in fade-in duration-150">
            <p className="text-xs text-rose-200 font-semibold text-center">
              Xóa phong cách này? Các dự án đang dùng sẽ giữ nguyên cấu hình đã lưu.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="justify-center"
              >
                Hủy
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onDelete(preset.id);
                  setShowDeleteConfirm(false);
                }}
                className="justify-center"
              >
                Xác nhận xóa
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              onClick={handleApplyToNewProject}
              variant="primary"
              size="md"
              className="w-full justify-center shadow-[0_0_15px_rgba(124,58,237,0.35)] font-semibold"
              leftIcon={<Sparkles className="w-4 h-4 mr-1.5" />}
            >
              Áp dụng cho dự án mới
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onDuplicate(preset.id)}
                className="py-2 px-3 rounded-lg bg-[#0d1420] hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Nhân bản</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="py-2 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-xs font-semibold text-rose-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
